/**
 * Tatum Sui RPC client — mocked fetch, no network.
 *
 * Pins the frozen cross-leg contract:
 *   tatumSuiRpc(method, params, opts?) -> Promise<object|null>
 *   - resolves with the envelope's `result`
 *   - rejects with Error & {code, rpcError} on transport failure, non-2xx,
 *     a JSON-RPC `error`, or a malformed envelope
 *   - TATUM_API_KEY unset -> resolves null, never throws, never calls fetch
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  assertMemoryObjectOnChain,
  disabledReason,
  isConfigured,
  tatumStatus,
  tatumSuiRpc,
} from '@/services/tatum/tatumSuiClient.js';
import { resetCircuitBreaker } from '@/services/infra/http.js';

const KEY = 'test-tatum-key-abcdef123456';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => (h === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** Route mock by the JSON-RPC method in the request body. */
function fetchRouter(handlers) {
  return vi.fn(async (url, opts) => {
    const req = JSON.parse(opts.body);
    const handler = handlers[req.method];
    if (!handler) throw new Error(`no mock for ${req.method}`);
    const out = handler(req.params, req);
    return out instanceof Response ? out : jsonResponse(out);
  });
}

beforeEach(() => {
  process.env.TATUM_API_KEY = KEY;
  delete process.env.SUI_NETWORK;
  delete process.env.TATUM_SUI_RPC_URL;
  resetCircuitBreaker('tatum');
});

afterEach(() => {
  delete process.env.TATUM_API_KEY;
  delete process.env.SUI_NETWORK;
  delete process.env.TATUM_SUI_RPC_URL;
  vi.unstubAllGlobals();
});

describe('configuration', () => {
  it('is unconfigured without TATUM_API_KEY and never throws', async () => {
    delete process.env.TATUM_API_KEY;
    expect(isConfigured()).toBe(false);
    expect(disabledReason()).toBe('TATUM_API_KEY is not set');
    global.fetch = vi.fn();
    await expect(tatumSuiRpc('sui_getChainIdentifier')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('defaults to the mainnet gateway and sends the key as x-api-key', async () => {
    global.fetch = fetchRouter({ sui_getChainIdentifier: () => ({ result: 'abc123', id: 1, jsonrpc: '2.0' }) });
    const out = await tatumSuiRpc('sui_getChainIdentifier');
    expect(out).toBe('abc123');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://sui-mainnet.gateway.tatum.io');
    expect(opts.method).toBe('POST');
    expect(opts.headers['x-api-key']).toBe(KEY);
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ jsonrpc: '2.0', method: 'sui_getChainIdentifier', params: [] });
  });

  it('honours SUI_NETWORK=testnet', async () => {
    process.env.SUI_NETWORK = 'testnet';
    global.fetch = fetchRouter({ m: () => ({ result: null }) });
    await tatumSuiRpc('m');
    expect(global.fetch.mock.calls[0][0]).toBe('https://sui-testnet.gateway.tatum.io');
  });

  it('refuses a TATUM_SUI_RPC_URL on the wrong network rather than answering wrong', async () => {
    process.env.TATUM_SUI_RPC_URL = 'https://sui-testnet.gateway.tatum.io';
    global.fetch = vi.fn();
    await expect(tatumSuiRpc('sui_getObject', ['0x1'])).rejects.toMatchObject({
      code: 'TATUM_NETWORK_MISMATCH',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('envelope handling', () => {
  it('rejects with code + rpcError on a JSON-RPC error', async () => {
    global.fetch = fetchRouter({
      sui_getObject: () => ({ error: { code: -32602, message: 'Invalid object id' } }),
    });
    await expect(tatumSuiRpc('sui_getObject', ['0xZZ'])).rejects.toMatchObject({
      code: 'TATUM_RPC_ERROR',
      rpcError: { code: -32602, message: 'Invalid object id' },
    });
  });

  it('rejects on non-2xx transport with the fetchWithBudget code and rpcError null', async () => {
    global.fetch = vi.fn(async () => jsonResponse({ error: 'unauthorized' }, 401));
    await expect(tatumSuiRpc('sui_getObject', ['0x1'], { retries: 0 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      rpcError: null,
    });
  });

  it('rejects on an envelope with neither result nor error', async () => {
    global.fetch = fetchRouter({ sui_getObject: () => ({ id: 1, jsonrpc: '2.0' }) });
    await expect(tatumSuiRpc('sui_getObject', ['0x1'])).rejects.toMatchObject({
      code: 'TATUM_BAD_ENVELOPE',
    });
  });
});

describe('assertMemoryObjectOnChain', () => {
  const OBJECT_ID = '0x'.concat('a'.repeat(64));

  it('renders object=id@version · digest · checkpoint on success', async () => {
    global.fetch = fetchRouter({
      sui_getObject: (params) => ({
        result: {
          data: {
            objectId: params[0],
            version: '412',
            digest: 'Dg1aBcDeFgH2iJkLmNoPqRsTuVwXyZ',
            type: '0x2::memwal::Account',
            owner: { AddressOwner: '0x'.concat('b'.repeat(64)) },
          },
        },
      }),
      sui_getLatestCheckpointSequenceNumber: () => ({ result: '987654' }),
    });
    const out = await assertMemoryObjectOnChain(OBJECT_ID);
    expect(out).toMatchObject({
      exists: true,
      objectId: OBJECT_ID,
      version: '412',
      digest: 'Dg1aBcDeFgH2iJkLmNoPqRsTuVwXyZ',
      checkpoint: '987654',
      network: 'mainnet',
    });
    expect(out.render).toBe(
      `object=${OBJECT_ID}@412 · digest=Dg1aBcDeFgH2iJkLmNoPqRsTuVwXyZ · checkpoint=987654 · mainnet`,
    );
  });

  it('exists:false only when the chain actually says no', async () => {
    global.fetch = fetchRouter({
      sui_getObject: () => ({ result: { error: { code: 'notExists', object_id: OBJECT_ID } } }),
    });
    const out = await assertMemoryObjectOnChain(OBJECT_ID);
    expect(out.exists).toBe(false);
    expect(out.reason).toBe('notExists');
  });

  it('exists:null on an unknown — unconfigured or RPC down, never guessed', async () => {
    delete process.env.TATUM_API_KEY;
    const out = await assertMemoryObjectOnChain(OBJECT_ID);
    expect(out.exists).toBeNull();
    expect(out.reason).toBe('TATUM_API_KEY is not set');

    process.env.TATUM_API_KEY = KEY;
    global.fetch = vi.fn(async () => { throw new Error('socket hangup'); });
    const down = await assertMemoryObjectOnChain(OBJECT_ID, { retries: 0 });
    expect(down.exists).toBeNull();
    expect(down.reason).toMatch(/socket hangup/);
  });

  it('tatumStatus reports config without leaking the key', () => {
    const s = tatumStatus();
    expect(s.configured).toBe(true);
    expect(s.network).toBe('mainnet');
    expect(s.url).toBe('https://sui-mainnet.gateway.tatum.io');
    expect(s.apiKeyTail).toBe('…3456');
    expect(JSON.stringify(s)).not.toContain(KEY);
  });
});
