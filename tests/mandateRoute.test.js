import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST, GET } from '../app/api/agent/mandate/route';
import { db, migrationsReady } from '../services/db';

function mockPostRequest(body) {
  return {
    json: async () => body,
    headers: new Map(),
    url: 'http://localhost/api/agent/mandate',
  };
}

function mockGetRequest(operatorId) {
  return {
    url: `http://localhost/api/agent/mandate?operatorId=${encodeURIComponent(operatorId)}`,
    headers: new Map(),
  };
}

describe('POST /api/agent/mandate', () => {
  beforeAll(async () => {
    await migrationsReady;
  });

  // NOTE: do not close db in afterAll here — the GET describe block below
  // reuses the same module-level db instance.

  it('saves a valid mandate and returns a fresh operatorId + trackRecordUrl', async () => {
    const res = await POST(
      mockPostRequest({
        minAbsoluteEdge: 0.05,
        maxAllocationPct: 0.03,
        maxLossProbability: 0.75,
        simulationRuns: 10_000,
      }),
    );
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.operatorId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(json.trackRecordUrl).toBe(`/agent/${json.operatorId}`);
    expect(json.updatedAt).toBeTypeOf('number');
  });

  it('reuses the provided operatorId on subsequent saves', async () => {
    const operatorId = '11111111-1111-1111-1111-111111111111';
    const res = await POST(
      mockPostRequest({
        operatorId,
        minAbsoluteEdge: 0.07,
        maxAllocationPct: 0.025,
        maxLossProbability: 0.7,
        simulationRuns: 5000,
      }),
    );
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.operatorId).toBe(operatorId);
  });

  it('rejects missing policy knobs with 400', async () => {
    const res = await POST(mockPostRequest({ minAbsoluteEdge: 0.05 }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('rejects out-of-range values with 400', async () => {
    const res = await POST(
      mockPostRequest({
        minAbsoluteEdge: 2, // > 1
        maxAllocationPct: 0.03,
        maxLossProbability: 0.75,
        simulationRuns: 10_000,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('ignores a malformed operatorId and mints a fresh UUID', async () => {
    const res = await POST(
      mockPostRequest({
        operatorId: 'not-a-uuid',
        minAbsoluteEdge: 0.05,
        maxAllocationPct: 0.03,
        maxLossProbability: 0.75,
        simulationRuns: 10_000,
      }),
    );
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.operatorId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(json.operatorId).not.toBe('not-a-uuid');
  });
});

describe('GET /api/agent/mandate', () => {
  beforeAll(async () => {
    await migrationsReady;
  });

  afterAll(() => {
    try { db.close(); } catch (_) { /* ignore */ }
  });

  it('returns the mandate for a known operatorId', async () => {
    const operatorId = '22222222-2222-2222-2222-222222222222';
    await POST(
      mockPostRequest({
        operatorId,
        minAbsoluteEdge: 0.08,
        maxAllocationPct: 0.04,
        maxLossProbability: 0.65,
        simulationRuns: 8000,
        displayName: 'Test GET Operator',
      }),
    );
    const res = await GET(mockGetRequest(operatorId));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.mandate).not.toBeNull();
    expect(json.mandate.operatorId).toBe(operatorId);
    expect(json.mandate.minAbsoluteEdge).toBe(0.08);
    expect(json.mandate.displayName).toBe('Test GET Operator');
  });

  it('returns { mandate: null } for an unknown operatorId', async () => {
    const unknown = '33333333-3333-3333-3333-333333333333';
    const res = await GET(mockGetRequest(unknown));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.mandate).toBeNull();
  });

  it('rejects a missing operatorId with 400', async () => {
    const res = await GET({ url: 'http://localhost/api/agent/mandate', headers: new Map() });
    expect(res.status).toBe(400);
  });
});
