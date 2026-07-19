/**
 * TxLINE Service - Primary World Cup data provider
 *
 * TxLINE streams real-time World Cup scores, match events, and consensus odds
 * backed by cryptographic signatures anchored on Solana.
 *
 * This adapter supports two modes:
 *   - live:   hits TxLINE HTTP/SSE endpoints (requires API token, valid pre-cutoff)
 *   - replay: serves deterministic cached snapshots of completed matches so the
 *             app keeps working after TxLINE access ends (post July 19, 2026)
 *
 * Authentication (per https://txline.txodds.com/documentation/quickstart):
 *   - Guest JWT   (Authorization: Bearer <jwt>) - renewable via POST /auth/guest/start
 *   - API token   (X-Api-Token: <apiToken>)     - issued once after on-chain subscribe
 *
 * Environment variables:
 *   TXLINE_API_TOKEN         - activated API token (X-Api-Token header)
 *   TXLINE_GUEST_JWT         - cached guest JWT (refreshed on 401)
 *   TXLINE_API_ORIGIN        - default https://txline.txodds.com
 *   TXLINE_MODE              - 'live' | 'replay' | 'auto' (default auto)
 *   TXLINE_REPLAY_DIR        - directory with cached fixture snapshots
 */

import fs from 'node:fs';
import path from 'node:path';

const API_ORIGIN = process.env.TXLINE_API_ORIGIN || 'https://txline.txodds.com';
const BASE_URL = process.env.TXLINE_BASE_URL || `${API_ORIGIN}/api`;
const AUTH_START_URL = `${API_ORIGIN}/auth/guest/start`;
const API_TOKEN = process.env.TXLINE_API_TOKEN || null;
const REPLAY_DIR =
  process.env.TXLINE_REPLAY_DIR ||
  path.join(process.cwd(), 'cache', 'txline', 'replays');
// Fallback: data/txline-replays/ is committed to git and available on Vercel
const REPLAY_DIR_FALLBACK = path.join(process.cwd(), 'data', 'txline-replays');

// After this date live access is expected to be revoked; auto mode flips to replay
const TXLINE_LIVE_CUTOFF = new Date('2026-07-19T23:59:59Z').getTime();

// TxLINE World Cup competition id (numeric, used in /fixtures/snapshot?competitionId=72)
const WORLD_CUP_COMPETITION_ID = Number(process.env.TXLINE_WC_COMPETITION_ID) || 72;

// Module-level JWT cache. Initialized from env, refreshed on 401.
let cachedJwt = process.env.TXLINE_GUEST_JWT || null;

function resolveMode() {
  const forced = (process.env.TXLINE_MODE || 'auto').toLowerCase();
  if (forced === 'live' || forced === 'replay') return forced;
  // auto: live if we have a token and are before cutoff
  if (API_TOKEN && Date.now() < TXLINE_LIVE_CUTOFF) return 'live';
  return 'replay';
}

export function getTxlineStatus() {
  const mode = resolveMode();
  return {
    mode,
    hasToken: Boolean(API_TOKEN),
    hasJwt: Boolean(cachedJwt),
    baseUrl: BASE_URL,
    cutoff: new Date(TXLINE_LIVE_CUTOFF).toISOString(),
    competitionId: WORLD_CUP_COMPETITION_ID,
    replayDir: REPLAY_DIR,
    replayAvailable: listReplayFixtureIds().length > 0,
  };
}

/* ---------------------------------- live --------------------------------- */

async function refreshGuestJwt() {
  const res = await fetch(AUTH_START_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TxLINE /auth/guest/start -> ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.token) {
    throw new Error(`TxLINE /auth/guest/start returned no token: ${JSON.stringify(data).slice(0, 200)}`);
  }
  cachedJwt = data.token;
  return cachedJwt;
}

