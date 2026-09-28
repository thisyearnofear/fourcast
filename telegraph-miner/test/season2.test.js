/**
 * Season II behaviour: attributed answers, absence-as-absence, the ESPN
 * fallback, Ed25519 attestation, and the /api/asked + /health instruments.
 *
 * No network: ESPN is served from a stubbed fetch, TxLINE is unconfigured.
 */
import { createServer } from 'node:http';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.TXLINE_API_TOKEN; // force the TxLINE path to fail fast
delete process.env.MINER_SIGNING_KEY;

const { describe: describeAnswer, signalFieldsFromAnswer } = await import('../src/answer.js');
const { sidesFromQuery, normalizeQueryRequest } = await import('../src/query.js');
const espn = await import('../src/espn.js');
const { attest, verifyAttestation, settleFields, canonicalize, publicKey } = await import('../src/attest.js');
const observe = await import('../src/observe.js');
const { default: app } = await import('../src/server.js');

// ─── fixtures ───────────────────────────────────────────────────────────────

const team = (displayName, shortDisplayName, name, location, abbreviation) => ({
  displayName, shortDisplayName, name, location, abbreviation,
});
const DODGERS = team('Los Angeles Dodgers', 'Dodgers', 'Dodgers', 'Los Angeles', 'LAD');
const GIANTS = team('San Francisco Giants', 'Giants', 'Giants', 'San Francisco', 'SF');
const PADRES = team('San Diego Padres', 'Padres', 'Padres', 'San Diego', 'SD');

function event(id, date, home, away, homeScore, awayScore, state, completed, name = completed ? 'STATUS_FINAL' : 'STATUS_SCHEDULED') {
  return {
    id,
    date,
    status: { type: { state, completed, name, shortDetail: state === 'in' ? 'Top 5th' : 'Final' } },
    links: [{ href: `https://www.espn.com/mlb/game/_/gameId/${id}` }],
    competitions: [{
      competitors: [
        { homeAway: 'home', score: String(homeScore), team: home },
        { homeAway: 'away', score: String(awayScore), team: away },
      ],
    }],
  };
}

// Today: Dodgers host Padres later (scheduled, ESPN reports "0").
// Yesterday: Giants beat Dodgers 5-3 at Dodger Stadium (away win).
const TODAY = [event('3', '2026-09-28T23:10Z', DODGERS, PADRES, 0, 0, 'pre', false)];
const YESTERDAY = [
  event('2', '2026-09-27T20:10Z', DODGERS, GIANTS, 3, 5, 'post', true),
  event('9', '2026-09-27T17:05Z', PADRES, GIANTS, 0, 0, 'post', false, 'STATUS_POSTPONED'),
];

// Premier League: scoreboards return nothing for any date (as measured
// 2026-09-28); the team schedule has the season, with object scores.
const ARSENAL = { id: '359', ...team('Arsenal', 'Arsenal', 'Arsenal', 'Arsenal', 'ARS') };
const CHELSEA = { id: '363', ...team('Chelsea', 'Chelsea', 'Chelsea', 'Chelsea', 'CHE') };
const SUNDERLAND = team('Sunderland', 'Sunderland', 'Sunderland', 'Sunderland', 'SUN');
function scheduled(ev) {
  for (const c of ev.competitions[0].competitors) c.score = { value: Number(c.score), displayValue: c.score };
  return ev;
}
const ARSENAL_SCHEDULE = [
  scheduled(event('a1', '2026-09-06T16:30Z', ARSENAL, CHELSEA, 2, 1, 'post', true)),
  scheduled(event('a2', '2026-09-12T14:00Z', SUNDERLAND, ARSENAL, 0, 2, 'post', true)),
  scheduled(event('a3', '2099-10-03T14:00Z', ARSENAL, CHELSEA, 0, 0, 'pre', false)),
];
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

