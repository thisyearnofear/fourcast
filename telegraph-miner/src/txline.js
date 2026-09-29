/**
 * TxLINE client for the Telegraph miner.
 *
 * Minimal, focused adapter: fetches fixtures, scores, odds, and Merkle proofs
 * from TxLINE. Handles JWT refresh on 401. No replay/cache logic — this miner
 * always serves live data.
 */

import { track } from './observe.js';

const API_ORIGIN = process.env.TXLINE_API_ORIGIN || 'https://txline.txodds.com';
const BASE_URL = `${API_ORIGIN}/api`;
const AUTH_URL = `${API_ORIGIN}/auth/guest/start`;
const API_TOKEN = process.env.TXLINE_API_TOKEN || null;

let cachedJwt = process.env.TXLINE_GUEST_JWT || null;

async function refreshJwt() {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`TxLINE auth failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error('TxLINE auth returned no token');
  cachedJwt = data.token;
  return cachedJwt;
}

function request(path, opts) {
  return track('txline', () => rawRequest(path, opts));
}

// The proof endpoints are a separate service from the score feed, and on the
// free tier they fail independently of it: measured 2026-09-28 on a finalised
// NFL fixture, BOTH documented request shapes — legacy `statKey=[&statKey2=]`
// (validateStat) and multi-stat `statKeys=` (validateStatV2) — answer 500
// "Stat validation failed" for every stat key present on the record.
// Tracking them under "txline" made a broken proof endpoint look like a dead
// score feed in /health. They get their own ledger entry now.
function proofRequest(path) {
  return track('txline-proofs', () => rawRequest(path));
}


async function rawRequest(path, { retry401 = true } = {}) {
  if (!API_TOKEN) throw new Error('TXLINE_API_TOKEN not configured');
  if (!cachedJwt) await refreshJwt();

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  const doFetch = (jwt) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': API_TOKEN,
        Accept: 'application/json',
        'User-Agent': 'fourcast-telegraph-miner/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    });

  let res = await doFetch(cachedJwt);
  if (res.status === 401 && retry401) {
    await refreshJwt();
    res = await doFetch(cachedJwt);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`TxLINE ${path} -> ${res.status}: ${text.slice(0, 200)}`);
    if (res.status === 403 && /access denied|no tickets/i.test(text)) err.expected = true;
    throw err;
  }
  return res.json();
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get fixture snapshot. Optional competitionId filter.
 *
 * The unfiltered snapshot is ~29 MB / ~100k fixtures and takes ~4 s (measured
 * 2026-09-28), and every ask used to fetch it twice. It is cached slim — only
 * the fields the handlers read — for FIXTURES_TTL_MS, and concurrent callers
 * share one in-flight fetch.
 */
const FIXTURES_TTL_MS = Number(process.env.TXLINE_FIXTURES_TTL_MS || 5 * 60_000);
const fixtureCache = new Map(); // key -> { at, data } | { pending }
const slim = (f) => ({
  FixtureId: f.FixtureId,
  Competition: f.Competition,
  CompetitionId: f.CompetitionId,
  Participant1: f.Participant1,
  Participant2: f.Participant2,
  StartTime: f.StartTime,
  GameState: f.GameState,
  Participant1IsHome: f.Participant1IsHome,
});

export async function getFixtures(competitionId) {
  const key = competitionId ? String(competitionId) : 'all';
  const hit = fixtureCache.get(key);
  if (hit?.data && Date.now() - hit.at < FIXTURES_TTL_MS) return hit.data;
  if (hit?.pending) return hit.pending;

  const q = competitionId ? `?competitionId=${competitionId}` : '';
  const pending = request(`/fixtures/snapshot${q}`)
    .then((rows) => {
      const data = Array.isArray(rows) ? rows.map(slim) : rows;
      fixtureCache.set(key, { at: Date.now(), data });
      return data;
    })
    .catch((err) => {
      // Serve the last good copy through an outage rather than failing the ask.
      if (hit?.data) {
        fixtureCache.set(key, hit);
        return hit.data;
      }
      fixtureCache.delete(key);
      throw err;
    });
  fixtureCache.set(key, { ...(hit?.data ? hit : {}), pending });
  return pending;
}

/**
 * Get fixture updates for a specific fixture on a given day.
 */
export async function getFixtureUpdates(fixtureId, epochDay) {
  const q = epochDay ? `?epochDay=${epochDay}` : '';
  return request(`/fixtures/${fixtureId}/updates${q}`);
}

/**
 * Get odds snapshot for a fixture.
 * Returns array of market rows.
 */
export async function getOddsSnapshot(fixtureId) {
  return request(`/odds/snapshot/${fixtureId}`);
}

/**
 * Get live odds via SSE (not used in request/response miner, but available).
 */
export async function getOddsLive(fixtureId) {
  return request(`/odds/live/${fixtureId}`);
}

/**
 * Get score snapshot for a fixture.
 * Returns array of score events.
 */
export async function getScoreSnapshot(fixtureId) {
  return request(`/scores/snapshot/${fixtureId}`);
}

/**
 * Get the full score event sequence for a fixture.
 */
export async function getScoreSequence(fixtureId) {
  return request(`/scores/sequence/${fixtureId}`);
}

/**
 * Get score events for a completed fixture (documented historical endpoint;
 * measured 2026-09-28 to answer 200 for fixtures whose /sequence window has
 * closed). It answers an SSE-style replay — `data: {…}` lines, not plain
 * JSON — so the frames are parsed into an event array here. A fixture with
 * nothing published answers 200 with an empty body: that is [], not an error.
 */
export async function getHistoricalScores(fixtureId) {
  return track('txline', async () => {
    if (!API_TOKEN) throw new Error('TXLINE_API_TOKEN not configured');
    if (!cachedJwt) await refreshJwt();
    const url = `${BASE_URL}/scores/historical/${fixtureId}`;
    const doFetch = (jwt) => fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': API_TOKEN,
        Accept: 'text/event-stream',
        'User-Agent': 'fourcast-telegraph-miner/1.0',
      },
      signal: AbortSignal.timeout(30_000),
    });
    let res = await doFetch(cachedJwt);
    if (res.status === 401) {
      await refreshJwt();
      res = await doFetch(cachedJwt);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`TxLINE /scores/historical/${fixtureId} -> ${res.status}: ${text.slice(0, 200)}`);
      if (res.status === 403 && /access denied|no tickets/i.test(text)) err.expected = true;
      throw err;
    }
    const body = await res.text();
    const events = [];
    for (const line of body.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try { events.push(JSON.parse(line.slice(5).trim())); } catch { /* partial frame */ }
    }
    return events;
  });
}

/**
 * Get a Merkle stat proof (validateStatV2 shape: `statKeys=1,2,...`).
 * The requested order is significant — on-chain strategy indexes are
 * positional against this array (docs, On-Chain Validation).
 */
export async function getMerkleProof(fixtureId, seq, statKeys = [1, 2]) {
  const q = new URLSearchParams({
    fixtureId: String(fixtureId),
    seq: String(seq),
    statKeys: statKeys.join(','),
  });
  return proofRequest(`/scores/stat-validation?${q}`);
}

/**
 * Get a Merkle stat proof in the legacy validateStat shape: a single
 * `statKey` with an optional second key. (There is no separate
 * stat-multiproof endpoint — an earlier client method invented one and only
 * ever measured its own 404.)
 */
export async function getStatProofLegacy(fixtureId, seq, statKey = 1, statKey2 = null) {
  const q = new URLSearchParams({ fixtureId: String(fixtureId), seq: String(seq), statKey: String(statKey) });
  if (statKey2 != null) q.set('statKey2', String(statKey2));
  return proofRequest(`/scores/stat-validation?${q}`);
}

/**
 * Get the status/health of the TxLINE connection.
 */
export async function getStatus() {
  try {
    // Quick test: fetch a minimal fixtures snapshot
    const fixtures = await getFixtures();
    return {
      connected: true,
      hasToken: Boolean(API_TOKEN),
      hasJwt: Boolean(cachedJwt),
      fixtureCount: Array.isArray(fixtures) ? fixtures.length : 0,
      origin: API_ORIGIN,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      hasToken: Boolean(API_TOKEN),
      hasJwt: Boolean(cachedJwt),
      origin: API_ORIGIN,
    };
  }
}

export const txline = {
  getFixtures,
  getFixtureUpdates,
  getOddsSnapshot,
  getOddsLive,
  getScoreSnapshot,
  getScoreSequence,
  getHistoricalScores,
  getMerkleProof,
  getStatProofLegacy,
  getStatus,
  refreshJwt,
};

export default txline;
