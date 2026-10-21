/**
 * WP3: a memory that is allowed to move position size.
 *
 * The relayer is mocked, but the numbers are not: one case seeds a real ledger,
 * builds the real memory text from it, writes it through the real store, and
 * reads it back on the sizing path. What these tests pin is the failure
 * direction — a stored rate with no visible sample size is refused, a thin
 * bucket is dropped rather than trusted, our own ledger always wins, and a
 * disabled or unreachable memory service returns null instead of throwing, so
 * the agent can still decide.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

const mock = vi.hoisted(() => ({
  calls: [],
  blobs: new Map(), // blob_id -> { text, namespace, created_at }
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
          if (existing) return { id: existing.id, blob_id: [...mock.blobs.keys()].find((k) => mock.blobs.get(k) === existing) };
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
        // A semantic search returns everything plausibly relevant; our parse step
        // is what decides what is true. Mocking it as a substring match would
        // test the mock, so this returns the whole namespace.
        async recall({ query, namespace }) {
          mock.calls.push({ op: 'recall', query, namespace });
          const results = [...mock.blobs.entries()]
            .filter(([, b]) => (namespace ? b.namespace === namespace : true))
            .map(([blob_id, b]) => ({ blob_id, text: b.text, distance: 0.1, created_at: b.created_at }));
          return { results, total: results.length };
        },
      };
      return client;
    },
  },
}));

import {
  execute,
  migrationsReady,
  resolveForecast,
  saveForecast,
} from '@/services/db.js';
import { collectMemoryCandidates } from '@/services/memory/ledgerMemory.js';
import { planMemory, writeMemory } from '@/services/memory/memoryStore.js';
import { namespaceFor, formatMemory, sha256Hex } from '@/services/memory/memoryFormat.js';
import { resetMemWalClient } from '@/services/memory/memwalClient.js';
import {
  getBucketCalibrationFromMemory,
  readSizingCalibration,
} from '@/services/memory/calibrationMemory.js';

const OPERATOR = `wp3-op-${crypto.randomUUID().slice(0, 8)}`;
const now = Math.floor(Date.now() / 1000);

/** Insert a window rung straight into the relayer, bypassing the ledger. */
function putRung({ month, version = 1, buckets, counts, asOf = null }) {
  const fields = {
    v: version,
    as_of: asOf || `${month}-28T00:00:00Z`,
    n: String((counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0)),
    brier: '0.1800',
    logloss: '0.5000',
    buckets: buckets ? Object.entries(buckets).map(([k, v]) => `${k}:${Number(v).toFixed(3)}`).join('/') : 'NA',
    bucket_n: counts ? Object.entries(counts).map(([k, v]) => `${k}:${v}`).join('/') : 'NA',
    source: 'db:agent_forecasts.monthly',
  };
  const text = formatMemory({ kind: 'window', key: month, fields, note: `Fixture rung ${month}` });
  const blob_id = `blob-${mock.blobs.size + 1}`;
  mock.blobs.set(blob_id, {
    id: crypto.randomUUID(),
    text,
    namespace: namespaceFor('window'),
    created_at: new Date().toISOString(),
  });
  return { blob_id, text };
}

async function seedResolved(month, count, { confidence, outcome, operator = OPERATOR }) {
  for (let i = 0; i < count; i += 1) {
    const id = `wp3-${month}-${confidence}-${outcome}-${i}-${crypto.randomUUID().slice(0, 6)}`;
    await saveForecast({
      id,
      marketID: id,
      title: `WP3 fixture ${id}`,
      platform: 'polymarket',
      aiProbability: outcome === 1 ? 0.9 : 0.8,
      marketOdds: 0.6,
      edge: 0.3,
      confidence,
      reasoning: 'fixture',
      keyFactors: [],
      timestamp: now,
      operatorId: operator,
    });
    await resolveForecast(id, outcome);
  }
}

const ENV_KEYS = [
  'FOURCAST_MEMORY_ENABLED',
  'MEMWAL_PRIVATE_KEY',
  'MEMWAL_ACCOUNT_ID',
  'MEMWAL_RELAYER_URL',
  'SUI_NETWORK',
  'FOURCAST_CALIBRATION_MIN_BUCKET',
];
const savedEnv = {};

