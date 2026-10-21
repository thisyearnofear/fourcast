import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GET } from '@/app/api/memory/status/route.js';
import { claimMemoryWrite, confirmMemoryWrite } from '@/services/memory/writeLedger.js';
import { buildIdempotencyKey, namespaceFor, sha256Hex } from '@/services/memory/memoryFormat.js';
import { execute, migrationsReady } from '@/services/db.js';

/**
 * /api/memory/status — the route a judge opens to check that our ≥10 memories
 * are real. What is pinned here is the honesty of the shape: config and ledger
 * answer with no credentials and no network, remote reads are opt-in per query
 * param, an unconfirmed ledger row reports `exists: null` rather than `false`,
 * and the SEAL-encryption limit is stated instead of implied by a blob id.
 *
 * LOCAL PROOF ONLY — the relayer and the chain are both mocked.
 */

const mock = vi.hoisted(() => ({ calls: [], blobs: new Map() }));

vi.mock('@mysten-incubation/memwal', () => ({
  MemWal: {
    create(config) {
      return {
        config,
        async recall({ query, namespace }) {
          mock.calls.push({ op: 'recall', query, namespace });
          const results = [...mock.blobs.values()]
            .filter((b) => b.namespace === namespace)
            .filter((b) => b.text.includes(String(query)))
            .map((b) => ({ blob_id: b.blob_id, text: b.text, distance: 0.1, created_at: b.created_at }));
          return { results, total: results.length };
        },
        async listMemories() {
          mock.calls.push({ op: 'listMemories' });
          return { memories: [], next_cursor: null, has_more: false, deleted: [] };
        },
        destroy() {},
      };
    },
  },
}));

const ENV_KEYS = [
  'FOURCAST_MEMORY_ENABLED',
  'MEMWAL_PRIVATE_KEY',
  'MEMWAL_ACCOUNT_ID',
  'MEMWAL_RELAYER_URL',
  'SUI_NETWORK',
  'SETTLEMENT_NETWORK',
  'TATUM_API_KEY',
  'TATUM_SUI_RPC_URL',
];

const OWNER = '0x'.repeat(1) + 'a'.repeat(64);

function seedRung({ kind, key, version, text, blobId, owner = null }) {
  const idempotencyKey = buildIdempotencyKey({
    kind,
    key,
    version,
    contentHash: sha256Hex(text),
  });
  return claimMemoryWrite({
    idempotencyKey,
    kind,
    namespace: namespaceFor(kind),
    memkey: key,
    version,
    textSha256: sha256Hex(text),
    network: 'mainnet',
    evidenceSource: 'db:agent_forecasts',
  }).then(({ row }) =>
    confirmMemoryWrite(idempotencyKey, { blobId, memoryId: `mem-${version}`, owner })
  );
}

function windowText(asOf, version) {
  return `window ${asOf} v=${version} as_of=${asOf}n=42 brier=0.1900 logloss=0.5100 hit=0.6190 buckets=LOW:0.410/MED:0.580/HIGH:0.790 bucket_n=LOW:12/MED:10/HIGH:20 trigger_receipt=NA source=db:agent_forecasts`;
}

function url(search = '') {
  return new Request(`http://localhost:3000/api/memory/status${search}`);
}

async function json(response) {
  expect(response.status).toBe(200);
  return response.json();
}

beforeEach(async () => {
  mock.calls = [];
  mock.blobs = new Map();
  global.fetch = vi.fn();
  // One ledger per case: `?proof=1` walks every row, so a row left over from
  // the previous test would be proven again and the counts would mean nothing.
  await migrationsReady;
  await execute('DELETE FROM memory_writes', []);
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.resetModules();
});

async function setConfigured() {
  process.env.FOURCAST_MEMORY_ENABLED = 'true';
  process.env.MEMWAL_PRIVATE_KEY = '0x'.padEnd(66, 'f');
  process.env.MEMWAL_ACCOUNT_ID = OWNER;
  process.env.SUI_NETWORK = 'mainnet';
  process.env.MEMWAL_RELAYER_URL = 'https://relayer.memory.walrus.xyz';
}

