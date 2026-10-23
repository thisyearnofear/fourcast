import { describe, it, expect, vi } from 'vitest';
import { deriveOutcome, sweepResolve, pickEventCandidate, fetchShortHorizonPolymarket } from '../scripts/forecast-and-resolve.mjs';

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

describe('pickEventCandidate', () => {
  const NOW = Date.parse('2026-10-23T12:00:00Z');
  const inDays = (d) => new Date(NOW + d * 86400000).toISOString();
  const mkt = (over) => ({
    id: 'm1',
    question: 'Raptors vs. Wizards',
    outcomes: '["Raptors","Wizards"]',
    outcomePrices: '["0.745","0.255"]',
    volume24hr: 500000,
    closed: false,
    active: true,
    endDate: inDays(1),
    ...over,
  });
  const ev = (markets, over = {}) => ({ title: 'Raptors vs. Wizards', category: 'Sports', markets, ...over });

  it('picks the highest-volume eligible binary market in an event', () => {
    const moneyline = mkt({});
    const prop = mkt({ id: 'm2', question: 'Odd/Even Score', outcomes: '["Odd","Even"]', volume24hr: 10 });
    const c = pickEventCandidate(ev([prop, moneyline]), { now: NOW });
    expect(c.marketID).toBe('m1');
    expect(c.currentOdds).toEqual({ yes: 0.745, no: 0.255 });
    expect(c.platform).toBe('polymarket');
  });

  it('states which side YES means for non-Yes/No outcomes', () => {
    const c = pickEventCandidate(ev([mkt({})]), { now: NOW });
    expect(c.description).toContain('YES side is "Raptors"');
    expect(c.title).toBe('Raptors vs. Wizards');
  });

  it('leaves the description alone for Yes/No outcomes', () => {
    const c = pickEventCandidate(ev([mkt({ outcomes: '["Yes","No"]', question: 'Q?' })]), { now: NOW });
    expect(c.description ?? '').not.toContain('YES side');
  });

  it('rejects markets with terminal prices (already decided but unclosed)', () => {
    const done = mkt({ outcomePrices: '["0","1"]' });
    expect(pickEventCandidate(ev([done]), { now: NOW })).toBeNull();
  });

  it('rejects non-binary, closed, inactive, undated and out-of-window markets', () => {
    expect(pickEventCandidate(ev([mkt({ outcomes: '["A","B","C"]', outcomePrices: '["0.3","0.3","0.4"]' })]), { now: NOW })).toBeNull();
    expect(pickEventCandidate(ev([mkt({ closed: true })]), { now: NOW })).toBeNull();
    expect(pickEventCandidate(ev([mkt({ active: false })]), { now: NOW })).toBeNull();
    expect(pickEventCandidate(ev([mkt({ endDate: null })]), { now: NOW })).toBeNull();
    expect(pickEventCandidate(ev([mkt({ endDate: inDays(-1) })]), { now: NOW })).toBeNull();
    expect(pickEventCandidate(ev([mkt({ endDate: inDays(30) })]), { now: NOW, maxDaysOut: 14 })).toBeNull();
  });

  it('enforces minVolume and falls back to event endDate', () => {
    expect(pickEventCandidate(ev([mkt({ volume24hr: 100 })]), { now: NOW, minVolume: 2000 })).toBeNull();
    const c = pickEventCandidate(ev([mkt({ endDate: null })], { endDate: inDays(3) }), { now: NOW });
    expect(c.resolutionDate).toBe(inDays(3));
  });

  it('returns null for events without a markets array', () => {
    expect(pickEventCandidate({}, { now: NOW })).toBeNull();
    expect(pickEventCandidate(null, { now: NOW })).toBeNull();
  });
});

describe('fetchShortHorizonPolymarket', () => {
  const NOW = Date.parse('2026-10-23T12:00:00Z');
  const event = (id) => ({
    id,
    title: `Event ${id}`,
    markets: [{
      id: `m-${id}`, question: `Q ${id}?`, outcomes: '["Yes","No"]',
      outcomePrices: '["0.6","0.4"]', volume24hr: 50000,
      closed: false, active: true,
      endDate: new Date(NOW + 86400000).toISOString(),
    }],
  });

  it('requests events ending inside the window and returns one candidate per event', async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      return { ok: true, json: async () => [event('a'), event('b'), { id: 'empty' }] };
    };
    const out = await fetchShortHorizonPolymarket({ maxDaysOut: 7, now: NOW, fetchImpl });
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.marketID)).toEqual(['m-a', 'm-b']);
    expect(urls[0]).toContain('end_date_max=');
    expect(urls[0]).toContain('closed=false');
    const endMax = decodeURIComponent(urls[0].match(/end_date_max=([^&]+)/)[1]);
    expect(Date.parse(endMax)).toBe(NOW + 7 * 86400000);
  });

  it('returns [] when the response is not an array', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ error: 'bad' }) });
    expect(await fetchShortHorizonPolymarket({ now: NOW, fetchImpl })).toEqual([]);
  });
});