let realFetch;
function stubEspn() {
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.includes('site.api.espn.com')) return realFetch(url, init);
    if (u.includes('/soccer/eng.1/teams/359/schedule')) return json({ events: ARSENAL_SCHEDULE });
    if (u.includes('/soccer/eng.1/teams')) return json({ sports: [{ leagues: [{ teams: [{ team: ARSENAL }, { team: CHELSEA }] }] }] });
    if (u.includes('/teams')) return json({ sports: [{ leagues: [{ teams: [] }] }] });
    const isMlb = u.includes('/baseball/mlb/');
    const dated = /dates=(\d{8})/.exec(u)?.[1];
    let events = [];
    if (isMlb && !dated) events = TODAY;
    else if (isMlb && dated === espn.espnDate(Date.now() - 86_400_000)) events = YESTERDAY;
    return new Response(JSON.stringify({ events }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
function unstub() {
  globalThis.fetch = realFetch;
}

// ─── answer shape ──────────────────────────────────────────────────────────

describe('attributed answers', () => {
  it('names the winner first, with the winner’s score first', () => {
    assert.equal(
      describeAnswer({ home_team: 'Los Angeles Dodgers', away_team: 'San Francisco Giants', home_score: 3, away_score: 5, status: 'final' }),
      'San Francisco Giants beat Los Angeles Dodgers 5-3 (final)'
    );
  });

  it('describes a draw as a draw', () => {
    assert.equal(
      describeAnswer({ home_team: 'Arsenal', away_team: 'Chelsea', home_score: 1, away_score: 1, status: 'final' }),
      'Arsenal and Chelsea drew 1-1 (final)'
    );
  });

  it('never gives a scheduled game a score', () => {
    const s = describeAnswer({ home_team: 'A', away_team: 'B', home_score: null, away_score: null, status: 'scheduled', kickoff: '2026-09-29T18:00:00.000Z' });
    assert.equal(s, 'A vs B is scheduled for 2026-09-29T18:00:00.000Z');
  });

  it('does not invent team names', () => {
    const got = signalFieldsFromAnswer({ home_team: null, away_team: 'B', home_score: 2, away_score: 0, status: 'final' });
    assert.equal(got.winner, ''); // home won, but its name is unknown — not "Unknown"
    assert.match(got.reason, /the home side beat B 2-0/);
  });

  it('labels an absence as no_result, with the reason', () => {
    const got = signalFieldsFromAnswer(null, 'No completed match found for team "Zzz"');
    assert.equal(got.label, 'no_result');
    assert.equal(got.reason, 'No completed match found for team "Zzz"');
  });
});

describe('question parsing', () => {
  it('reads both sides of "did X beat Y"', () => {
    assert.deepEqual(sidesFromQuery('Did the Dodgers beat the Giants?'), { team: 'Dodgers', opponent: 'Giants' });
  });

  it('does not treat a league name as a team', () => {
    const got = normalizeQueryRequest({ query: 'Premier League scores today' });
    assert.equal(got.params.team, undefined);
    assert.equal(got.params.competition, 'Premier League');
  });

  it('routes "did X win" to GAME_RESULT and parses MLB', () => {
    const got = normalizeQueryRequest({ query: 'Did the Dodgers win last night? MLB' });
    assert.equal(got.intent, 'GAME_RESULT');
    assert.equal(got.params.team, 'Dodgers');
    assert.equal(got.params.competition, 'MLB');
  });
});

// ─── ESPN ───────────────────────────────────────────────────────────────────

describe('ESPN fallback', () => {
  before(stubEspn);
  after(unstub);
  beforeEach(() => espn.clearEspnCache());

  it('requires every word of the team name (no Manchester City → Manchester United)', () => {
    const united = team('Manchester United', 'Man United', 'Manchester United', 'Manchester', 'MUN');
    const city = team('Manchester City', 'Man City', 'Manchester City', 'Manchester', 'MNC');
    assert.equal(espn.teamScore('Manchester City', united), 0);
    assert.ok(espn.teamScore('Manchester City', city) > 0);
    assert.ok(espn.teamScore('Man City', city) > 0);
  });

  it('GAME_RESULT skips today’s scheduled game and returns yesterday’s final', async () => {
    const { answer } = await espn.findGame({ team: 'Dodgers', competition: 'MLB', wantFinal: true });
    assert.equal(answer.status, 'final');
    assert.equal(answer.result, 'away_win');
    assert.equal(answer.winner, 'San Francisco Giants');
    assert.equal(answer.source, 'espn');
    assert.equal(answer.verified, false);
    assert.equal(answer.proof, null);
  });

  it('SPORTS_SCORE takes today’s game, with no score before it starts', async () => {
    const { answer } = await espn.findGame({ team: 'Dodgers', competition: 'MLB' });
    assert.equal(answer.status, 'scheduled');
    assert.equal(answer.home_score, null);
    assert.equal(answer.away_score, null);
  });

  it('a named opponent excludes a game against someone else', async () => {
    const { answer } = await espn.findGame({ team: 'Dodgers', opponent: 'Padres', competition: 'MLB', wantFinal: true });
    assert.equal(answer, null);
  });

  it('finds an old final from the team schedule when boards are empty (Arsenal)', async () => {
    const { answer, searched } = await espn.findGame({ team: 'Arsenal', competition: 'Premier League', wantFinal: true });
    assert.equal(answer.summary ?? null, null);
    assert.equal(answer.winner, 'Arsenal');
    assert.equal(answer.home_team, 'Sunderland');
    assert.equal(answer.home_score, 0);
    assert.equal(answer.away_score, 2);
    assert.ok(searched.days.includes('team-schedule'));
  });

  it('schedule path respects a named opponent', async () => {
    const { answer } = await espn.findGame({ team: 'Arsenal', opponent: 'Chelsea', competition: 'Premier League', wantFinal: true });
    assert.equal(answer.fixture_id, 'espn:epl:a1');
    assert.equal(answer.result, 'home_win');
  });

  it('a postponed game is not a final', async () => {
    const { answer } = await espn.findGame({ team: 'Padres', competition: 'MLB', wantFinal: true });
    assert.equal(answer, null);
  });
});

// ─── attestation ────────────────────────────────────────────────────────────

describe('attestation', () => {
  const fields = settleFields({
    intent: 'GAME_RESULT',
    request_id: 'r1',
    issuedAt: '2026-09-28T00:00:00.000Z',
    answer: { fixture_id: 'espn:mlb:2', source: 'espn', home_team: 'A', away_team: 'B', home_score: 3, away_score: 5, status: 'final', result: 'away_win', winner: 'B' },
    signals: { score: '3-5', label: 'final' },
  });

  it('verifies against the published key', () => {
    const att = attest(fields);
    assert.deepEqual(verifyAttestation(att, publicKey).ok, true);
  });

  it('fails when a signed value is changed', () => {
    const att = attest(fields);
    const tampered = { ...att, canonical: canonicalize({ ...JSON.parse(att.canonical), winner: 'A' }) };
    assert.equal(verifyAttestation(tampered, publicKey).ok, false);
  });

  it('fails when the key is not the published one', () => {
    const att = attest(fields);
    const other = Buffer.alloc(32, 7).toString('base64');
    assert.equal(verifyAttestation(att, other).ok, false);
  });
});

// ─── HTTP ───────────────────────────────────────────────────────────────────

describe('HTTP: /query, /api/asked, /health, /.well-known', () => {
  let server;
  let base;
  before(async () => {
    stubEspn();
    espn.clearEspnCache();
    observe.resetObservations();
    server = createServer(app).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => {
    server.close();
    unstub();
  });

  it('answers from ESPN when TxLINE is unavailable, signed and honestly unverified', async () => {
    const res = await fetch(`${base}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Who won the Dodgers game? MLB' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.intent, 'GAME_RESULT');
    assert.equal(body.reason, 'San Francisco Giants beat Los Angeles Dodgers 5-3 (final)');
    assert.equal(body.score, '3-5');
    assert.equal(body.winner, 'San Francisco Giants');
    assert.equal(body.metadata.source, 'espn');
    assert.equal(body.metadata.verification, 'none');
    assert.equal(body.metadata.fallback_from, 'txline_unavailable');

    const keys = await (await fetch(`${base}/.well-known/fourcast-miner.json`)).json();
    const check = verifyAttestation(body.metadata.attestation, keys.signing.public_key);
    assert.equal(check.ok, true);
    assert.equal(check.fields.winner, 'San Francisco Giants');
  });

  it('reports a miss as no_result with a reason, still 200', async () => {
    const res = await fetch(`${base}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'GAME_RESULT', params: { team: 'Nonexistent Wanderers', competition: 'MLB' } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.label, 'no_result');
    assert.equal(body.answer, null);
    assert.match(body.reason, /No completed match found for team "Nonexistent Wanderers"/);
  });

  it('refuses invalid JSON with a 400 JSON body', async () => {
    const res = await fetch(`${base}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'invalid_json');
  });

  it('/api/asked shows what was asked, the field it came in, and the outcome', async () => {
    const report = await (await fetch(`${base}/api/asked`)).json();
    assert.equal(report.total, 3);
    assert.deepEqual(report.outcomes, { answered: 1, no_result: 1, bad_request: 1 });
    const answered = report.asked.find((a) => a.outcome === 'answered');
    assert.equal(answered.question_field, 'query');
    assert.equal(answered.question, 'Who won the Dodgers game? MLB');
    assert.equal(answered.source, 'espn');
  });

  it('/health reports degraded only when every called upstream is failing', async () => {
    const health = await (await fetch(`${base}/health`)).json();
    // TxLINE failed (no token) but ESPN answered — one working source is ok.
    assert.equal(health.status, 'ok');
    assert.equal(health.upstream.espn.degraded, false);
    assert.equal(health.signing_key_persistent, false);
  });

  it('/health says when the TxLINE subscription is due for renewal', async () => {
    process.env.TXLINE_SUBSCRIBED_UNTIL = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const soon = await (await fetch(`${base}/health`)).json();
    assert.equal(soon.txline_renewal.days_left, 3);
    assert.equal(soon.txline_renewal.due_soon, true);
    assert.equal(soon.txline_renewal.expired, false);

    process.env.TXLINE_SUBSCRIBED_UNTIL = new Date(Date.now() + 25 * 86_400_000).toISOString().slice(0, 10);
    const fresh = await (await fetch(`${base}/health`)).json();
    assert.equal(fresh.txline_renewal.due_soon, false);

    delete process.env.TXLINE_SUBSCRIBED_UNTIL;
    const unset = await (await fetch(`${base}/health`)).json();
    assert.equal(unset.txline_renewal, null); // absence reported, not guessed
  });
});
