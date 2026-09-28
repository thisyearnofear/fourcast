/**
 * TxLINE feed shapes as measured live on 2026-09-28 (NFL fixture 18041502,
 * Broncos 30-26 Rams). Each case here was a live bug:
 *  - totals live in Score.ParticipantN.Total.Score (Stats["1"] mirrors them)
 *  - the snapshot's GameState lagged (3) although the game had finalised
 *  - Participant1IsHome decides home/away
 *  - "premier league" was mapped to competition 500001, which is NFL
 *  - "Arsenal" must not become "Arsenal U21"
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.TXLINE_API_TOKEN = 'test-token';
process.env.TXLINE_GUEST_JWT = 'test-jwt';

const HOUR = 3_600_000;
const now = Date.now();
const FIXTURES = [
  // Snapshot says GameState 3 (not finished) — the events say finalised.
  { FixtureId: 18041502, Competition: 'NFL', CompetitionId: 500001, Participant1: 'Denver Broncos', Participant2: 'L.A. Rams', Participant1IsHome: true, StartTime: now - 5 * HOUR, GameState: 3 },
  // Participant1 is the away side here.
  { FixtureId: 777, Competition: 'NFL', CompetitionId: 500001, Participant1: 'Kansas City Chiefs', Participant2: 'Miami Dolphins', Participant1IsHome: false, StartTime: now - 30 * HOUR, GameState: 6 },
  { FixtureId: 901, Competition: 'Premier League 2', CompetitionId: 1592, Participant1: 'Arsenal U21', Participant2: 'Sunderland U21', StartTime: now - 20 * HOUR, GameState: 6 },
  { FixtureId: 903, Competition: 'PSL', CompetitionId: 214, Participant1: 'Kaizer Chiefs', Participant2: 'Durban City', StartTime: now - 10 * HOUR, GameState: 6 },
  { FixtureId: 902, Competition: 'Premier League', CompetitionId: 8, Participant1: 'Arsenal', Participant2: 'Leeds', StartTime: now + 72 * HOUR, GameState: 1 },
];

const nflFinal = (id, p1, p2, seq) => [
  { FixtureId: id, Seq: seq - 1, Action: 'comment' },
  { FixtureId: id, Seq: seq, Action: 'game_finalised', GameState: 'scheduled', Score: { Participant1: { Total: { Score: p1 } }, Participant2: { Total: { Score: p2 } } }, Stats: { 1: p1, 2: p2 } },
  { FixtureId: id, Seq: seq + 1, Action: 'disconnected' },
];

let realFetch;
let urls = [];
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    urls.push(u);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('/fixtures/snapshot')) {
      const id = /competitionId=(\d+)/.exec(u)?.[1];
      return json(id ? FIXTURES.filter((f) => String(f.CompetitionId) === id) : FIXTURES);
    }
    if (u.includes('/scores/snapshot/18041502')) return json(nflFinal(18041502, 30, 26, 2141));
    if (u.includes('/scores/snapshot/777')) return json(nflFinal(777, 17, 24, 50)); // Chiefs (P1, away) 17, Dolphins (P2, home) 24
    if (u.includes('/scores/snapshot/')) return new Response('Bundle access denied and no tickets held', { status: 403 });
    if (u.includes('/scores/stat-validation')) return new Response('{"message":"Stat validation failed"}', { status: 500 });
    if (u.includes('site.api.espn.com')) return json({ events: [], sports: [{ leagues: [{ teams: [] }] }] });
    return json({}, 404);
  };
});
after(() => {
  globalThis.fetch = realFetch;
});

const { handleGameResult } = await import('../src/intents/gameResult.js');
const { handleSportsScore } = await import('../src/intents/sportsScore.js');
const { txlineCompetitionId } = await import('../src/utils.js');

describe('TxLINE live shapes', () => {
  it('reads a finalised NFL game whose snapshot state lags, with Score.Total totals', async () => {
    const out = await handleGameResult({ team: 'Broncos' });
    assert.equal(out.answer?.source, 'txline');
    assert.equal(out.answer.home_team, 'Denver Broncos');
    assert.equal(out.answer.home_score, 30);
    assert.equal(out.answer.away_score, 26);
    assert.equal(out.answer.winner, 'Denver Broncos');
    assert.equal(out.answer.summary, 'Denver Broncos beat L.A. Rams 30-26 (final)');
    // Proof endpoint failed → honestly unverified.
    assert.equal(out.answer.verified, false);
    assert.match(out.answer.proof.reason, /Stat validation failed/);
  });

  it('a partial name fitting two teams is not guessed ("Chiefs")', async () => {
    urls = [];
    const out = await handleGameResult({ team: 'Chiefs' });
    assert.equal(out.answer, null);
    assert.ok(!urls.some((u) => /scores\/snapshot\/(777|903)/.test(u)));
  });

  it('honours Participant1IsHome = false', async () => {
    const out = await handleGameResult({ team: 'Kansas City Chiefs' });
    assert.equal(out.answer.home_team, 'Miami Dolphins');
    assert.equal(out.answer.away_team, 'Kansas City Chiefs');
    assert.equal(out.answer.home_score, 24);
    assert.equal(out.answer.away_score, 17);
    assert.equal(out.answer.winner, 'Miami Dolphins');
  });

  it('SPORTS_SCORE reads the same final', async () => {
    const out = await handleSportsScore({ team: 'Denver Broncos' });
    assert.equal(out.answer.status, 'final');
    assert.equal(out.answer.home_score, 30);
  });

  it('maps Premier League to competition 8 and NFL to 500001', () => {
    assert.equal(txlineCompetitionId('Premier League'), 8);
    assert.equal(txlineCompetitionId('NFL'), 500001);
    assert.equal(txlineCompetitionId('MLS'), 33);
  });

  it('"Arsenal" is never answered with Arsenal U21', async () => {
    urls = [];
    const out = await handleGameResult({ team: 'Arsenal' });
    // Senior Arsenal's only TxLINE fixture is in the future → no TxLINE result;
    // falls through to ESPN (stubbed empty) rather than returning the U21 game.
    assert.equal(out.answer, null);
    assert.ok(!urls.some((u) => u.includes('/scores/snapshot/901')), 'U21 fixture must not be opened');
  });
});
