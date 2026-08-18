/**
 * ESPN free sports-odds provider.
 *
 * Zero-cost alternative to the paid TxLINE mainnet subscription: ESPN's public
 * JSON endpoints (`site.api.espn.com`) return bookmaker moneyline odds with NO
 * API key and no cost. Consumed by `delphiIntelligence.matchEspnOdds()` as the
 * free sports-odds anchor, falling back to the blind LLM when no ESPN line is
 * posted for a market.
 *
 * Coverage: soccer (Premier League / MLS), NFL, and the big LaLiga/Bundesliga.
 * Reliability caveat: ESPN only posts odds for fixtures close enough to kickoff
 * that a line exists; otherwise this module returns null and the caller falls
 * through. It is a free convenience, never a hard dependency.
 *
 * Tuning: ESPN_SCOREBOARD_TTL_MS - scoreboard cache TTL (default 5 min).
 */

// ─── ESPN throttle guard & scoreboard cache ────────────────────────────────────

const SCOREBOARD_TTL_MS = Number(process.env.ESPN_SCORE_TTL_MS || 5 * 60 * 1000);
const SCOREBOARD_CACHE_MAX = 10; // Keep only the most recent scoreboards per league

// Scoreboard cache with LRU eviction: keyed by `${sport}/${slug}?dates=...`
// Evicts LRU entry when full to bound memory across cycles.
const scoreboardCache = new Map();

/**
 * Rate limiter for ESPN fetches. Prevents hitting ESPN's undocumented
 * rate limits (429s) when multiple markets share the same league.
 * Max 2 fetches per second per league, with a FIFO queue.
 */
const ESPN_THROTTLE_INTERVAL_MS = 500; // 2/sec max per league
const fetchQueue = new Map(); // league slug -> { lastFetch: number, queue: Promise[] }

function getFetchQueue(slug) {
  if (!fetchQueue.has(slug)) {
    fetchQueue.set(slug, { lastFetch: 0, queue: [] });
  }
  return fetchQueue.get(slug);
}

async function throttleFetch(slug, fn) {
  const q = getFetchQueue(slug);
  const now = Date.now();
  const waitMs = Math.max(0, ESPN_THROTTLE_INTERVAL_MS - (now - q.lastFetch));
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }
  q.lastFetch = Date.now();
  return fn();
}

/**
 * Get from LRU scoreboard cache. Promotes key to most-recently-used.
 * Returns null if cache miss or expired.
 */
function getScoreboardCache(key) {
  if (!scoreboardCache.has(key)) return null;
  const entry = scoreboardCache.get(key);
  scoreboardCache.delete(key);
  scoreboardCache.set(key, entry);
  if (Date.now() - entry.at < SCOREBOARD_TTL_MS) return entry.data;
  scoreboardCache.delete(key); // expired
  return null;
}

/**
 * Set scoreboard cache with LRU eviction. Removes oldest entry when full.
 */
function setScoreboardCache(key, data) {
  while (scoreboardCache.size >= SCOREBOARD_CACHE_MAX) {
    const oldest = scoreboardCache.keys().next().value;
    scoreboardCache.delete(oldest);
  }
  scoreboardCache.set(key, { at: Date.now(), data });
}

function cacheKey(sport, slug, date) {
  return `${sport}/${slug}?dates=${date || ''}`;
}

