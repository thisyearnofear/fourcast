/**
 * The memory text contract.
 *
 * MemWal namespaces are flat and recall is fuzzy, so everything that makes a
 * memory addressable — the key, the version, the metrics — has to survive a
 * round trip through one line of text. These tests pin that round trip, and the
 * refusals that keep a half-written number off a ledger we cannot edit.
 */
import { describe, it, expect } from 'vitest';
import {
  NAMESPACES,
  MEMORY_SCHEMA,
  UNKNOWN,
  bucketField,
  buildIdempotencyKey,
  fieldBuckets,
  fieldValue,
  fieldNumber,
  formatMemory,
  namespaceFor,
  num,
  parseMemoryText,
  sha256Hex,
  sourceField,
} from '@/services/memory/memoryFormat.js';

describe('namespaces', () => {
  it('is exactly the four flat namespaces the entry advertises', () => {
    expect(Object.keys(NAMESPACES)).toEqual(['analyst', 'source', 'signal', 'window']);
    expect(namespaceFor('analyst')).toBe('fourcast.analyst');
  });

  it('refuses an unknown kind instead of defaulting into another namespace', () => {
    expect(() => namespaceFor('vibes')).toThrow(/Unknown memory kind/);
  });
});

describe('formatMemory / parseMemoryText round trip', () => {
  const candidate = {
    kind: 'analyst',
    key: '0xabc123',
    fields: {
      v: 7,
      as_of: '2026-10-21T00:00:00Z',
      n: '142',
      hit: '0.6338',
      brier: '0.1871',
      logloss: '0.5123',
      buckets: 'LOW:0.410/MED:0.580/HIGH:0.790',
      trigger_receipt: sha256Hex('receipt'),
      source: 'db:signals+agent_forecasts',
    },
    note: 'Analyst 0xabc123 was right 90 of 142 called verdicts.',
  };

  it('puts version and as-of first, then the metrics, so the header reads left to right', () => {
    const text = formatMemory(candidate);
    expect(text.split('\n')[0]).toBe(
      [
        'analyst 0xabc123',
        `v=${candidate.fields.v}`,
        `as_of=${candidate.fields.as_of}`,
        'n=142',
        'hit=0.6338',
        'brier=0.1871',
        'logloss=0.5123',
        'buckets=LOW:0.410/MED:0.580/HIGH:0.790',
        `trigger_receipt=${candidate.fields.trigger_receipt}`,
        'source=db:signals+agent_forecasts',
      ].join(' ')
    );
  });

  it('round-trips every field through the parse', () => {
    const parsed = parseMemoryText(formatMemory(candidate));
    expect(parsed.ok).toBe(true);
    expect(parsed.schema).toBe(MEMORY_SCHEMA);
    expect(parsed.kind).toBe('analyst');
    expect(parsed.key).toBe('0xabc123');
    expect(parsed.fields.n).toBe('142');
    expect(fieldNumber(parsed.fields, 'v')).toBe(7);
    expect(fieldValue(parsed.fields, 'as_of')).toBe('2026-10-21T00:00:00Z');
    expect(fieldBuckets(parsed.fields)).toEqual({ LOW: 0.41, MED: 0.58, HIGH: 0.79 });
    expect(parsed.note).toBe(candidate.note);
  });

  it('rejects a field value containing whitespace — the delimiter is not negotiable', () => {
    expect(() =>
      formatMemory({ kind: 'signal', key: 'x1', fields: { market_title: 'Man City vs Arsenal' } })
    ).toThrow(/may not contain whitespace/);
  });

  it('rejects a multi-line note rather than corrupting the header contract', () => {
    expect(() => formatMemory({ kind: 'window', key: '2026-10', fields: {}, note: 'a\nb' })).toThrow(
      /single line/
    );
  });

  it('reports an unparsable memory as unparsable, never as a partial record', () => {
    expect(parseMemoryText('').ok).toBe(false);
    expect(parseMemoryText('analyst').ok).toBe(false);
    expect(parseMemoryText('guru 0xabc v=1').ok).toBe(false);
    expect(parseMemoryText('analyst 0xabc broken').error).toMatch(/malformed field/);
  });

  it('keeps a header-only memory parseable when there is no note', () => {
    const parsed = parseMemoryText(formatMemory({ ...candidate, note: null }));
    expect(parsed.ok).toBe(true);
    expect(parsed.note).toBe(null);
  });
});

describe('metric encoding', () => {
  it('writes NA for a missing number instead of 0', () => {
    expect(num(null, 4)).toBe(UNKNOWN);
    expect(num(undefined, 4)).toBe(UNKNOWN);
    expect(num(NaN, 4)).toBe(UNKNOWN);
    expect(num(0, 4)).toBe('0.0000');
    expect(fieldValue({ hit: UNKNOWN }, 'hit')).toBe(null);
  });

  it('accepts both bucket shapes: calibration rows and an analyst map', () => {
    const rows = [
      { bucket: 'LOW', hitRate: 0.4, count: 5 },
      { bucket: 'HIGH', hit_rate: 0.79, count: 60 },
    ];
    const map = { LOW: { count: 5, hitRate: 0.4 }, HIGH: { count: 60, hitRate: 0.79 } };
    expect(bucketField(rows)).toBe('LOW:0.400/HIGH:0.790');
    expect(bucketField(map)).toBe('LOW:0.400/HIGH:0.790');
  });

  it('drops buckets whose hit rate is not a number rather than writing a fake 0', () => {
    expect(bucketField([{ bucket: 'MEDIUM', hitRate: null, count: 1 }])).toBe(UNKNOWN);
    expect(fieldBuckets({ buckets: UNKNOWN })).toBe(null);
    expect(fieldBuckets({ buckets: 'HIGH:banana' })).toBe(null);
  });

  it('flattens a venue or outcome breakdown into label:count pairs', () => {
    expect(sourceField([{ venue: 'polymarket', count: 9 }, { venue: 'kalshi', count: 3 }])).toBe(
      'polymarket:9/kalshi:3'
    );
    expect(sourceField([{ outcome: 'YES', count: 1 }])).toBe('YES:1');
    expect(sourceField([])).toBe(UNKNOWN);
  });
});

describe('idempotency', () => {
  const base = { kind: 'analyst', key: '0xabc', version: 3, contentHash: sha256Hex('facts') };

  it('is stable for identical facts so a retry collapses instead of appending', () => {
    expect(buildIdempotencyKey(base)).toBe(buildIdempotencyKey({ ...base }));
  });

  it('changes when version or content changes, so a real revision still appends', () => {
    expect(buildIdempotencyKey({ ...base, version: 4 })).not.toBe(buildIdempotencyKey(base));
    expect(buildIdempotencyKey({ ...base, contentHash: sha256Hex('other') })).not.toBe(
      buildIdempotencyKey(base)
    );
  });

  it('refuses a version below 1 — v0 would collide with "no version parsed"', () => {
    expect(() => buildIdempotencyKey({ ...base, version: 0 })).toThrow(/integer version/);
  });
});