describe('memory-derived calibration on the sizing path', () => {
  beforeEach(async () => {
    await migrationsReady;
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.FOURCAST_MEMORY_ENABLED = 'true';
    process.env.MEMWAL_PRIVATE_KEY = '0x' + 'ab'.repeat(32);
    process.env.MEMWAL_ACCOUNT_ID = `acct-${crypto.randomUUID().slice(0, 8)}`;
    delete process.env.MEMWAL_RELAYER_URL;
    delete process.env.SUI_NETWORK;
    delete process.env.FOURCAST_CALIBRATION_MIN_BUCKET;
    mock.calls.length = 0;
    mock.blobs.clear();
    resetMemWalClient();
    await execute('DELETE FROM memory_writes', []);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    resetMemWalClient();
  });

  it('round-trips a real ledger into a memory the sizer can read', async () => {
    await seedResolved('current', 12, { confidence: 'HIGH', outcome: 1 });
    await seedResolved('current', 8, { confidence: 'MEDIUM', outcome: 0 });

    const { candidates } = await collectMemoryCandidates({ kinds: ['window'], minSamples: 20, operatorId: OPERATOR });
    expect(candidates.length).toBe(1);
    // The counts travel with the rates: without them the reader would have no
    // way to apply the evidence floor, which is the whole point.
    expect(candidates[0].fields.bucket_n).toContain('HIGH:12');

    const written = await writeMemory(candidates[0], { dryRun: false });
    expect(written.ok).toBe(true);
    expect(written.blobId).toBeTruthy();

    // A cold deployment: this operator id has no rows, so the DB path is empty
    // and the memory is what sizes the next decision.
    const sizing = await readSizingCalibration({ operatorId: 'an-operator-with-no-rows' });
    expect(sizing.calibrationSource).toBe('walrus-memory');
    expect(sizing.bucketCalibration.HIGH).toBeCloseTo(1, 5);
    expect(sizing.schema).toBe('calibration/memory-window/v1');
    expect(sizing.memory.blobId).toBe(written.blobId);
    expect(sizing.memory.textHash).toBe(sha256Hex(written.text));
    expect(sizing.memory.asOf).toBe(candidates[0].asOf);
    expect(sizing.memory.counts.HIGH).toBe(12);
  });

  it('prefers our own ledger over any stored snapshot', async () => {
    await seedResolved('current', 12, { confidence: 'HIGH', outcome: 1 });
    putRung({ month: '2099-12', buckets: { HIGH: 0.01 }, counts: { HIGH: 500 } });

    const sizing = await readSizingCalibration({ operatorId: OPERATOR });
    // A future rung would say HIGH is worth 0.01; the live ledger says 1.0 and
    // must win, otherwise a planted memory could shrink or inflate positions.
    expect(sizing.calibrationSource).toBe('db');
    expect(sizing.memory).toBeNull();
    expect(sizing.bucketCalibration.HIGH).toBeCloseTo(1, 5);
  });

  it('refuses bucket rates that arrive without their sample sizes', async () => {
    putRung({ month: '2026-10', buckets: { HIGH: 0.95 }, counts: null });
    expect(await getBucketCalibrationFromMemory()).toBeNull();
  });

  it('drops thin buckets and keeps the ones with evidence', async () => {
    putRung({
      month: '2026-10',
      buckets: { HIGH: 0.9, LOW: 1.0 },
      counts: { HIGH: 20, LOW: 2 },
    });
    const memory = await getBucketCalibrationFromMemory();
    expect(Object.keys(memory.buckets)).toEqual(['HIGH']);
    expect(memory.droppedBuckets).toEqual([{ bucket: 'LOW', count: 2 }]);
    expect(memory.sampleSize).toBe(22);
  });

  it('walks back to an older rung when the newest one is all thin evidence', async () => {
    putRung({ month: '2026-10', buckets: { HIGH: 0.9 }, counts: { HIGH: 1 } });
    putRung({ month: '2026-09', buckets: { HIGH: 0.7 }, counts: { HIGH: 40 } });

    const memory = await getBucketCalibrationFromMemory();
    expect(memory.key).toBe('2026-09');
    expect(memory.buckets.HIGH).toBeCloseTo(0.7, 5);
  });

  it('takes the newest month first', async () => {
    putRung({ month: '2026-08', buckets: { HIGH: 0.4 }, counts: { HIGH: 30 } });
    putRung({ month: '2026-10', buckets: { HIGH: 0.8 }, counts: { HIGH: 30 } });
    const memory = await getBucketCalibrationFromMemory();
    expect(memory.key).toBe('2026-10');
    expect(memory.buckets.HIGH).toBeCloseTo(0.8, 5);
  });

  it('returns null rather than throwing when memory is switched off', async () => {
    putRung({ month: '2026-10', buckets: { HIGH: 0.8 }, counts: { HIGH: 30 } });
    process.env.FOURCAST_MEMORY_ENABLED = 'false';
    resetMemWalClient();
    expect(await getBucketCalibrationFromMemory()).toBeNull();

    const sizing = await readSizingCalibration({ operatorId: 'an-operator-with-no-rows' });
    expect(sizing.calibrationSource).toBe('db');
    expect(sizing.bucketCalibration).toBeNull();
  });

  it('fails closed on a rung whose header does not parse', async () => {
    mock.blobs.set('blob-garbage', {
      id: crypto.randomUUID(),
      text: 'this is not a fourcast memory header',
      namespace: namespaceFor('window'),
      created_at: new Date().toISOString(),
    });
    putRung({ month: '2026-10', buckets: { HIGH: 0.8 }, counts: { HIGH: 30 } });
    const memory = await getBucketCalibrationFromMemory();
    expect(memory.key).toBe('2026-10');
  });

  it('plans a version that the store can read back as the same facts', async () => {
    const plan = planMemory(
      {
        kind: 'window',
        key: '2026-10',
        asOf: '2026-10-28T00:00:00Z',
        fields: { n: '20', brier: '0.1800', logloss: '0.5000', buckets: 'HIGH:0.800', bucket_n: 'HIGH:20', source: 'db:agent_forecasts.monthly' },
        note: 'Fixture',
      },
      { version: 3 }
    );
    expect(plan.text).toMatch(/^window 2026-10 v=3 as_of=2026-10-28T00:00:00Z/);
    mock.blobs.set('blob-planned', {
      id: crypto.randomUUID(),
      text: plan.text,
      namespace: plan.namespace,
      created_at: new Date().toISOString(),
    });
    const memory = await getBucketCalibrationFromMemory();
    expect(memory.version).toBe(3);
    expect(memory.buckets.HIGH).toBeCloseTo(0.8, 5);
  });
});
