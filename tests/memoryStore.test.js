/**
 * The memory store: write, ladder read, ledger, reconciliation, trigger.
 *
 * The relayer is mocked — what these tests pin is OUR logic: that a dry run
 * touches nothing, that identical facts are refused rather than appended, that
 * the version ladder counts on-chain rungs (not just local rows) and filters
 * fuzzy recall down to the exact key, that the local ledger and the relayer
 * inventory can be diffed, and that a resolution trigger can never break a
 * resolution.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

const mock = vi.hoisted(() => ({
  calls: [],
  blobs: new Map(), // blob_id -> { text, namespace, created_at, idempotencyKey }
}));

vi.mock('@mysten-incubation/memwal', () => ({
  MemWal: {
    create(config) {
      const client = {
        config,
        destroyed: false,
        destroy() {
          client.destroyed = true;
        },
        async rememberAndWait(text, namespace, options = {}) {
          mock.calls.push({ op: 'remember', text, namespace, options });
          const existing = [...mock.blobs.values()].find((b) => b.idempotencyKey === options.idempotencyKey);
          if (existing) return { id: existing.id, blob_id: existing.blob_id, owner: existing.owner, namespace };
          const id = crypto.randomUUID();
          const blob_id = `blob-${mock.blobs.size + 1}`;
          mock.blobs.set(blob_id, {
            id,
            idempotencyKey: options.idempotencyKey,
            text,
            namespace,
            owner: `owner-of-${config.accountId}`,
            created_at: new Date().toISOString(),
          });
          return { id, blob_id, owner: `owner-of-${config.accountId}`, namespace };
        },
        async recall({ query, namespace }) {
          mock.calls.push({ op: 'recall', query, namespace });
          const results = [...mock.blobs.entries()]
            .filter(([, b]) => (namespace ? b.namespace === namespace : true))
            .filter(([, b]) => b.text.includes(String(query)))
            .map(([blob_id, b]) => ({ blob_id, text: b.text, distance: 0.1, created_at: b.created_at }));
          return { results, total: results.length };
        },
        async listMemories() {
          mock.calls.push({ op: 'listMemories' });
          return {
            memories: [...mock.blobs.entries()].map(([blob_id, b]) => ({
              memory_id: b.id,
              namespace_id: b.namespace,
              blob_id,
              created_at: b.created_at,
              updated_at: b.created_at,
              size: b.text.length,
            })),
            next_cursor: null,
            has_more: false,
            deleted: [],
          };
        },
      };
      return client;
    },
  },
}));

import {
  getClient,
  memoryStatus,
  resetMemWalClient,
} from '@/services/memory/memwalClient.js';
import {
  writeMemory,
  latestMemory,
  listMemoryLadder,
  reconcileLedger,
  planMemory,
  factsDigest,
} from '@/services/memory/memoryStore.js';
import { memoryLedgerSummary, listMemoryWrites } from '@/services/memory/writeLedger.js';
import { rememberResolution } from '@/services/memory/resolutionTrigger.js';
import { buildSignalMemory } from '@/services/memory/ledgerMemory.js';
import { migrationsReady, saveForecast, resolveForecast, execute } from '@/services/db.js';

const CANDIDATE = {
  kind: 'analyst',
  key: '0xabc',
  asOf: '2026-10-21T00:00:00Z',
  fields: { n: '142', hit: '0.6338', brier: '0.1871', buckets: 'HIGH:0.790' },
  note: 'Analyst 0xabc was right 90 of 142 called verdicts.',
  evidenceSource: 'db:signals+agent_forecasts',
  triggerReceipt: 'a'.repeat(64),
};

function enableMemory(overrides = {}) {
  process.env.FOURCAST_MEMORY_ENABLED = 'true';
  process.env.MEMWAL_PRIVATE_KEY = '0x' + '11'.repeat(32);
  process.env.MEMWAL_ACCOUNT_ID = 'acct-test';
  process.env.SUI_NETWORK = 'mainnet';
  delete process.env.MEMWAL_RELAYER_URL;
  Object.assign(process.env, overrides);
  resetMemWalClient();
}

beforeEach(async () => {
  mock.calls.length = 0;
  mock.blobs.clear();
  enableMemory();
  await migrationsReady;
  // The temp DB is shared for the whole process, so the append-only ledger has
  // to be emptied by hand or every test inherits the last one's versions.
  await execute('DELETE FROM memory_writes', []);
});

afterEach(() => {
  delete process.env.FOURCAST_MEMORY_ENABLED;
  delete process.env.MEMWAL_PRIVATE_KEY;
  delete process.env.MEMWAL_ACCOUNT_ID;
  delete process.env.SUI_NETWORK;
  resetMemWalClient();
});

describe('config guard', () => {
  it('is not writable without the opt-in flag, and says why', () => {
    delete process.env.FOURCAST_MEMORY_ENABLED;
    const status = memoryStatus();
    expect(status.configured).toBe(true);
    expect(status.writable).toBe(false);
    expect(status.reason).toMatch(/FOURCAST_MEMORY_ENABLED/);
  });

  it('returns a null client when unconfigured instead of throwing', async () => {
    delete process.env.MEMWAL_PRIVATE_KEY;
    expect(await getClient()).toBe(null);
    expect(memoryStatus().writable).toBe(false);
  });

  it('THROWS rather than mixing testnet credentials with the mainnet relayer', async () => {
    process.env.SUI_NETWORK = 'testnet';
    await expect(getClient()).rejects.toMatchObject({ code: 'MEMORY_NETWORK_MISMATCH' });
    expect(memoryStatus().reason).toMatch(/Refusing to mix Sui networks/);
  });

  it('accepts a testnet relayer when the network is genuinely testnet', async () => {
    process.env.SUI_NETWORK = 'testnet';
    process.env.MEMWAL_RELAYER_URL = 'https://relayer.testnet.memory.walrus.xyz';
    expect(await getClient()).toBeTruthy();
  });

  it('destroys the previous client when the delegate key rotates', async () => {
    const first = await getClient();
    process.env.MEMWAL_PRIVATE_KEY = '0x' + '22'.repeat(32);
    const second = await getClient();
    expect(second).not.toBe(first);
    expect(first.destroyed).toBe(true);
  });
});

describe('writeMemory', () => {
  it('dry run plans the append and touches neither the relayer nor the ledger', async () => {
    const result = await writeMemory(CANDIDATE);
    expect(result.dryRun).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.namespace).toBe('fourcast.analyst');
    expect(result.version).toBe(1);
    expect(result.text).toContain('analyst 0xabc v=1 as_of=2026-10-21T00:00:00Z n=142');
    expect(mock.calls.filter((c) => c.op === 'remember')).toEqual([]);
    expect(await listMemoryWrites({ kind: 'analyst' })).toEqual([]);
  });

  it('writes once, names the namespace positionally, and records the blob', async () => {
    const result = await writeMemory(CANDIDATE, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(result.blobId).toBe('blob-1');
    const call = mock.calls.find((c) => c.op === 'remember');
    expect(call.namespace).toBe('fourcast.analyst');
    expect(call.options.idempotencyKey).toMatch(/^[0-9a-f]{64}$/);

    const rows = await listMemoryWrites({ kind: 'analyst', memkey: '0xabc' });
    expect(rows).toHaveLength(1);
    expect(rows[0].blob_id).toBe('blob-1');
    expect(rows[0].trigger_receipt).toBe(CANDIDATE.triggerReceipt);
    expect(rows[0].evidence_source).toBe('db:signals+agent_forecasts');
    expect((await memoryLedgerSummary()).mainnetConfirmed).toBe(1);
  });

  it('refuses to append a rung whose facts did not move', async () => {
    await writeMemory(CANDIDATE, { dryRun: false });
    const head = await latestMemory('analyst', '0xabc');
    const again = await writeMemory(CANDIDATE, { dryRun: false, knownLatest: head });
    expect(again.skipped).toBe(true);
    expect(again.reason).toMatch(/unchanged since v1/);
    expect(mock.blobs.size).toBe(1);
  });

  it('bumps the version when the ledger moved, and keeps both rungs', async () => {
    await writeMemory(CANDIDATE, { dryRun: false });
    const refreshed = { ...CANDIDATE, fields: { ...CANDIDATE.fields, n: '150', hit: '0.6600' } };
    const second = await writeMemory(refreshed, { dryRun: false });
    expect(second.version).toBe(2);

    const ladder = await listMemoryLadder('analyst', '0xabc');
    expect(ladder.map((r) => r.version)).toEqual([2, 1]);
    expect(ladder[0].fields.n).toBe('150');
    expect(ladder[1].fields.n).toBe('142');
  });

  it('starts from the on-chain ladder when the local ledger is empty on this box', async () => {
    // Another machine already wrote v1..v3; our DB knows nothing about them.
    for (const v of [1, 2, 3]) {
      mock.blobs.set(`blob-pre-${v}`, {
        id: `mem-${v}`,
        idempotencyKey: `pre-${v}`,
        namespace: 'fourcast.analyst',
        owner: 'owner-of-acct-test',
        created_at: new Date().toISOString(),
        text: `analyst 0xabc v=${v} as_of=2026-10-0${v}T00:00:00Z n=${100 + v} hit=0.6000 brier=0.1900 buckets=HIGH:0.790`,
      });
    }
    const planned = await writeMemory(CANDIDATE, { dryRun: true });
    expect(planned.version).toBe(4);
  });
});

describe('ladder read is deterministic, not fuzzy', () => {
  beforeEach(async () => {
    enableMemory();
    await writeMemory(CANDIDATE, { dryRun: false });
    await writeMemory({ ...CANDIDATE, fields: { ...CANDIDATE.fields, n: '150' } }, { dryRun: false });
    // A neighbour key that fuzzy recall also matches, and junk that must not
    // be coerced into a partial credibility record.
    mock.blobs.set('blob-noise-1', {
      id: 'n1',
      namespace: 'fourcast.analyst',
      owner: 'owner-of-acct-test',
      created_at: new Date().toISOString(),
      text: 'analyst 0xabcdef v=99 as_of=2026-10-20T00:00:00Z n=1 hit=1.0000',
    });
    mock.blobs.set('blob-noise-2', {
      id: 'n2',
      namespace: 'fourcast.analyst',
      owner: 'owner-of-acct-test',
      created_at: new Date().toISOString(),
      text: 'analyst 0xabc this line is not a header',
    });
  });

  it('keeps only exact key matches and orders newest first', async () => {
    const ladder = await listMemoryLadder('analyst', '0xabc');
    expect(ladder.map((r) => r.version)).toEqual([2, 1]);
    expect(ladder.every((r) => r.key !== '0xabcdef')).toBe(true);
    expect(ladder.every((r) => !r.text.includes('not a header'))).toBe(true);
  });

  it('reads the head as the truth for that key', async () => {
    const head = await latestMemory('analyst', '0xabc');
    expect(head.version).toBe(2);
    expect(head.fields.n).toBe('150');
    expect(head.blobId).toBe('blob-2');
    expect(head.contentHash).toBe(factsDigest({ ...CANDIDATE, fields: { ...CANDIDATE.fields, n: '150' } }));
  });

  it('fails closed to an empty ladder when the relayer errors', async () => {
    const broken = { recall: async () => { throw new Error('relayer 503'); } };
    expect(await listMemoryLadder('analyst', '0xabc', { client: broken })).toEqual([]);
  });
});

describe('reconcileLedger', () => {
  it('reports blobs the relayer lists that we never recorded, and vice versa', async () => {
    const written = await writeMemory(CANDIDATE, { dryRun: false });
    mock.blobs.set('blob-unexplained', {
      id: 'x',
      namespace: 'fourcast.signal',
      owner: 'owner-of-acct-test',
      created_at: new Date().toISOString(),
      text: 'signal ghost v=1 as_of=2026-10-01T00:00:00Z',
    });

    const rec = await reconcileLedger();
    expect(rec.ok).toBe(true);
    expect(rec.matched).toBe(1);
    expect(rec.relayerOnly).toEqual(['blob-unexplained']);
    expect(rec.ledgerOnly).toEqual([]);
    expect(rec.byNamespace['fourcast.analyst']).toBe(1);
    expect(written.blobId).toBe('blob-1');
  });

  it('is skipped, not failed, when memory is not configured', async () => {
    delete process.env.MEMWAL_PRIVATE_KEY;
    const rec = await reconcileLedger();
    expect(rec.ok).toBe(false);
    expect(rec.skipped).toBe(true);
  });
});

describe('rememberResolution', () => {
  const OPERATOR = crypto.randomUUID();

  async function seedMarket(marketId, { aiProbability = 0.82, outcome = 1 } = {}) {
    const saved = await saveForecast({
      id: crypto.randomUUID(),
      marketID: marketId,
      title: `Arsenal ${marketId}`,
      platform: 'polymarket',
      aiProbability,
      marketOdds: 0.7,
      edge: aiProbability - 0.7,
      confidence: 'HIGH',
      reasoning: 'memory trigger fixture',
      keyFactors: [],
      timestamp: Math.floor(Date.now() / 1000),
      operatorId: OPERATOR,
    });
    expect(saved.success).toBe(true);
    const resolved = await resolveForecast(marketId, outcome);
    expect(resolved.success).toBe(true);
    return marketId;
  }

  it('never throws and never writes when memory is off', async () => {
    const marketId = await seedMarket(`mem-off-${crypto.randomUUID().slice(0, 6)}`);
    delete process.env.FOURCAST_MEMORY_ENABLED;
    const result = await rememberResolution({ marketId });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(mock.calls.filter((c) => c.op === 'remember')).toEqual([]);
  });

  it('writes the resolved observation as a signal memory, cited to its receipt', async () => {
    const marketId = `mem-on-${crypto.randomUUID().slice(0, 6)}`;
    await seedMarket(marketId);
    const receipt = 'b'.repeat(64);
    const result = await rememberResolution({ marketId, triggerReceipt: receipt });

    const signal = result.written.find((w) => w.kind === 'signal');
    expect(signal).toBeTruthy();
    const head = await latestMemory('signal', signal.key);
    expect(head.fields.outcome).toBe('1');
    expect(head.fields.p).toBe('0.8200');

    const rows = await listMemoryWrites({ kind: 'signal', memkey: signal.key });
    expect(rows[0].trigger_receipt).toBe(receipt);
  });

  it('says so when a market has no resolved rows', async () => {
    const result = await rememberResolution({ marketId: 'never-seen' });
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/no resolved rows/);
  });

  it('builds a signal memory only from a recorded 0/1 outcome', () => {
    expect(buildSignalMemory({ id: 'x1', actual_outcome: 0.5 }).skip).toMatch(/not a recorded/);
    expect(buildSignalMemory({ id: 'x2', actual_outcome: 1 }).kind).toBe('signal');
  });
});

describe('planMemory', () => {
  it('binds the idempotency key to the content hash so a retry collapses', () => {
    const a = planMemory(CANDIDATE, { version: 4 });
    const b = planMemory(CANDIDATE, { version: 4 });
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.textSha256).toBe(b.textSha256);
    expect(planMemory(CANDIDATE, { version: 5 }).idempotencyKey).not.toBe(a.idempotencyKey);
  });
});