async function fetchScoreboard(league, date) {
  const key = cacheKey(league.sport, league.slug, date);

  // Check cache first
  const cached = getScoreboardCache(key);
  if (cached) return cached;

  // Throttle ESPN fetches to avoid 429s
  const data = await throttleFetch(league.slug, async () => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.slug}/scoreboard${
      date ? `?dates=${date}` : ''
    }`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return res.json();
  });

  if (data !== null) {
    setScoreboardCache(key, data);
  }
  return data;
}

// leagueId hints are substrings checked against question+description.
const LEAGUES = [
  {
    sport: 'soccer',
    slug: 'eng.1',
    name: 'English Premier League',
    hints: [
      'premier league', 'premier-league',
      'arsenal', 'liverpool', 'manchester city', 'man city', 'manchester united',
      'man united', 'chelsea', 'tottenham', 'spurs', 'aston villa', 'newcastle',
      'brighton', 'fulham', 'brentford', 'bournemouth', 'crystal palace',
      'everton', 'nottingham', 'west ham', 'coventry', 'leeds', 'ipswich',
    ],
  },
  {
    sport: 'soccer',
    slug: 'usa.1',
    name: 'MLS',
    hints: [
      'mls', 'major league soccer', 'inter miami', 'la galaxy', 'lafc',
      'atlanta united', 'seattle sounders', 'portland timbers', 'columbus crew',
      'fc cincinnati', 'philadelphia union', 'new york city', 'ny red bulls',
      'orlando city', 'charlotte fc', 'dc united', 'toronto fc', 'montreal',
      'new england', 'chicago fire', 'houston dynamo', 'austin fc',
      'real salt lake', 'sporting kansas city', 'colorado rapids',
      'minnesota united', 'san jose', 'vancouver whitecaps', 'st. louis city',
    ],
  },
  {
    sport: 'football',
    slug: 'nfl',
    name: 'NFL',
    hints: [
      'nfl', 'super bowl', 'chiefs', 'eagles', 'bills', '49ers', 'cowboys',
      'ravens', 'lions', 'dolphins', 'packers', 'rams', 'bengals', 'seahawks',
      'jets', 'texans', 'steelers', 'giants', 'bears', 'raiders', 'broncos',
      'chargers', 'patriots', 'saints', 'vikings', 'cardinals', 'colts',
      'titans', 'commanders', 'falcons', 'panthers', 'buccaneers', 'browns',
    ],
  },
  {
    sport: 'soccer',
    slug: 'esp.1',
    name: 'La Liga',
    hints: ['la liga', 'real madrid', 'barcelona', 'athletic club', 'atletico'],
  },
  {
    sport: 'soccer',
    slug: 'ger.1',
    name: 'Bundesliga',
    hints: ['bundesliga', 'bayern munich', 'borussia dortmund', 'dortmund', 'bayer leverkusen'],
  },
];

// ─── pure helpers ─────────────────────────────────────────────────────────────

/** Convert American moneyline (e.g. -155, +650) to a 0..1 implied probability. */
export function americanToProbability(raw) {
  if (raw === null || raw === undefined) return null;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n === 0) return null;
  if (n < 0) return -n / (-n + 100);
  return 100 / (100 + n);
}

/** De-vig the 1X2 moneyline into a true probability distribution (sums to 1). */
export function normalize1x2(homeAmerican, drawAmerican, awayAmerican) {
  const h = americanToProbability(homeAmerican);
  const d = americanToProbability(drawAmerican);
  const a = americanToProbability(awayAmerican);
  if (h === null || d === null || a === null) return null;
  const total = h + d + a;
  if (!(total > 0)) return null;
  return { home: h / total, draw: d / total, away: a / total };
}

/** Pick the ESPN league whose hints appear in the market text. */
export function classifyLeague(text) {
  const t = (text || '').toLowerCase();
  return LEAGUES.find((l) => l.hints.some((h) => t.includes(h))) || null;
}

function matchEvent(marketText, events) {
  const t = (marketText || '').toLowerCase();
  const norm = (s) => String(s || '').toLowerCase().trim();

  let best = null;
  let bestScore = 0;
  for (const ev of events || []) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const listed = (comp.competitors || []).map((c) => norm(c?.team?.displayName));
    if (listed.length < 2) continue;

    let score = 0;
    for (const name of listed) {
      if (name.length <= 3) continue; // short tokens like "City" are ambiguous
      if (t.includes(name)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = { event: ev, homeName: listed[0], awayName: listed[1] };
    }
  }
  return bestScore >= 1 ? best : null;
}

function extractOdds(comp) {
  const ml = comp?.odds?.[0]?.moneyline;
  if (!ml?.home || !ml?.away || !ml?.draw) return null;
  const pick = (side) => side.close?.odds ?? side.open?.odds;
  return { homeAmerican: pick(ml.home), drawAmerican: pick(ml.draw), awayAmerican: pick(ml.away) };
}

/**
 * Merge scoreboard event lists, de-duplicating by event id (order preserved:
 * first source wins). Guards against the ESPN date-boundary quirk where a
 * `dates=YYYYMMDD` query for today returns ZERO events while the no-date
 * (current) scoreboard has the same fixtures under the following UTC date —
 * a naive `dated || default` fallback silently drops live markets.
 */
export function mergeScoreboardEvents(...groups) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const ev of group || []) {
      const id = ev?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(ev);
    }
  }
  return out;
}

/**
 * Fetch free ESPN consensus odds for a Delphi sports market.
 * @param {{question:string, description?:string, resolvesAt?:string}} market
 * @returns {Promise<{fixture, homeProb, drawProb, awayProb, league, provider}|null>}
 */
export async function getConsensusGame({ question, description, resolvesAt }) {
  try {
    const text = `${question} ${description || ''}`;
    const league = classifyLeague(text);
    if (!league) return null;

    // Gather both the no-date (current) scoreboard AND the resolution-day
    // window, then merge: the current window reliably carries live/near-kickoff
    // games (which a resolved-today `dates=` query can miss due to ESPN's UTC
    // day boundary), while the dated window carries fixtures further out.
    const date = resolvesAt ? String(resolvesAt).slice(0, 10).replace(/-/g, '') : null;
    const [defaultData, datedData] = [
      await fetchScoreboard(league, null),
      date ? await fetchScoreboard(league, date) : null,
    ];
    const events = mergeScoreboardEvents(defaultData?.events, datedData?.events);
    if (!events.length) return null;

    const match = matchEvent(text, events);
    if (!match) return null;

    const odds = extractOdds(match.event.competitions[0]);
    if (!odds) return null;

    const probs = normalize1x2(odds.homeAmerican, odds.drawAmerican, odds.awayAmerican);
    if (!probs) return null;

    return {
      fixture: { home: { name: match.homeName }, away: { name: match.awayName } },
      homeProb: probs.home,
      drawProb: probs.draw,
      awayProb: probs.away,
      league: league.name,
      provider: match.event.competitions[0].odds[0]?.provider?.name || 'ESPN',
    };
  } catch (err) {
    // Not available/parseable — caller falls through to the blind LLM.
    return null;
  }
}

export default { americanToProbability, normalize1x2, classifyLeague, getConsensusGame, mergeScoreboardEvents };