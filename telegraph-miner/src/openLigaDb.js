/**
 * Free-alternative results provider: OpenLigaDB (keyless, community).
 * Backed by live 2026-season coverage (measured 2026-09-29: Bundesliga `bl1`
 * serves all 306 matches of 2026/27). Final results ONLY — never odds, never
 * proofs. Answers carry `verified: false`, `source: 'openligadb'`.
 */

const BASE = process.env.OPENLIGADB_BASE || 'https://api.openligadb.de';
const TIMEOUT_MS = Number(process.env.OPENLIGADB_TIMEOUT_MS || 6000);

export const OPENLIGA_LEAGUES = [
  { key: 'bl1', name: 'Bundesliga', aliases: ['bundesliga', 'german bundesliga', '1. bundesliga'] },
  { key: 'bl2', name: '2. Bundesliga', aliases: ['2. bundesliga', 'zweite bundesliga'] },
  { key: 'bl3', name: '3. Liga', aliases: ['3. liga', 'dritte liga'] },
];

const cache = new Map();
const CACHE_MAX = 100;

async function fetchJson(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.data;
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenLigaDB ${path} -> ${res.status}`);
  const data = await res.json();
  cache.set(path, { at: Date.now(), data });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return data;
}

function isFinished(match) {
  if (!match || match.matchIsFinished !== true) return false;
  const results = match.matchResults || [];
  const end = results.find((r) => r?.resultName === 'Endergebnis') || results[results.length - 1];
  return end?.pointsTeam1 != null && end?.pointsTeam2 != null;
}

function scoreOf(match) {
  const results = match.matchResults || [];
  const end = results.find((r) => r?.resultName === 'Endergebnis') || results[results.length - 1] || {};
  return { home: end.pointsTeam1 ?? null, away: end.pointsTeam2 ?? null };
}

function teamNames(match) {
  return {
    home: match.team1?.teamName || match.team1?.shortName || null,
    away: match.team2?.teamName || match.team2?.shortName || null,
  };
}

function nameScore(name, candidate) {
  if (!name || !candidate) return 0;
  const n = String(name).toLowerCase().trim();
  const c = String(candidate).toLowerCase().trim();
  if (!n || !c) return 0;
  if (n === c) return 3;
  if (n.includes(c) || c.includes(n)) return 2;
  const words = c.split(/[\s-]+/).filter((w) => w.length > 2);
  if (words.some((w) => n.includes(w))) return 1;
  return 0;
}

function leaguesFor(competition) {
  if (!competition) return OPENLIGA_LEAGUES;
  const c = String(competition).toLowerCase();
  const named = OPENLIGA_LEAGUES.filter((l) =>
    l.name.toLowerCase() === c || l.aliases.some((a) => a === c || c.includes(a)));
  return named.length ? named : OPENLIGA_LEAGUES;
}

function toAnswer(match, league) {
  const { home, away } = teamNames(match);
  const { home: hs, away: as } = scoreOf(match);
  const homeTeam = home || 'Home';
  const awayTeam = away || 'Away';
  const result = hs > as ? 'home_win' : hs < as ? 'away_win' : 'draw';
  const winner = result === 'home_win' ? homeTeam : result === 'away_win' ? awayTeam : null;
  return {
    fixture_id: `openligadb:${match.matchID}`,
    competition: league.name,
    competition_id: null,
    home_team: homeTeam,
    away_team: awayTeam,
    home_score: hs,
    away_score: as,
    status: 'final',
    kickoff: match.matchDateTimeUTC ? new Date(match.matchDateTimeUTC).toISOString() : null,
    result,
    winner,
    source: 'openligadb',
    verified: false,
    proof_available: false,
    proof: null,
    summary: winner
      ? `${winner} beat ${result === 'home_win' ? awayTeam : homeTeam} ${hs}-${as} (final)`
      : `${homeTeam} drew ${awayTeam} ${hs}-${as} (final)`,
  };
}

/**
 * Find a team's most recent completed game.
 * @returns {Promise<{ answer: object|null, searched: object }>}
 */
export async function findOpenLigaGame({ team, opponent, competition, date } = {}) {
  const searched = { leagues: [], seasons: [] };
  const leagues = leaguesFor(competition);
  if (!team && !competition) return { answer: null, searched };
  if (!team && leagues === OPENLIGA_LEAGUES) return { answer: null, searched };
  searched.leagues = leagues.map((l) => l.key);

  const now = new Date();
  const year = now.getUTCFullYear();
  const seasons = now.getUTCMonth() >= 6 ? [year] : [year - 1, year];
  searched.seasons = seasons;

  let best = null;
  for (const league of leagues) {
    for (const y of seasons) {
      let matches;
      try {
        matches = await fetchJson(`/getmatchdata/${league.key}/${y}`);
      } catch {
        continue;
      }
      if (!Array.isArray(matches)) continue;
      for (const m of matches) {
        if (!isFinished(m)) continue;
        if (date && String(m.matchDateTimeUTC || '').slice(0, 10) !== String(date).slice(0, 10)) continue;
        const { home, away } = teamNames(m);
        const sh = team ? nameScore(team, home) : 1;
        const sa = team ? nameScore(team, away) : 1;
        let score = Math.max(sh, sa);
        if (!score) continue;
        if (opponent) {
          const so = nameScore(opponent, sh >= sa ? away : home);
          if (!so) continue;
          score += so;
        }
        const when = Date.parse(m.matchDateTimeUTC || m.matchDateTime) || 0;
        if (!best || score > best.score || (score === best.score && when > best.when)) {
          best = { match: m, league, score, when };
        }
      }
    }
  }
  if (!best) return { answer: null, searched };
  return { answer: toAnswer(best.match, best.league), searched };
}

export function clearOpenLigaCache() {
  cache.clear();
}

