/**
 * Strike venue adapter — mocked fetch, no network.
 *
 * Pins the contract the loop and the check script rely on:
 *   - signStrikeRequest emits the exact header/message format the docs pin
 *   - unconfigured → signed calls resolve null, public calls still work,
 *     status never leaks key material
 *   - STRIKE_BASE_URL on the wrong network → STRIKE_NETWORK_MISMATCH
 *   - order building quantizes to exchangeInfo filters; validation refuses
 *     malformed orders before anything is sent
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isConfigured,
  strikeStatus,
  strikeSigned,
  strikePublic,
  signStrikeRequest,
} from '@/services/strike/strikeClient.js';
import { quantizeDown, validateOrder, buildOrderObject, buildStrategyOrder, executeServerOrder } from '@/services/strike/strikeTrading.js';
import { normalizeSymbolInfo } from '@/services/strike/strikeDiscovery.js';
import { resetCircuitBreaker } from '@/services/infra/http.js';
import { createHash } from 'crypto';
import { ed25519 } from '@noble/curves/ed25519.js';

const PRIV = '11'.repeat(32);
const PUB = Buffer.from(ed25519.getPublicKey(new Uint8Array(Buffer.from(PRIV, 'hex')))).toString('hex');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => (h === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

const SYMBOL_INFO = normalizeSymbolInfo({
  symbol: 'SOL-USD',
  status: 'trading',
  contractType: 'PERPETUAL',
  pricePrecision: 8,
  quantityPrecision: 8,
  orderType: ['LIMIT', 'MARKET', 'STOP', 'TAKE_PROFIT'],
  filters: [
    { filterType: 'PRICE_FILTER', tickSize: '0.01', minPrice: '0.01', maxPrice: '1000000' },
    { filterType: 'LOT_SIZE', stepSize: '0.01', minQty: '0.01', maxQty: '10000' },
    { filterType: 'MIN_NOTIONAL', notional: '5' },
  ],
});

beforeEach(() => {
  process.env.STRIKE_API_WALLET_PRIVATE_KEY = PRIV;
  process.env.STRIKE_API_WALLET_PUBLIC_KEY = PUB;
  delete process.env.STRIKE_NETWORK;
  delete process.env.STRIKE_BASE_URL;
  resetCircuitBreaker('strike');
});

afterEach(() => {
  delete process.env.STRIKE_API_WALLET_PRIVATE_KEY;
  delete process.env.STRIKE_API_WALLET_PUBLIC_KEY;
  delete process.env.STRIKE_NETWORK;
  delete process.env.STRIKE_BASE_URL;
  vi.unstubAllGlobals();
});

describe('signing', () => {
  it('emits the documented message format and a verifiable Ed25519 signature', () => {
    const h = signStrikeRequest({
      method: 'get', path: '/v2/account', bodyStr: '',
      privateKeyHex: PRIV, publicKeyHex: PUB,
      timestamp: 1704067200, nonce: 'nonce-1',
    });
    expect(h['X-API-Wallet-Public-Key']).toBe(PUB);
    expect(h['X-API-Wallet-Timestamp']).toBe('1704067200');
    expect(h['X-API-Wallet-Nonce']).toBe('nonce-1');

    const bodyHash = createHash('sha256').update('', 'utf8').digest('hex');
    const msg = `GET:/v2/account:1704067200:nonce-1:${bodyHash}`;
    const ok = ed25519.verify(
      new Uint8Array(Buffer.from(h['X-API-Wallet-Signature'], 'hex')),
      new TextEncoder().encode(msg),
      new Uint8Array(Buffer.from(PUB, 'hex')),
    );
    expect(ok).toBe(true);
  });

  it('accepts a 64-byte expanded private key (uses the seed half)', () => {
    const expanded = PRIV + '22'.repeat(32);
    const h = signStrikeRequest({
      method: 'POST', path: '/v2/order', bodyStr: '{"a":1}',
      privateKeyHex: expanded, publicKeyHex: PUB,
      timestamp: 1, nonce: 'n',
    });
    expect(h['X-API-Wallet-Signature']).toHaveLength(128);
  });

  it('rejects a malformed key rather than signing garbage', () => {
    expect(() => signStrikeRequest({
      method: 'GET', path: '/v2/account', privateKeyHex: 'abcd', publicKeyHex: PUB,
    })).toThrowError(/private key/);
  });
});

describe('configuration', () => {
  it('is unconfigured without keys; signed calls resolve null and never fetch', async () => {
    delete process.env.STRIKE_API_WALLET_PRIVATE_KEY;
    delete process.env.STRIKE_API_WALLET_PUBLIC_KEY;
    expect(isConfigured()).toBe(false);
    global.fetch = vi.fn();
    await expect(strikeSigned('GET', '/v2/account')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('public reads work without any key', async () => {
    delete process.env.STRIKE_API_WALLET_PRIVATE_KEY;
    delete process.env.STRIKE_API_WALLET_PUBLIC_KEY;
    global.fetch = vi.fn(async () => jsonResponse({ symbols: [] }));
    await expect(strikePublic('/v2/exchangeInfo')).resolves.toEqual({ symbols: [] });
    expect(global.fetch.mock.calls[0][0]).toBe('https://api-v2-testnet.strikefinance.org/price/v2/exchangeInfo');
  });

  it('strikeStatus reports config without leaking key material', () => {
    const s = strikeStatus();
    expect(s.configured).toBe(true);
    expect(s.network).toBe('testnet');
    expect(s.baseUrl).toBe('https://api-v2-testnet.strikefinance.org');
    expect(s.publicKeyTail).toBe(`…${PUB.slice(-8)}`);
    expect(JSON.stringify(s)).not.toContain(PRIV);
    expect(JSON.stringify(s)).not.toContain(PUB);
  });

  it('refuses a STRIKE_BASE_URL on the wrong network', async () => {
    process.env.STRIKE_BASE_URL = 'https://api.strikefinance.org';
    global.fetch = vi.fn();
    await expect(strikeSigned('GET', '/v2/account')).rejects.toMatchObject({ code: 'STRIKE_NETWORK_MISMATCH' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('honours STRIKE_NETWORK=mainnet for both hosts', async () => {
    process.env.STRIKE_NETWORK = 'mainnet';
    global.fetch = vi.fn(async () => jsonResponse({ data: { ok: true } }));
    await strikeSigned('GET', '/v2/account');
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.strikefinance.org/v2/account');
  });
});

describe('signed request wire shape', () => {
  it('sends the signed headers and the exact serialized body that was hashed', async () => {
    const sent = [];
    global.fetch = vi.fn(async (url, opts) => {
      sent.push({ url, opts });
      return jsonResponse({ order_id: 1 });
    });
    const body = { symbol: 'SOL-USD', side: 'buy', type: 'market', size: '1', slippage: '0.01' };
    await strikeSigned('POST', '/v2/order', { body });
    const { url, opts } = sent[0];
    expect(url).toBe('https://api-v2-testnet.strikefinance.org/v2/order');
    expect(opts.method).toBe('POST');
    expect(opts.headers['X-API-Wallet-Signature']).toHaveLength(128);
    // The literal string the signature hashed is the literal body sent.
    expect(opts.body).toBe(JSON.stringify(body));
    const bodyHash = createHash('sha256').update(JSON.stringify(body), 'utf8').digest('hex');
    const msg = `POST:/v2/order:${opts.headers['X-API-Wallet-Timestamp']}:${opts.headers['X-API-Wallet-Nonce']}:${bodyHash}`;
    expect(ed25519.verify(
      new Uint8Array(Buffer.from(opts.headers['X-API-Wallet-Signature'], 'hex')),
      new TextEncoder().encode(msg),
      new Uint8Array(Buffer.from(PUB, 'hex')),
    )).toBe(true);
  });

  it('folds query params into the signed path', async () => {
    const sent = [];
    global.fetch = vi.fn(async (url, opts) => { sent.push({ url, opts }); return jsonResponse([]); });
    await strikeSigned('GET', '/v2/positions', { params: { symbol: 'SOL-USD' }, now: { timestamp: 5, nonce: 'nn' } });
    expect(sent[0].url).toBe('https://api-v2-testnet.strikefinance.org/v2/positions?symbol=SOL-USD');
    const bodyHash = createHash('sha256').update('', 'utf8').digest('hex');
    const msg = `GET:/v2/positions?symbol=SOL-USD:5:nn:${bodyHash}`;
    expect(ed25519.verify(
      new Uint8Array(Buffer.from(sent[0].opts.headers['X-API-Wallet-Signature'], 'hex')),
      new TextEncoder().encode(msg),
      new Uint8Array(Buffer.from(PUB, 'hex')),
    )).toBe(true);
  });

  it('rejects a 2xx error envelope with STRIKE_API_ERROR', async () => {
    global.fetch = vi.fn(async () => jsonResponse({ error: 'bad symbol', code: 'E1001' }));
    await expect(strikeSigned('GET', '/v2/order', { params: { symbol: 'X' } }))
      .rejects.toMatchObject({ code: 'STRIKE_API_ERROR' });
  });
});

describe('order building + validation', () => {
  it('quantizeDown floors to the increment with its precision', () => {
    expect(quantizeDown('1.2349', '0.01')).toBe('1.23');
    expect(quantizeDown('0.999', '0.001')).toBe('0.999');
    expect(quantizeDown('105.9', '10')).toBe('100');
    expect(quantizeDown('abc', '0.01')).toBeNull();
  });

  it('buildOrderObject quantizes size and price to the filters', () => {
    const body = buildOrderObject({
      symbol: 'SOL-USD', side: 'buy', type: 'limit', size: '1.239', price: '145.678',
      clientOrderId: 'rcpt-1', timeInForce: 'GTC',
    }, SYMBOL_INFO);
    expect(body.size).toBe('1.23');
    expect(body.price).toBe('145.67');
    expect(body.client_order_id).toBe('rcpt-1');
    expect(body.time_in_force).toBe('GTC');
  });

  it('validateOrder passes a well-formed limit order', () => {
    const v = validateOrder({ symbol: 'SOL-USD', side: 'buy', type: 'limit', size: '1.23', price: '145.67' }, SYMBOL_INFO);
    expect(v).toEqual({ ok: true, errors: [] });
  });

  it('validateOrder refuses off-increment, undersize, and notional violations', () => {
    expect(validateOrder({ side: 'buy', type: 'limit', size: '1.234', price: '100' }, SYMBOL_INFO).ok).toBe(false);
    expect(validateOrder({ side: 'buy', type: 'limit', size: '0.001', price: '100' }, SYMBOL_INFO).ok).toBe(false);
    expect(validateOrder({ side: 'buy', type: 'limit', size: '0.01', price: '0.01' }, SYMBOL_INFO).ok).toBe(false); // notional 0.0001 < 5
    expect(validateOrder({ side: 'buy', type: 'market', size: '1' }, SYMBOL_INFO).ok).toBe(false); // no slippage
    expect(validateOrder({ side: 'buy', type: 'market', size: '1', slippage: '0.01' }, SYMBOL_INFO).ok).toBe(true);
  });

  it('buildStrategyOrder carries per-leg client order ids', () => {
    const body = buildStrategyOrder({
      strategyId: 'strat-9',
      entry: { symbol: 'SOL-USD', side: 'buy', type: 'market', size: '2', slippage: '0.02', clientOrderId: 'rcpt-9' },
      tp: { type: 'take_profit', size: '2', stopPrice: '160' },
      sl: { type: 'stop', size: '2', stopPrice: '130' },
    }, SYMBOL_INFO);
    expect(body.strategy_id).toBe('strat-9');
    expect(body.client_order_id).toBe('rcpt-9');
    expect(body.tp_order).toMatchObject({ type: 'take_profit', stop_price: '160', client_order_id: 'strat-9-tp' });
    expect(body.sl_order).toMatchObject({ type: 'stop', stop_price: '130', client_order_id: 'strat-9-sl' });
  });

  it('executeServerOrder fails closed without keys — nothing is fetched', async () => {
    delete process.env.STRIKE_API_WALLET_PRIVATE_KEY;
    delete process.env.STRIKE_API_WALLET_PUBLIC_KEY;
    global.fetch = vi.fn();
    const res = await executeServerOrder({ symbol: 'SOL-USD', side: 'buy', type: 'market', size: '1', slippage: '0.01', symbolInfo: SYMBOL_INFO });
    expect(res.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('executeServerOrder refuses invalid orders before sending', async () => {
    global.fetch = vi.fn();
    const res = await executeServerOrder({ symbol: 'SOL-USD', side: 'buy', type: 'market', size: '1', symbolInfo: SYMBOL_INFO });
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toMatch(/slippage/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
