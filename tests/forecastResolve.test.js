import { describe, it, expect, vi } from 'vitest';
import { deriveOutcome, sweepResolve } from '../scripts/forecast-and-resolve.mjs';

const pm = (over) => ({
  id: '1',
  closed: true,
  umaResolutionStatus: 'resolved',
  outcomes: '["Yes","No"]',
  outcomePrices: '["1","0"]',
  ...over,
});

describe('deriveOutcome — polymarket', () => {
  it('resolves [1,0] to outcome 1', () => {
    expect(deriveOutcome('polymarket', pm({}))).toEqual({ outcome: 1, label: 'Yes' });
  });

  it('resolves [0,1] to outcome 0', () => {
    expect(deriveOutcome('polymarket', pm({ outcomePrices: '["0","1"]' }))).toEqual({ outcome: 0, label: 'No' });
  });

  it('accepts real arrays as well as JSON-encoded strings', () => {
    expect(deriveOutcome('polymarket', pm({ outcomes: ['Yes', 'No'], outcomePrices: [0, 1] }))).toEqual({ outcome: 0, label: 'No' });
  });

  it('skips 0.5/0.5 and any other ambiguous price pair', () => {
    expect(deriveOutcome('polymarket', pm({ outcomePrices: '["0.5","0.5"]' })).skip).toMatch(/ambiguous/);
    expect(deriveOutcome('polymarket', pm({ outcomePrices: '["0.9","0.1"]' })).skip).toMatch(/ambiguous/);
  });

  it('skips markets that are not closed', () => {
    expect(deriveOutcome('polymarket', pm({ closed: false }))).toEqual({ skip: 'not closed' });
  });

  it('skips when umaResolutionStatus is not resolved', () => {
    expect(deriveOutcome('polymarket', pm({ umaResolutionStatus: 'proposed' })).skip).toMatch(/proposed/);
  });

  it('resolves any two-outcome market — outcome 1 means outcome[0] won', () => {
    expect(deriveOutcome('polymarket', pm({ outcomes: '["Over","Under"]', outcomePrices: '["0","1"]' })))
      .toEqual({ outcome: 0, label: 'Under' });
    expect(deriveOutcome('polymarket', pm({ outcomes: '["Lakers","Celtics"]', outcomePrices: '["1","0"]' })))
      .toEqual({ outcome: 1, label: 'Lakers' });
  });

  it('skips non-binary markets and mismatched shapes', () => {
    expect(deriveOutcome('polymarket', pm({ outcomes: '["A","B","C"]', outcomePrices: '["1","0","0"]' })).skip).toMatch(/two-outcome/);
    expect(deriveOutcome('polymarket', pm({ outcomes: '["Yes","No"]', outcomePrices: '["1","0","0"]' }))).toEqual({ skip: 'unparseable outcomePrices' });
    expect(deriveOutcome('polymarket', pm({ outcomes: '["","No"]', outcomePrices: '["1","0"]' })).skip).toMatch(/two-outcome/);
  });
});

describe('deriveOutcome — kalshi', () => {
  const k = (over) => ({ market: { ticker: 'T', status: 'finalized', result: 'yes', ...over } });

  it('resolves result "yes" to 1 and "no" to 0', () => {
    expect(deriveOutcome('kalshi', k({}))).toEqual({ outcome: 1, label: 'yes' });
    expect(deriveOutcome('kalshi', k({ result: 'no' }))).toEqual({ outcome: 0, label: 'no' });
  });

  it('accepts a bare market object (no {market} wrapper)', () => {
    expect(deriveOutcome('kalshi', { status: 'settled', result: 'yes' })).toEqual({ outcome: 1, label: 'yes' });
  });

  it('skips empty, void, or missing results', () => {
    expect(deriveOutcome('kalshi', k({ result: '' })).skip).toMatch(/result=/);
    expect(deriveOutcome('kalshi', k({ result: 'void' })).skip).toMatch(/result=/);
    expect(deriveOutcome('kalshi', k({ result: undefined })).skip).toMatch(/result=/);
  });

  it('skips markets whose status is not settled/finalized', () => {
    expect(deriveOutcome('kalshi', k({ status: 'open' }))).toEqual({ skip: 'status=open' });
    expect(deriveOutcome('kalshi', k({ status: 'closed' }))).toEqual({ skip: 'status=closed' });
  });
});

describe('deriveOutcome — unknown platform', () => {
  it('skips', () => {
    expect(deriveOutcome('txline', {}).skip).toMatch(/unknown platform/);
  });
});

describe('sweepResolve', () => {
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith('/pm-yes')
        ? pm({})
        : pm({ closed: false }),
  });

  // Real local sqlite (tests/setup.js points DATABASE_PATH at a temp file and
  // runs migrations on first import) — two unresolved forecasts, one resolvable.
  async function seed() {
    const { saveForecast, execute, migrationsReady } = await import('../services/db.js');
    await migrationsReady;
    // Shared per-process temp DB — start clean so each sweep sees exactly two rows.
    await execute(`DELETE FROM agent_forecasts`);
    await saveForecast({ id: 'f1', marketID: 'pm-yes', title: 'A', platform: 'polymarket', aiProbability: 0.7, marketOdds: 0.5, edge: 0.2, confidence: 'medium' });
    await saveForecast({ id: 'f2', marketID: 'pm-open', title: 'B', platform: 'polymarket', aiProbability: 0.3, marketOdds: 0.5, edge: -0.2, confidence: 'low' });
  }

  it('resolves only settled markets and triggers memory once', async () => {
    const { listUnresolvedForecasts, resolveForecast, query } = await import('../services/db.js');
    await seed();
    const remember = vi.fn(async () => ({ ok: true, written: [] }));
    const summary = await sweepResolve({
      dryRun: false,
      fetchImpl,
      listUnresolved: listUnresolvedForecasts,
      resolve: resolveForecast,
      remember,
      delayMs: 0,
      log: () => {},
    });
    expect(summary).toMatchObject({ markets: 2, resolved: 1, skipped: 1, failed: 0 });
    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith({ marketId: 'pm-yes', triggerReceipt: null });

    const rows = await query(`SELECT id, resolved, actual_outcome FROM agent_forecasts ORDER BY id`);
    expect(rows).toEqual([
      { id: 'f1', resolved: 1, actual_outcome: 1 },
      { id: 'f2', resolved: 0, actual_outcome: null },
    ]);
  });

  it('dry-run writes nothing', async () => {
    const { listUnresolvedForecasts, resolveForecast, query } = await import('../services/db.js');
    await seed();
    const remember = vi.fn();
    const summary = await sweepResolve({
      dryRun: true,
      fetchImpl,
      listUnresolved: listUnresolvedForecasts,
      resolve: resolveForecast,
      remember,
      delayMs: 0,
      log: () => {},
    });
    expect(summary.resolved).toBe(1);
    expect(remember).not.toHaveBeenCalled();
    const rows = await query(`SELECT COUNT(*) AS n FROM agent_forecasts WHERE resolved = 1`);
    expect(rows[0].n).toBe(0);
  });
});