async function txlineFetch(pathname, { method = 'GET', body, retryOn401 = true } = {}) {
  if (!API_TOKEN) {
    throw new Error('TXLINE_API_TOKEN is not configured');
  }
  if (!cachedJwt) {
    await refreshGuestJwt();
  }
  const url = pathname.startsWith('http') ? pathname : `${BASE_URL}${pathname}`;

  const doFetch = (jwt) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': API_TOKEN,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'fourcast-worldcup/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });

  let res = await doFetch(cachedJwt);
  if (res.status === 401 && retryOn401) {
    // JWT may have expired - refresh once and retry
    await refreshGuestJwt();
    res = await doFetch(cachedJwt);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TxLINE ${method} ${pathname} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Fetch the World Cup fixture list from TxLINE.
 * Docs: https://txline.txodds.com/documentation/worldcup
 * Endpoint: GET /fixtures/snapshot?competitionId=72
 */
export async function getLiveFixtures() {
  const data = await txlineFetch(`/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}`);
  return normalizeFixtures(data);
}

/**
 * Fetch the consensus odds snapshot for a fixture.
 * Endpoint: GET /odds/snapshot/{fixtureId}
 * Returns multiple market rows; we surface the full-match 1X2 as canonical
 * consensus odds and include the raw markets array for the UI to expand.
 */
export async function getLiveOdds(fixtureId) {
  const data = await txlineFetch(`/odds/snapshot/${encodeURIComponent(fixtureId)}`);
  return normalizeOddsResponse(data);
}

/**
 * Fetch the score/event snapshot for a fixture.
 * Endpoint: GET /scores/snapshot/{fixtureId}
 * Returns one event record per in-match event; we reduce to a current score
 * summary plus the event timeline.
 */
export async function getLiveScores(fixtureId) {
  const data = await txlineFetch(`/scores/snapshot/${encodeURIComponent(fixtureId)}`);
  return normalizeScoresResponse(data);
}

export async function getHistoricalReplay(fixtureId) {
  // Documented as /scores/historical/{fixtureId} in the worldcup brief; the
  // devnet API exposes /scores/snapshot/{fixtureId} which already contains the
  // full historical event stream.
  return getLiveScores(fixtureId);
}

/**
 * Fetch the Merkle proof / stat-validation data for a (fixtureId, seq) pair.
 * Endpoint: GET /scores/stat-validation?fixtureId=X&seq=Y&statKeys=...
 */
export async function getMerkleProof(fixtureId, seq, statKeys = [1, 2]) {
  const q = new URLSearchParams({
    fixtureId: String(fixtureId),
    seq: String(seq),
    statKeys: statKeys.join(','),
  });
  return txlineFetch(`/scores/stat-validation?${q.toString()}`);
}

/* --------------------------------- replay -------------------------------- */

function replayFile(fixtureId) {
  const primary = path.join(REPLAY_DIR, `${fixtureId}.json`);
  if (fs.existsSync(primary)) return primary;
  return path.join(REPLAY_DIR_FALLBACK, `${fixtureId}.json`);
}

export function listReplayFixtureIds() {
  const ids = new Set();
  for (const dir of [REPLAY_DIR, REPLAY_DIR_FALLBACK]) {
    try {
      if (!fs.existsSync(dir)) continue;
      fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
        .forEach((id) => ids.add(id));
    } catch {
      // ignore
    }
  }
  return Array.from(ids);
}

export function readReplayFixture(fixtureId) {
  const file = replayFile(fixtureId);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[txline] failed to read replay ${fixtureId}:`, err.message);
    return null;
  }
}

export function writeReplayFixture(fixtureId, payload) {
  try {
    fs.mkdirSync(REPLAY_DIR, { recursive: true });
    fs.writeFileSync(replayFile(fixtureId), JSON.stringify(payload, null, 2));
    return true;
  } catch (err) {
    console.error(`[txline] failed to write replay ${fixtureId}:`, err.message);
    return false;
  }
}

/**
 * Build the proof metadata object attached to a fixture.
 * When the full on-chain proof is available (statToProve, summary, Merkle
 * nodes with isRightSibling), include it so the settlement UI can CPI-call
 * txoracle::validate_stat without an extra round-trip.
 */
function buildProofMeta(r) {
  const p = r.proof;
  if (!p?.eventStatRoot) return null;
  const meta = {
    merkleRoot: p.eventStatRoot,
    dailyRootPda: p.dailyRootPda || null,
    programId: p.programId || null,
    sequence: p.sequence ?? null,
    statKeys: p.statKeys || [],
    present: true,
  };
  // Include the full on-chain proof if available (for settlement CPI)
  if (p.statToProve && p.summary?.updateStats) {
    meta.statToProve = p.statToProve;
    meta.statToProve2 = p.statToProve2 || null;
    meta.eventStatRoot = p.eventStatRoot;
    meta.summary = p.summary;
    meta.statProof = p.statProof || [];
    meta.statProof2 = p.statProof2 || [];
    meta.subTreeProof = p.subTreeProof || [];
    meta.mainTreeProof = p.mainTreeProof || [];
    meta.ts = p.ts || p.summary.updateStats.minTimestamp;
  }
  return meta;
}

/* ------------------------------- normalize ------------------------------- */

/**
 * Coerce a TxLINE timestamp (ms number) or ISO string into an ISO string.
 * Returns null on invalid input rather than throwing.
 */
function toIso(v) {
  if (v == null) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null;
    return new Date(v).toISOString();
  }
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return new Date(n).toISOString();
  // Fall back to direct Date parse (handles ISO strings)
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Map TxLINE GameState (1=scheduled, 6=cancelled, etc.) to our status string.
 * TxLINE score events use string form ("scheduled", "in_running", "game_finalised", ...)
 * which we pass through after lowercasing.
 */
function mapGameState(state) {
  if (state == null) return 'scheduled';
  if (typeof state === 'number') {
    return ({ 1: 'scheduled', 6: 'cancelled' })[state] || 'scheduled';
  }
  const s = String(state).toLowerCase();
  if (s === 'game_finalised' || s === 'final') return 'final';
  if (s === 'in_running' || s === 'live' || s === 'inrunning') return 'live';
  if (s === 'cancelled') return 'cancelled';
  return s || 'scheduled';
}

/**
 * Normalize a TxLINE fixture row into the shape the /world-cup UI consumes.
 * Tolerant of both the live PascalCase schema (Participant1, FixtureId, StartTime)
 * and the cached replay shape (home.name, away.name) so either source renders.
 */
export function normalizeFixture(f = {}) {
  // Live schema: PascalCase fields
  const homeName = f.Participant1 || (f.home && f.home.name) || f.home_team?.name || 'TBD';
  const awayName = f.Participant2 || (f.away && f.away.name) || f.away_team?.name || 'TBD';
  const homeId = f.Participant1Id ?? (f.home && f.home.id) ?? null;
  const awayId = f.Participant2Id ?? (f.away && f.away.id) ?? null;

  // TxLINE sometimes returns placeholder names like "Team 3095" for teams
  // it hasn't resolved yet. Map known participant IDs to their real names.
  const TEAM_NAME_OVERRIDES = {
    3095: 'Sweden',
  };
  const resolvedHomeName =
    (homeId && TEAM_NAME_OVERRIDES[homeId]) ? TEAM_NAME_OVERRIDES[homeId] : homeName;
  const resolvedAwayName =
    (awayId && TEAM_NAME_OVERRIDES[awayId]) ? TEAM_NAME_OVERRIDES[awayId] : awayName;
  const homeIsHome = f.Participant1IsHome ?? (f.home && f.home.isHome) ?? true;
  const fixtureId = f.FixtureId ?? f.fixture_id ?? f.id;
  const competition = f.Competition || f.competition || null;
  const competitionId = f.CompetitionId ?? f.competition_id ?? null;
  const fixtureGroupId = f.FixtureGroupId ?? f.fixture_group_id ?? null;
  const kickoffMs = f.StartTime ?? f.kickoff_at ?? f.kickoff ?? f.start_time ?? null;
  const tsMs = f.Ts ?? f.ts ?? null;
  const gameState = f.GameState ?? f.game_state ?? f.status ?? 1;

  return {
    id: String(fixtureId ?? ''),
    provider: 'txline',
    competition: competition || (competitionId === 72 ? 'World Cup' : null),
    competitionId: competitionId ?? null,
    fixtureGroupId: fixtureGroupId ?? null,
    stage: f.stage || f.round || null,
    status: mapGameState(gameState),
    kickoff: toIso(kickoffMs),
    venue: f.venue || f.Venue || null,
    home: {
      id: homeId,
      name: resolvedHomeName,
      code: null,
      isHome: homeIsHome,
      score: null, // populated by normalizeScoresResponse
    },
    away: {
      id: awayId,
      name: resolvedAwayName,
      code: null,
      isHome: !homeIsHome,
      score: null,
    },
    // Consensus odds as decimal prices, plus implied probabilities
    odds: f.odds || null,
    // Verification metadata, populated once the match is final
    proof: f.proof
      ? {
          sequence: f.proof.sequence ?? null,
          merkleRoot: f.proof.merkle_root || f.proof.merkleRoot || null,
          dailyRootPda: f.proof.daily_root_pda || f.proof.dailyRootPda || null,
          programId: f.proof.program_id || f.proof.programId || null,
          signature: f.proof.signature || null,
          statKeys: f.proof.stat_keys || f.proof.statKeys || [],
        }
      : null,
    ts: toIso(tsMs),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeFixtures(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.fixtures || payload?.data || [];
  return rows.map(normalizeFixture).filter((f) => f.id);
}

function toDecimal(o) {
  if (o == null) return null;
  const n = Number(o);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * TxLINE prices are decimal odds scaled by 1000 (e.g. 2378 -> 2.378).
 * Pct is the implied probability as a string ("42.052").
 */
function priceToDecimal(p) {
  if (p == null) return null;
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 1000;
}

/**
 * Pick the canonical full-match 1X2 consensus odds from a TxLINE odds snapshot
 * (SuperOddsType = 1X2_PARTICIPANT_RESULT, MarketPeriod = null).
 */
export function normalizeOddsResponse(rows = []) {
  if (!Array.isArray(rows)) return { canonical: null, markets: [] };
  const canonical = rows.find(
    (r) =>
      r.SuperOddsType === '1X2_PARTICIPANT_RESULT' &&
      (r.MarketPeriod == null || r.MarketPeriod === 'half=0')
  ) || rows.find((r) => r.SuperOddsType === '1X2_PARTICIPANT_RESULT') || null;

  let consensus = null;
  if (canonical && Array.isArray(canonical.Prices) && canonical.Prices.length >= 3) {
    const home = priceToDecimal(canonical.Prices[0]);
    const draw = priceToDecimal(canonical.Prices[1]);
    const away = priceToDecimal(canonical.Prices[2]);
    if (home && draw && away) {
      const ph = 1 / home;
      const pd = 1 / draw;
      const pa = 1 / away;
      const sum = ph + pd + pa;
      consensus = {
        home, draw, away,
        implied: { home: ph / sum, draw: pd / sum, away: pa / sum },
        bookmaker: canonical.Bookmaker || null,
        ts: canonical.Ts ? new Date(Number(canonical.Ts)).toISOString() : null,
      };
    }
  }

  const markets = rows.map((r) => ({
    type: r.SuperOddsType || null,
    period: r.MarketPeriod || null,
    parameters: r.MarketParameters || null,
    priceNames: r.PriceNames || [],
    prices: (r.Prices || []).map(priceToDecimal),
    pct: r.Pct || [],
    bookmaker: r.Bookmaker || null,
    inRunning: r.InRunning ?? null,
    ts: toIso(r.Ts),
  }));

  return { canonical: consensus, markets };
}

/**
 * Reduce a TxLINE scores snapshot (one record per event) into a current score
 * summary plus an event timeline. Final score lives on the game_finalised event
 * (statusId=100, period=100) - we surface it from the Stats block when present.
 */
export function normalizeScoresResponse(rows = []) {
  if (!Array.isArray(rows)) return { final: null, events: [] };
  const events = rows
    .slice()
    .sort((a, b) => (a.Seq ?? 0) - (b.Seq ?? 0))
    .map((r) => ({
      seq: r.Seq ?? null,
      action: r.Action || null,
      ts: toIso(r.Ts),
      data: r.Data || {},
      stats: r.Stats || {},
    }));

  // Look for the finalised record first; otherwise the latest score record.
  const finalised = rows.find((r) => r.Action === 'game_finalised');
  const latest = rows[rows.length - 1];
  const summary = finalised || latest || null;

  let final = null;
  if (summary) {
    final = {
      status: mapGameState(summary.GameState ?? summary.Status ?? 'scheduled'),
      statusId: summary.StatusId ?? null,
      period: summary.Period ?? null,
      stats: summary.Stats || {},
      lastSeq: summary.Seq ?? null,
      ts: toIso(summary.Ts),
    };
  }

  return { final, events };
}

function normalizeOdds(odds) {
  const home = toDecimal(odds.home ?? odds['1']);
  const draw = toDecimal(odds.draw ?? odds.x ?? odds['X']);
  const away = toDecimal(odds.away ?? odds['2']);
  const out = { home, draw, away, implied: null };
  if (home && draw && away) {
    const ph = 1 / home;
    const pd = 1 / draw;
    const pa = 1 / away;
    const sum = ph + pd + pa;
    out.implied = {
      home: ph / sum,
      draw: pd / sum,
      away: pa / sum,
    };
  }
  return out;
}

/* ------------------------------ public facade ----------------------------- */

/**
 * Get fixtures in the currently-resolved mode.
 * Falls back to replay automatically if live fails - the UI must keep rendering.
 * In live mode, also stamps a `proof` marker on any fixture that has a cached
 * replay with a Merkle proof so the UI can offer "Verify on Solana".
 */
export async function getFixtures() {
  const mode = resolveMode();
  if (mode === 'live') {
    try {
      const fixtures = await getLiveFixtures();

      // Fetch consensus odds for each live fixture in parallel.
      // One /odds/snapshot/{fixtureId} call per fixture - bounded by the
      // World Cup fixture count so this stays cheap.
      const oddsResults = await Promise.allSettled(
        fixtures.map((f) => getLiveOdds(f.id))
      );
      fixtures.forEach((f, i) => {
        const r = oddsResults[i];
        if (r.status === 'fulfilled' && r.value?.canonical) {
          f.odds = r.value.canonical;
        }
      });

      // Stamp proof-present marker from cached replays
      const replayIds = new Set(listReplayFixtureIds());
      for (const f of fixtures) {
        if (replayIds.has(f.id)) {
          const r = readReplayFixture(f.id);
          const proofMeta = r ? buildProofMeta(r) : null;
          if (proofMeta) {
            f.proof = proofMeta;
            // Surface the final score from the proof so the card shows it
            if (proofMeta.statToProve) {
              const homeScore = Number(proofMeta.statToProve.value);
              const awayScore = proofMeta.statToProve2 ? Number(proofMeta.statToProve2.value) : 0;
              console.log('[txline] Setting score from proof for fixture', f.id, ':', homeScore, '-', awayScore);
              // Replace the home/away objects to ensure the score is set
              f.home = { ...f.home, score: homeScore };
              f.away = { ...f.away, score: awayScore };
              f.status = 'final';
            }
          }
        }
      }
      // Also surface any cached replay fixtures that aren't in the live list
      // (e.g. older finalised matches with verifiable proofs).
      const liveIds = new Set(fixtures.map((f) => f.id));
      for (const id of listReplayFixtureIds()) {
        if (liveIds.has(id)) continue;
        const r = readReplayFixture(id);
        if (!r) continue;
        const f = normalizeFixture(r.fixture || r);
        const proofMeta = buildProofMeta(r);
        if (proofMeta) {
          f.proof = proofMeta;
          const statsToProve = r.proof?.statsToProve || [];
          const statHome = statsToProve.find((s) => s.key === 1)?.value;
          const statAway = statsToProve.find((s) => s.key === 2)?.value;
          if (statHome != null) f.home.score = Number(statHome);
          if (statAway != null) f.away.score = Number(statAway);
          if (r.finalScore?.statusId === 100 || r.fixture?.GameState === 'final') {
            f.status = 'final';
          }
        }
        fixtures.push(f);
      }
      return { fixtures, mode: 'live', fallback: false };
    } catch (err) {
      console.error('[txline] live fixtures failed, falling back to replay:', err.message);
    }
  }
  const fixtures = listReplayFixtureIds()
    .map((id) => readReplayFixture(id))
    .filter(Boolean)
    .map((r) => {
      const f = normalizeFixture(r.fixture || r);
      const proofMeta = buildProofMeta(r);
      if (proofMeta) {
        f.proof = proofMeta;
        // Surface the final score so the card shows it
        const statsToProve = r.proof?.statsToProve || [];
        const statHome = statsToProve.find((s) => s.key === 1)?.value;
        const statAway = statsToProve.find((s) => s.key === 2)?.value;
        if (statHome != null) f.home.score = Number(statHome);
        if (statAway != null) f.away.score = Number(statAway);
        if (r.finalScore?.statusId === 100 || r.fixture?.GameState === 'final') {
          f.status = 'final';
        }
      }
      return f;
    });
  return { fixtures, mode: 'replay', fallback: mode === 'live' };
}

export async function getFixtureDetail(fixtureId) {
  const mode = resolveMode();
  if (mode === 'live') {
    try {
      const [oddsRes, scoresRes] = await Promise.allSettled([
        getLiveOdds(fixtureId),
        getLiveScores(fixtureId),
      ]);

      // TxLINE has no single-fixture fetch; the snapshot endpoint returns the
      // whole list, so we look the fixture up there.
      let fixtureRow = null;
      try {
        const all = await getLiveFixtures();
        fixtureRow = all.find((f) => f.id === String(fixtureId)) || null;
      } catch (e) {
        console.error(`[txline] live fixture list failed: ${e.message}`);
      }

      const fixture = fixtureRow || normalizeFixture({ FixtureId: fixtureId });

      const odds = oddsRes.status === 'fulfilled' ? oddsRes.value : null;
      const scores = scoresRes.status === 'fulfilled' ? scoresRes.value : null;

      // Merge consensus odds + final score onto the fixture for convenience
      if (odds?.canonical) fixture.odds = odds.canonical;
      if (scores?.final) {
        fixture.status = scores.final.status || fixture.status;
        const stats = scores.final.stats || {};
        // TxLINE score records keep goal totals under common stat keys
        const homeScore = stats['1'] ?? stats.score_home ?? stats.scoreHome ?? null;
        const awayScore = stats['2'] ?? stats.score_away ?? stats.scoreAway ?? null;
        if (homeScore != null) fixture.home.score = Number(homeScore);
        if (awayScore != null) fixture.away.score = Number(awayScore);
      }

      return {
        mode: 'live',
        fixture,
        odds,
        scores,
        events: scores?.events || [],
      };
    } catch (err) {
      console.error(`[txline] live fixture ${fixtureId} failed:`, err.message);
    }
  }
  const replay = readReplayFixture(fixtureId);
  if (!replay) return { mode: 'replay', fixture: null, odds: null, scores: null };
  const fixture = normalizeFixture(replay.fixture || replay);

  // Merge finalScore + proof statsToProve onto the fixture so the UI shows
  // the score and status from the cached replay.
  const fs2 = replay.finalScore || {};
  const statsToProve = replay.proof?.statsToProve || [];
  const statHome = statsToProve.find((s) => s.key === 1)?.value;
  const statAway = statsToProve.find((s) => s.key === 2)?.value;
  if (fs2.homeGoals != null || statHome != null) {
    fixture.home.score = Number(fs2.homeGoals ?? statHome);
  }
  if (fs2.awayGoals != null || statAway != null) {
    fixture.away.score = Number(fs2.awayGoals ?? statAway);
  }
  if (fs2.statusId === 100 || replay.fixture?.GameState === 'final') {
    fixture.status = 'final';
  }

  return {
    mode: 'replay',
    fixture,
    odds: replay.odds || null,
    scores: replay.scores || { final: fs2, events: replay.events || [] },
    events: replay.events || [],
    proof: replay.proof || null,
  };
}

/* =============================== streaming =============================== */

/**
 * SSE stream support.
 *
 * TxLINE exposes a high-speed Server-Sent Events feed for live World Cup data;
 * the endpoint URL is configurable via TXLINE_SSE_URL. When unset (most common
 * in dev / replay mode), the stream falls back to a server-side polling loop
 * that yields fixture/odds/score deltas at a fixed interval. The UI sees the
 * same delta shape either way.
 *
 * Authentication: browser EventSource can't send custom headers, so the actual
 * TxLINE SSE connection (when configured) must be proxied by an API route that
 * adds Authorization + X-Api-Token server-side. The polling fallback doesn't
 * need that — it reuses the existing authenticated fetch path.
 */

// Stream config — read env vars at call time (not module-load consts) so test
// overrides and runtime config updates take effect. Mirrors how `resolveMode()`
// already reads TXLINE_MODE dynamically.
const DEFAULT_STREAM_POLL_MS = 30_000;

export function getStreamConfig() {
  return {
    sseUrl: process.env.TXLINE_SSE_URL || null,
    pollIntervalMs: Number(process.env.TXLINE_STREAM_POLL_MS) || DEFAULT_STREAM_POLL_MS,
    mode: resolveMode(),
  };
}

/**
 * Format a fixture patch as an SSE-style delta envelope the UI can apply.
 * @param {string} fixtureId
 * @param {object} patch  - partial fixture fields to merge
 * @param {string} [kind] - 'fixture' | 'odds' | 'score' | 'meta'
 */
export function toStreamDelta(fixtureId, patch, kind = 'fixture') {
  return {
    type: kind,
    fixtureId: String(fixtureId ?? ''),
    patch: patch || {},
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse a raw SSE data payload (one event's `data:` lines joined) into a
 * delta envelope. Tolerates JSON, newline-separated JSON, and plain text
 * fallback. Returns null on empty/invalid input so the consumer can skip.
 */
export function parseStreamEvent(rawData) {
  if (!rawData || typeof rawData !== 'string') return null;
  const trimmed = rawData.trim();
  if (!trimmed) return null;
  // Multi-line JSON: split on newlines, take the last parseable JSON object.
  // Only accept the `patch` (or `data`) wrapper — falling back to the whole
  // object would mean `{...f, ...patch}` in the client overwrites `f.home`
  // with a partial object, losing f.home.name / code / isHome.
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj && typeof obj === 'object') {
        return {
          type: obj.type || 'fixture',
          fixtureId: obj.fixtureId || obj.id || null,
          patch: obj.patch || obj.data || {},
          timestamp: obj.timestamp || new Date().toISOString(),
        };
      }
    } catch {
      // not JSON, try next line
    }
  }
  // Fall back to treating the whole blob as a plain-text update for the
  // currently-tracked fixture (if any was hinted in a prefix like "id:1234")
  return {
    type: 'raw',
    fixtureId: null,
    patch: { raw: trimmed },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Stream fixture updates as an async generator. Yields delta envelopes
 * consumable by the /api/worldcup/stream SSE route.
 *
 * Two backends:
 *   1. Real SSE (if TXLINE_SSE_URL is set) - opens an upstream EventSource-style
 *      fetch, parses `data:` lines, yields parsed deltas. Uses Authorization
 *      header (server-side only).
 *   2. Polling fallback - every STREAM_POLL_INTERVAL_MS, re-fetches fixtures
 *      (and per-fixture odds when status is live/scheduled), diffs against the
 *      last seen state, yields deltas for every fixture that changed.
 *
 * @param {{ signal?: AbortSignal, fetchFixtures?: () => Promise<{fixtures: any[]}>, replayIntervalMs?: number }} [options]
 *   - `fetchFixtures` is the polling-backend fixture fetcher. Defaults to the
 *     module's `getFixtures()`; tests inject a mock to drive deterministic
 *     scenarios without hitting TxLINE or the filesystem.
 * @yields {{ type: string, fixtureId: string|null, patch: object, timestamp: string }}
 */
export async function* streamFixtureUpdates(options = {}) {
  const { signal, fetchFixtures = getFixtures, replayIntervalMs = 1500 } = options;
  const cfg = getStreamConfig();

  // ── Backend 1: real TxLINE SSE ────────────────────────────────────────
  if (cfg.sseUrl && cfg.mode === 'live' && API_TOKEN) {
    try {
      yield toStreamDelta(null, { kind: 'stream-mode', source: 'txline-sse' }, 'meta');
      for await (const delta of consumeUpstreamSse(cfg.sseUrl, signal)) {
        yield delta;
      }
      return;
    } catch (err) {
      // Fall through to polling backend
      yield toStreamDelta(
        null,
        { kind: 'stream-fallback', source: 'polling', reason: err.message },
        'meta'
      );
    }
  }

  // ── Backend 2: polling fallback (also covers replay mode) ─────────────
  yield toStreamDelta(null, { kind: 'stream-mode', source: cfg.sseUrl ? 'txline-sse-polling' : 'polling' }, 'meta');

  const seen = new Map(); // fixtureId -> last-serialized snapshot
  let stop = false;
  if (signal) {
    if (signal.aborted) stop = true;
    signal.addEventListener('abort', () => { stop = true; }, { once: true });
  }

  // Emit a startup snapshot so the client has data immediately
  yield* emitSnapshotDiff(seen, /* force */ true, fetchFixtures);

  while (!stop) {
    try {
      yield* emitSnapshotDiff(seen, /* force */ false, fetchFixtures);
    } catch (err) {
      yield toStreamDelta(null, { kind: 'error', error: err.message }, 'meta');
    }
    await sleep(cfg.pollIntervalMs);
  }
}

async function* emitSnapshotDiff(seen, force, fetchFixtures = getFixtures) {
  const { fixtures } = await fetchFixtures();
  for (const f of fixtures) {
    const key = f.id;
    const prev = seen.get(key);
    const snapshot = serializeForDiff(f);
    if (force || prev !== snapshot) {
      seen.set(key, snapshot);
      yield toStreamDelta(key, f, 'fixture');
    }
  }
  // Heartbeat for replay mode: also emit a meta tick so the client knows the
  // stream is alive even when no fixtures changed.
  yield toStreamDelta(null, { kind: 'heartbeat', ts: new Date().toISOString() }, 'meta');
}

function serializeForDiff(fixture) {
  // Compact diff key: only the fields the UI cares about for live updates.
  // Keep it small + order-stable so string equality works.
  return JSON.stringify({
    status: fixture.status,
    score: [fixture.home?.score, fixture.away?.score],
    odds: fixture.odds && {
      h: fixture.odds.implied?.home,
      d: fixture.odds.implied?.draw,
      a: fixture.odds.implied?.away,
    },
    ts: fixture.updatedAt,
  });
}

/**
 * Read raw `data:` payloads from an upstream TxLINE SSE URL. Adds the standard
 * Authorization + X-Api-Token headers (server-side only). The fetch reader
 * yields text chunks; we buffer until newline, then parse each non-empty line.
 *
 * @param {string} url
 * @param {AbortSignal} [signal]
 */
async function* consumeUpstreamSse(url, signal) {
  const jwt = await (async () => {
    if (cachedJwt) return cachedJwt;
    if (API_TOKEN) await refreshGuestJwt();
    return cachedJwt;
  })();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': API_TOKEN,
      Accept: 'text/event-stream',
      'User-Agent': 'fourcast-worldcup/1.0',
    },
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`TxLINE SSE ${url} -> ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const rawEvent = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLines = rawEvent
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n');
      if (!dataLines) continue;
      const parsed = parseStreamEvent(dataLines);
      if (parsed) yield parsed;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ============================== end streaming ============================ */

const txlineService = {
  getTxlineStatus,
  getFixtures,
  getFixtureDetail,
  getLiveFixtures,
  getLiveOdds,
  getLiveScores,
  getHistoricalReplay,
  getMerkleProof,
  listReplayFixtureIds,
  readReplayFixture,
  writeReplayFixture,
  normalizeFixture,
  normalizeFixtures,
  normalizeOddsResponse,
  normalizeScoresResponse,
  getStreamConfig,
  toStreamDelta,
  parseStreamEvent,
  streamFixtureUpdates,
};

export default txlineService;
