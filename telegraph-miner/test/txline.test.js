/**
 * TxLINE client behaviour measured on the live free tier (2026-09-28):
 *  - the fixture snapshot is ~29 MB, so it must be fetched once and cached
 *  - score snapshots for fixtures outside the tier answer 403
 *    "Bundle access denied", which must not read as "scheduled"
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.TXLINE_API_TOKEN = 'test-token';
process.env.TXLINE_GUEST_JWT = 'test-jwt';

const HOUR = 3_600_000;
const FIXTURES = [
  { FixtureId: 1, Competition: 'Test League', Participant1: 'Alpha FC', Participant2: 'Beta FC', StartTime: Date.now() - 5 * HOUR, Extra: 'x'.repeat(50) },
];

let calls = { fixtures: 0, scores: 0 };
let realFetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('/fixtures/snapshot')) {
      calls.fixtures++;
      await new Promise((r) => setTimeout(r, 20));
      return json(FIXTURES);
    }
    if (u.includes('/scores/snapshot/')) {
      calls.scores++;
      return new Response('Bundle access denied and no tickets held for fixture 1', { status: 403 });
    }
    if (u.includes('site.api.espn.com')) return json({ events: [], sports: [{ leagues: [{ teams: [] }] }] });
    return json({}, 404);
  };
});
after(() => {
  globalThis.fetch = realFetch;
});

const { getFixtures } = await import('../src/txline.js');
const { handleSportsScore } = await import('../src/intents/sportsScore.js');
const { handleGameResult } = await import('../src/intents/gameResult.js');

describe('TxLINE fixture snapshot', () => {
  it('fetches once for concurrent and repeated callers, and keeps only the fields used', async () => {
    calls = { fixtures: 0, scores: 0 };
    const [a, b] = await Promise.all([getFixtures(), getFixtures()]);
    const c = await getFixtures();
    assert.equal(calls.fixtures, 1);
    assert.equal(a, b);
    assert.equal(a, c);
    assert.equal(a[0].Participant1, 'Alpha FC');
    assert.equal(a[0].Extra, undefined);
  });
});

describe('TxLINE tier without score access', () => {
  it('SPORTS_SCORE does not report an inaccessible fixture as scheduled', async () => {
    const out = await handleSportsScore({ fixture_id: '1' });
    assert.equal(out.answer, null);
    assert.equal(out.metadata.error, 'txline_no_access');
  });

  it('GAME_RESULT falls through to the next source instead of stopping', async () => {
    const out = await handleGameResult({ team: 'Alpha FC' });
    assert.equal(out.answer, null);
    // ESPN (stubbed empty) was tried after TxLINE refused access.
    assert.equal(out.metadata.error, 'no_completed_match');
    assert.equal(out.metadata.txline, 'txline_no_access');
  });
});

describe('TxLINE proof endpoints', () => {
  it('a broken proof endpoint does not mark the score feed degraded', async () => {
    const observe = await import('../src/observe.js');
    const { txline } = await import('../src/txline.js');
    observe.resetObservations();
    // Stub answers the stat-validation path 404 (the live tier answers 500).
    await assert.rejects(() => txline.getMerkleProof(1, 1));
    await getFixtures(999999); // a score-feed call that succeeds
    const { calls } = observe.upstreamReport();
    assert.ok(calls['txline-proofs'].failed >= 1);
    assert.ok(calls.txline.ok >= 1 && !calls.txline.degraded);
  });
});
