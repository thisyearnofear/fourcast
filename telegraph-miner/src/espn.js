/**
 * ESPN public scoreboards — a free source of final results.
 *
 * Why this exists: Season I this miner scored 0 on GAME_RESULT because the
 * free TxLINE tier carries no history, so most asks came back "no completed
 * match". The miners that did score on GAME_RESULT (game-mlb-schedule,
 * game-football-data, game-nhl-score) answer from free official feeds. ESPN's
 * site API covers the same leagues and more, with no key and no cost.
 *
 * Honesty rule: an ESPN answer is labelled `source: "espn"` and carries
 * `verified: false`, `proof: null`. It is signed by this miner (attestation),
 * which proves who said it — not that it is true. Only a TxLINE answer with a
 * published Merkle proof is independently verifiable.
 */

import { track } from './observe.js';
import { normalizeTeamName } from './utils.js';
import { resultFromScores, winnerFor } from './answer.js';

const BASE = process.env.ESPN_API_BASE || 'https://site.api.espn.com/apis/site/v2/sports';
const TIMEOUT_MS = Number(process.env.ESPN_TIMEOUT_MS || 6000);
/** How many days back to look for a completed game when none is on today's board. */
const LOOKBACK_DAYS = Number(process.env.ESPN_LOOKBACK_DAYS || 4);

export const LEAGUES = [
  { key: 'mlb', sport: 'baseball', slug: 'mlb', name: 'MLB', aliases: ['mlb', 'baseball', 'major league baseball'] },
  { key: 'nfl', sport: 'football', slug: 'nfl', name: 'NFL', aliases: ['nfl', 'national football league'] },
  { key: 'ncaaf', sport: 'football', slug: 'college-football', name: 'NCAA Football', aliases: ['ncaaf', 'college football', 'cfb'] },
  { key: 'nba', sport: 'basketball', slug: 'nba', name: 'NBA', aliases: ['nba', 'basketball'] },
  { key: 'wnba', sport: 'basketball', slug: 'wnba', name: 'WNBA', aliases: ['wnba'] },
  { key: 'nhl', sport: 'hockey', slug: 'nhl', name: 'NHL', aliases: ['nhl', 'hockey'] },
  { key: 'epl', sport: 'soccer', slug: 'eng.1', name: 'Premier League', aliases: ['premier league', 'epl', 'pl', 'english premier league'] },
  { key: 'mls', sport: 'soccer', slug: 'usa.1', name: 'MLS', aliases: ['mls', 'major league soccer'] },
  { key: 'laliga', sport: 'soccer', slug: 'esp.1', name: 'La Liga', aliases: ['la liga', 'laliga'] },
  { key: 'bundesliga', sport: 'soccer', slug: 'ger.1', name: 'Bundesliga', aliases: ['bundesliga'] },
  { key: 'seriea', sport: 'soccer', slug: 'ita.1', name: 'Serie A', aliases: ['serie a'] },
  { key: 'ligue1', sport: 'soccer', slug: 'fra.1', name: 'Ligue 1', aliases: ['ligue 1'] },
  { key: 'ucl', sport: 'soccer', slug: 'uefa.champions', name: 'Champions League', aliases: ['champions league', 'ucl'] },
];

// ─── fetch + cache ──────────────────────────────────────────────────────────

const cache = new Map();
const CACHE_MAX = 200;
/** Today's board moves; a past day's finals do not. */
const TTL_LIVE_MS = 60_000;
const TTL_PAST_MS = 30 * 60_000;

