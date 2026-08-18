/**
 * TxLINE client for the Telegraph miner.
 *
 * Minimal, focused adapter: fetches fixtures, scores, odds, and Merkle proofs
 * from TxLINE. Handles JWT refresh on 401. No replay/cache logic — this miner
 * always serves live data.
 */

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

async function request(path, { retry401 = true } = {}) {
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
    throw new Error(`TxLINE ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get fixture snapshot. Optional competitionId filter.
 * Returns raw TxLINE fixture array.
 */
export async function getFixtures(competitionId) {
  const q = competitionId ? `?competitionId=${competitionId}` : '';
  return request(`/fixtures/snapshot${q}`);
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
 * Get Merkle proof for fixture statistics (stat-validation).
 */
export async function getMerkleProof(fixtureId, seq, statKeys = [1, 2]) {
  const q = new URLSearchParams({
    fixtureId: String(fixtureId),
    seq: String(seq),
    statKeys: statKeys.join(','),
  });
  return request(`/scores/stat-validation?${q}`);
}

/**
 * Get Merkle multiproof for fixture statistics.
 */
export async function getMerkleMultiproof(fixtureId, seq, statKeys = [1, 2]) {
  const q = new URLSearchParams({
    fixtureId: String(fixtureId),
    seq: String(seq),
    statKeys: statKeys.join(','),
  });
  return request(`/scores/stat-multiproof?${q}`);
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
  getMerkleProof,
  getMerkleMultiproof,
  getStatus,
  refreshJwt,
};

export default txline;