describe('/api/memory/status', () => {
  it('answers with no credentials and no network call', async () => {
    const body = await json(await GET(url()));

    expect(body.schema).toBe('memory-status/v1');
    expect(body.memory.writable).toBe(false);
    expect(body.memory.configured).toBe(false);
    expect(body.memory.reason).toContain('FOURCAST_MEMORY_ENABLED');
    expect(body.ledger).toMatchObject({ confirmed: 0, mainnetConfirmed: 0 });
    expect(body.notes.join(' ')).toMatch(/reads are unavailable/i);
    // The cheap default must stay cheap: a page load cannot spend relayer requests.
    expect(mock.calls).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('names both chains and says out loud when they disagree', async () => {
    // Documented defaults: memories write to mainnet, settlement quotes testnet,
    // and the x402 verifier refuses a cross-chain read. The route reports that
    // instead of letting a chip print one network for both.
    const off = await json(await GET(url()));
    expect(off.chains).toMatchObject({ memory: 'mainnet', settlement: 'sui:testnet', rpc: 'mainnet', aligned: false });
    expect(off.notes.join(' ')).toMatch(/settlement is not aligned/i);

    process.env.SETTLEMENT_NETWORK = 'mainnet';
    const on = await json(await GET(url()));
    expect(on.chains.aligned).toBe(true);
    expect(on.notes.join(' ')).not.toMatch(/settlement is not aligned/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses an unknown kind instead of silently reading the wrong namespace', async () => {
    const response = await GET(url('?kind=secrets'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/analyst/);
    expect(mock.calls).toHaveLength(0);
  });

  it('keeps the ladder behind an explicit opt-in', async () => {
    await setConfigured();
    const text = windowText('2026-10', 3);
    mock.blobs.set('blob-1', {
      blob_id: 'blob-1',
      namespace: namespaceFor('window'),
      text,
      created_at: new Date().toISOString(),
    });

    const offline = await json(await GET(url()));
    expect(offline.rungs).toBeUndefined();
    expect(mock.calls).toHaveLength(0);

    const online = await json(await GET(url('?ladder=1&kind=window&key=2026-10')));
    expect(online.memory.writable).toBe(true);
    expect(online.rungs).toHaveLength(1);
    expect(online.rungs[0]).toMatchObject({ key: '2026-10', version: 3, blobId: 'blob-1' });
    // The path and host are the ones the MemWal SDK itself downloads from, so
    // the lane's blob link goes somewhere real — and returns ciphertext.
    expect(online.rungs[0].blobUrl).toBe(
      'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/blob-1'
    );
    expect(online.notes.join(' ')).toMatch(/SEAL-encrypted/i);
    expect(mock.calls.filter((c) => c.op === 'recall')).toHaveLength(1);
  });

  it('drops a fuzzy recall hit whose key is not the one asked for', async () => {
    await setConfigured();
    // The mock filters on substring, the way a real semantic recall would:
    // `2026-1` matches `2026-10`. The route must not quote the wrong month.
    mock.blobs.set('blob-2', {
      blob_id: 'blob-2',
      namespace: namespaceFor('window'),
      text: windowText('2026-10', 7),
      created_at: new Date().toISOString(),
    });

    const body = await json(await GET(url('?ladder=1&kind=window&key=2026-1')));
    expect(body.rungs).toHaveLength(0);
    expect(body.notes.join(' ')).toMatch(/no parseable rung/i);
  });

  it('proves a confirmed ledger row on chain through Tatum', async () => {
    await setConfigured();
    process.env.TATUM_API_KEY = 'tatum-test-key';
    await seedRung({
      kind: 'window',
      key: '2026-10',
      version: 1,
      text: windowText('2026-10', 1),
      blobId: 'blob-conf-1',
      owner: OWNER,
    });

    global.fetch = vi.fn(async (_url, opts) => {
      const params = JSON.parse(opts.body).params;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result:
            params[1]?.showOwner === undefined
              ? '400000'
              : { data: { objectId: params[0], version: '12', digest: 'digest-abc', type: 'memwal::Memory' } },
        }),
        text: async () => '{}',
      };
    });

    const body = await json(await GET(url('?proof=1')));
    expect(body.rows[0].blobUrl).toBe(
      'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/blob-conf-1'
    );
    expect(body.proofs).toHaveLength(1);
    expect(body.proofs[0]).toMatchObject({ memkey: '2026-10', version: 1, blobId: 'blob-conf-1' });
    expect(body.proofs[0].onchain.exists).toBe(true);
    expect(body.proofs[0].onchain.render).toContain(`object=${OWNER}@12 · digest=digest-abc`);
    expect(body.proofs[0].onchain.render).toContain('mainnet');
  });

  it('reports an unconfirmed write as unproven, never as absent', async () => {
    await setConfigured();
    process.env.TATUM_API_KEY = 'tatum-test-key';
    // Claimed but never confirmed: the relayer accepted the job, no blob came
    // back. `exists: false` would claim the chain contradicts us.
    await seedRung({
      kind: 'analyst',
      key: '0xdeadbeef',
      version: 1,
      text: 'analyst 0xdeadbeef v=1 as_of=2026-10-21T00:00:00Z n=40 brier=0.2000 hit=0.6000 source=db:agent_forecasts',
      blobId: null,
      owner: null,
    });

    const body = await json(await GET(url('?proof=1')));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(body.proofs[0].onchain.exists).toBeNull();
    expect(body.proofs[0].onchain.reason).toMatch(/no owner object id/);
  });

  it('stays answerable when Tatum is unconfigured', async () => {
    await setConfigured();
    await seedRung({
      kind: 'window',
      key: '2026-09',
      version: 2,
      text: windowText('2026-09', 2),
      blobId: 'blob-conf-2',
      owner: OWNER,
    });

    const body = await json(await GET(url('?proof=1')));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(body.proofs[0].onchain.exists).toBeNull();
    expect(body.proofs[0].onchain.reason).toMatch(/TATUM_API_KEY is not set/);
  });
});