async function fetchBoard(league, yyyymmdd) {
  const key = `${league.key}:${yyyymmdd ?? 'now'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data;

  const url = `${BASE}/${league.sport}/${league.slug}/scoreboard${yyyymmdd ? `?dates=${yyyymmdd}` : ''}`;
  const data = await track('espn', async () => {
    // No custom User-Agent: ESPN answers 403 to anything but its defaults
    // (measured 2026-09-28 — "fourcast-…/1.1" and "Mozilla/5.0" both refused).
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`ESPN ${league.slug} ${yyyymmdd ?? 'now'} -> ${res.status}`);
    return res.json();
  });

  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), ttl: yyyymmdd ? TTL_PAST_MS : TTL_LIVE_MS, data });
  return data;
}

/** One board, never throwing — a league that fails is a league with no games. */
async function eventsFor(league, yyyymmdd) {
  try {
    const data = await fetchBoard(league, yyyymmdd);
    return (data?.events ?? []).map((e) => ({ league, event: e }));
  } catch {
    return [];
  }
}

// ─── matching ───────────────────────────────────────────────────────────────

/**
 * How well a search term names a team. 0 = not this team.
 *
 * Deliberately stricter than utils.fuzzyMatch: "Manchester City" sharing the
 * word "manchester" with Manchester United is exactly the attribution error
 * that makes an answer about the wrong game. Every word of the search must be
 * present in the team's names.
 */
export function teamScore(search, team) {
  const s = normalizeTeamName(search);
  if (!s || !team) return 0;
  const names = [team.displayName, team.shortDisplayName, team.name, team.location]
    .filter(Boolean)
    .map(normalizeTeamName);
  const abbr = String(team.abbreviation || '').toLowerCase();

  if (names.includes(s)) return 4;
  if (abbr && s === abbr) return 3;
  const full = names[0] || '';
  if (full.includes(s) || (s.length >= 4 && s.includes(full))) return 3;
  const haystack = new Set(names.join(' ').split(' ').filter(Boolean));
  const words = s.split(' ').filter(Boolean);
  if (words.length && words.every((w) => haystack.has(w))) return 2;
  return 0;
}

function competitorsOf(event) {
  const comp = event?.competitions?.[0];
  const list = comp?.competitors ?? [];
  return {
    home: list.find((c) => c.homeAway === 'home') ?? list[0] ?? null,
    away: list.find((c) => c.homeAway === 'away') ?? list[1] ?? null,
  };
}

function statusOf(event) {
  const t = event?.status?.type ?? event?.competitions?.[0]?.status?.type ?? {};
  const name = String(t.name || '');
  if (t.state === 'post' && t.completed) return 'final';
  if (/POSTPONED/.test(name)) return 'postponed';
  if (/CANCEL/.test(name)) return 'cancelled';
  if (t.state === 'in') return 'live';
  if (t.state === 'post') return 'postponed'; // over but not completed: suspended/abandoned
  return 'scheduled';
}

/** Normalize an ESPN event into this miner's answer shape. */
export function toAnswer({ league, event }) {
  const { home, away } = competitorsOf(event);
  const status = statusOf(event);
  // ESPN reports "0" for a game that has not started. That is not a score.
  const scored = status === 'final' || status === 'live';
  const num = (c) => (scored && c?.score != null && c.score !== '' ? Number(c.score) : null);
  const homeScore = num(home);
  const awayScore = num(away);
  const homeTeam = home?.team?.displayName || null;
  const awayTeam = away?.team?.displayName || null;
  const result = status === 'final' ? resultFromScores(homeScore, awayScore) : null;
  const t = event?.status?.type ?? {};

  return {
    fixture_id: `espn:${league.key}:${event.id}`,
    competition: league.name,
    competition_id: `espn:${league.slug}`,
    home_team: homeTeam,
    away_team: awayTeam,
    home_score: homeScore,
    away_score: awayScore,
    status,
    kickoff: event.date ? new Date(event.date).toISOString() : null,
    minute: null,
    clock: status === 'live' ? t.shortDetail || null : null,
    result,
    winner: status === 'final' ? winnerFor(result, homeTeam, awayTeam) : null,
    source: 'espn',
    source_url: event.links?.find((l) => l.href)?.href ?? null,
    verified: false,
    proof_available: false,
    proof: null,
  };
}

/** Leagues to search: named competition first, otherwise every league. */
export function leaguesFor(competition) {
  if (!competition) return LEAGUES;
  const c = String(competition).toLowerCase().trim();
  const named = LEAGUES.filter((l) => l.aliases.includes(c) || l.name.toLowerCase() === c);
  return named.length ? named : LEAGUES;
}

/** YYYYMMDD in US Eastern, the day ESPN files a game under. */
export function espnDate(msOrDate) {
  const d = new Date(msOrDate);
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return s.replaceAll('-', '');
}

const STATUS_RANK = { live: 3, final: 2, scheduled: 1 };

function pick(candidates, { team, opponent, wantFinal }) {
  let best = null;
  for (const c of candidates) {
    const status = statusOf(c.event);
    if (wantFinal && status !== 'final') continue;
    const { home, away } = competitorsOf(c.event);
    const sh = team ? teamScore(team, home?.team) : 1;
    const sa = team ? teamScore(team, away?.team) : 1;
    let score = Math.max(sh, sa);
    if (!score) continue;
    if (opponent) {
      const other = sh >= sa ? away?.team : home?.team;
      const so = teamScore(opponent, other);
      if (!so) continue; // named an opponent; a game against someone else is the wrong game
      score += so;
    }
    const when = Date.parse(c.event.date) || 0;
    const rank = STATUS_RANK[status] ?? 0;
    // Best name match first; then live over final over upcoming; then newest.
    if (
      !best ||
      score > best.score ||
      (score === best.score && (rank > best.rank || (rank === best.rank && when > best.when)))
    ) {
      best = { ...c, score, rank, when };
    }
  }
  return best;
}

/**
 * Find a team's game.
 *
 * GAME_RESULT (`wantFinal`) wants the most recent *completed* game: today's
 * board first, then back one day at a time. SPORTS_SCORE takes whatever is on
 * today's board (live, final or next), falling back the same way.
 *
 * @returns {Promise<{ answer: object|null, searched: object }>}
 */
export async function findGame({ team, opponent, competition, date, wantFinal = false }) {
  const searched = { leagues: [], days: [] };
  // No team is only answerable when a league is named ("latest Premier League
  // result"); a bare ask across every league has no single right answer.
  if (!team && !competition) return { answer: null, searched };
  const leagues = leaguesFor(competition);
  if (!team && leagues === LEAGUES) return { answer: null, searched };
  searched.leagues = leagues.map((l) => l.key);

  const days = [];
  if (date) {
    const base = Date.parse(`${date}T12:00:00Z`);
    if (Number.isFinite(base)) days.push(espnDate(base), espnDate(base + 86_400_000));
  } else {
    days.push(null); // today's default board (a week for NFL/NCAAF)
    for (let i = 1; i <= LOOKBACK_DAYS; i++) days.push(espnDate(Date.now() - i * 86_400_000));
  }

  for (const day of days) {
    searched.days.push(day ?? 'today');
    const lists = await Promise.all(leagues.map((l) => eventsFor(l, day)));
    const hit = pick(lists.flat(), { team, opponent, wantFinal });
    if (hit) return { answer: toAnswer(hit), searched };
  }
  return { answer: null, searched };
}

export function clearEspnCache() {
  cache.clear();
}
