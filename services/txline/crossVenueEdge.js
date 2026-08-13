/**
 * Cross-venue edge detection - TxLINE consensus vs Polymarket/Delphi.
 *
 * TxLINE provides trusted consensus odds (Bookmaker = TXLineStablePriceDemargined)
 * for fixtures across MLS, Premier League, NFL, and more. Polymarket and other
 * prediction venues offer peer-to-peer pricing on the same events. The gap
 * between the two is the cross-venue edge Fourcast surfaces.
 *
 * Example callout:
 *   "TxLINE consensus is 61%, Polymarket trading at 54% - 7-pt cross-venue discrepancy"
 *
 * Polymarket's public gamma API is read-only and doesn't require auth.
 *   GET https://gamma-api.polymarket.com/events?closed=false&limit=100
 *
 * Each event has markets[]; each market has `question`, `outcomes` (["Yes","No"]),
 * and `outcomePrices` (["0.55", "0.45"]). outcomePrices[0] is the YES price =
 * implied probability of the YES outcome.
 */

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

let cachedSoccerEvents = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function teamAliases(name) {
  if (!name) return [];
  const n = name.trim();
  const lower = n.toLowerCase();
  const aliases = new Set([n, lower]);

  // Lookup in registry (case-insensitive)
  if (TEAM_ALIAS_REGISTRY[lower]) {
    for (const a of TEAM_ALIAS_REGISTRY[lower]) aliases.add(a);
  }

  // Fuzzy fallback: try matching without "fc", "sc", "cf" suffixes/prefixes
  const stripped = lower.replace(/\b(fc|sc|cf|afc|utd|united|city)\b/g, '').trim();
  if (stripped !== lower && TEAM_ALIAS_REGISTRY[stripped]) {
    for (const a of TEAM_ALIAS_REGISTRY[stripped]) aliases.add(a);
  }

  return Array.from(aliases);
}

/**
 * Comprehensive team alias registry — maps lowercased canonical name to
 * an array of known aliases (abbreviations, city names, short-forms).
 *
 * Covers: World Cup nations, MLS clubs, Premier League 2026/27 clubs.
 * TxLINE fixture Participant names are the lookup keys.
 */
const TEAM_ALIAS_REGISTRY = {
  // ─── World Cup Nations ──────────────────────────────────────────────
  'spain': ['spain', 'esp', 'es'],
  'argentina': ['argentina', 'arg', 'ar'],
  'france': ['france', 'fra', 'fr'],
  'england': ['england', 'eng', 'en'],
  'morocco': ['morocco', 'mar', 'ma'],
  'brazil': ['brazil', 'bra', 'br'],
  'germany': ['germany', 'ger', 'de'],
  'portugal': ['portugal', 'por', 'pt'],
  'netherlands': ['netherlands', 'ned', 'dutch', 'holland'],
  'usa': ['usa', 'us', 'united states', 'usmnt'],
  'mexico': ['mexico', 'mex', 'el tri'],
  'japan': ['japan', 'jpn'],
  'south korea': ['south korea', 'kor', 'korea republic', 'korea'],
  'australia': ['australia', 'aus', 'socceroos'],
  'canada': ['canada', 'can'],
  'croatia': ['croatia', 'cro', 'hrvatska'],
  'belgium': ['belgium', 'bel'],
  'uruguay': ['uruguay', 'uru'],
  'colombia': ['colombia', 'col'],
  'senegal': ['senegal', 'sen'],
  'switzerland': ['switzerland', 'sui', 'suisse'],
  'denmark': ['denmark', 'den'],
  'poland': ['poland', 'pol'],
  'serbia': ['serbia', 'srb'],
  'italy': ['italy', 'ita'],

  // ─── MLS Clubs (all 29 teams, 2026 season) ─────────────────────────
  // Names matched to TxLINE Participant field from /fixtures/snapshot
  'atlanta united': ['atlanta united', 'atlanta', 'atl utd', 'atl', 'atlanta united fc'],
  'austin fc': ['austin fc', 'austin', 'atx'],
  'charlotte': ['charlotte', 'charlotte fc', 'clt'],
  'chicago fire': ['chicago fire', 'chicago', 'chi', 'chicago fire fc'],
  'colorado rapids': ['colorado rapids', 'colorado', 'col rapids'],
  'columbus crew': ['columbus crew', 'columbus', 'crew', 'columbus crew sc'],
  'dc united': ['dc united', 'dc', 'd.c. united', 'dcu'],
  'fc cincinnati': ['fc cincinnati', 'cincinnati', 'cincy', 'fcc'],
  'fc dallas': ['fc dallas', 'dallas', 'fcd'],
  'houston dynamo': ['houston dynamo', 'houston', 'dynamo', 'houston dynamo fc'],
  'inter miami': ['inter miami', 'miami', 'inter miami cf'],
  'la galaxy': ['la galaxy', 'galaxy', 'los angeles galaxy', 'lag'],
  'los angeles': ['los angeles', 'lafc', 'los angeles fc', 'la fc'],
  'minnesota united': ['minnesota united', 'minnesota', 'mnufc', 'minnesota united fc', 'loons'],
  'montreal': ['montreal', 'cf montreal', 'cf montréal', 'mtl'],
  'nashville': ['nashville', 'nashville sc', 'nsh'],
  'nashville sc': ['nashville sc', 'nashville', 'nsh'],
  'new england': ['new england', 'new england revolution', 'ne revolution', 'revs', 'ner'],
  'new york city': ['new york city', 'nycfc', 'nyc fc', 'new york city fc', 'nyc'],
  'ny red bulls': ['ny red bulls', 'new york red bulls', 'red bulls', 'nyrb', 'rbny'],
  'orlando city': ['orlando city', 'orlando', 'orl', 'orlando city sc'],
  'philadelphia union': ['philadelphia union', 'philadelphia', 'philly', 'phi', 'union'],
  'portland timbers': ['portland timbers', 'portland', 'timbers', 'ptfc'],
  'real salt lake': ['real salt lake', 'rsl', 'salt lake'],
  'san jose earthquakes': ['san jose earthquakes', 'san jose', 'sj earthquakes', 'quakes', 'sje'],
  'seattle': ['seattle', 'seattle sounders', 'seattle sounders fc', 'sounders', 'sea'],
  'seattle sounders': ['seattle sounders', 'seattle', 'seattle sounders fc', 'sounders', 'sea'],
  'sporting kansas city': ['sporting kansas city', 'kansas city', 'skc', 'sporting kc'],
  'st. louis city': ['st. louis city', 'st louis', 'stl', 'st. louis city sc', 'st louis city'],
  'toronto': ['toronto', 'toronto fc', 'tfc', 'tor'],
  'vancouver whitecaps': ['vancouver whitecaps', 'vancouver', 'whitecaps', 'vwfc', 'van'],

  // ─── Premier League 2026/27 (all 20 clubs) ─────────────────────────
  'arsenal': ['arsenal', 'ars', 'afc', 'the gunners', 'gunners'],
  'aston villa': ['aston villa', 'villa', 'avl', 'avfc'],
  'bournemouth': ['bournemouth', 'bou', 'afc bournemouth', 'cherries'],
  'brentford': ['brentford', 'bre', 'brentford fc', 'bees'],
  'brighton': ['brighton', 'bha', 'brighton & hove albion', 'brighton and hove albion', 'seagulls'],
  'chelsea': ['chelsea', 'che', 'cfc', 'blues'],
  'coventry': ['coventry', 'cov', 'coventry city', 'sky blues'],
  'crystal palace': ['crystal palace', 'cry', 'palace', 'cpfc', 'eagles'],
  'everton': ['everton', 'eve', 'efc', 'toffees'],
  'fulham': ['fulham', 'ful', 'ffc', 'cottagers'],
  'hull city': ['hull city', 'hull', 'hul', 'tigers'],
  'ipswich town': ['ipswich town', 'ipswich', 'ips', 'itfc', 'tractor boys'],
  'leeds': ['leeds', 'leeds united', 'lee', 'lufc'],
  'liverpool': ['liverpool', 'liv', 'lfc', 'reds'],
  'manchester city': ['manchester city', 'man city', 'mci', 'mcfc', 'city', 'cityzens'],
  'manchester united': ['manchester united', 'man united', 'man utd', 'mun', 'mufc', 'red devils'],
  'newcastle': ['newcastle', 'newcastle united', 'new', 'nufc', 'magpies', 'toon'],
  'nottingham forest': ['nottingham forest', 'nott forest', 'nfo', 'nffc', 'forest'],
  'tottenham': ['tottenham', 'tottenham hotspur', 'spurs', 'tot', 'thfc'],
  'west ham': ['west ham', 'west ham united', 'whu', 'hammers', 'irons'],
};

async function fetchOpenSoccerEvents() {
  // 1-min in-memory cache; the gamma API is rate-limited
  if (cachedSoccerEvents && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSoccerEvents;
  }
  // Polymarket's /events returns a maximum of 100 per page; paginate up to 300.
  const all = [];
  for (let off = 0; off < 300; off += 100) {
    const url = `${GAMMA_BASE}/events?closed=false&limit=100&offset=${off}`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/json', 'User-Agent': 'fourcast/1.0' },
      });
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      all.push(...data);
      if (data.length < 100) break;
    } catch {
      break;
    }
  }
  cachedSoccerEvents = all;
  cachedAt = Date.now();
  return cachedSoccerEvents;
}

/**
 * Find the World Cup outright winner market for a given team.
 * Polymarket exposes this as the event slug "world-cup-winner" with 60
 * markets of the form "Will {team} win the World Cup?".
 */
function findOutrightWinner(events, teamName) {
  if (!teamName) return null;
  const aliases = teamAliases(teamName);
  const matchesAlias = (text) => {
    if (!text) return false;
    const t = text.toLowerCase();
    return aliases.some((a) => {
      if (a.length <= 3) return new RegExp(`\\b${a}\\b`, 'i').test(t);
      return t.includes(a);
    });
  };

  for (const ev of events) {
    if ((ev.slug || '') !== 'world-cup-winner' && !(ev.title || '').toLowerCase().includes('world cup winner')) continue;
    const markets = Array.isArray(ev.markets) ? ev.markets : [];
    for (const m of markets) {
      const q = (m.question || '').toLowerCase();
      // Question shape: "Will {Team} win the 2026 FIFA World Cup?"
      if (/win the .* world cup/i.test(q) && matchesAlias(m.question)) {
        return { event: ev, market: m };
      }
    }
  }
  return null;
}

/**
 * Find the best-matching Polymarket market for a fixture.
 * Heuristic: look for an event whose title or markets mention both team
 * names; prefer markets whose question contains the home team name +
 * "win" or "beat" or "vs" or "v".
 */
function findMatchingMarket(events, homeName, awayName) {
  if (!homeName || !awayName) return null;
  const homeAliases = teamAliases(homeName);
  const awayAliases = teamAliases(awayName);

  const textContainsAny = (text, aliases) => {
    if (!text) return false;
    const t = text.toLowerCase();
    return aliases.some((a) => {
      // word-boundary match for short aliases
      if (a.length <= 3) return new RegExp(`\\b${a}\\b`, 'i').test(t);
      return t.includes(a);
    });
  };

  for (const ev of events) {
    const evTitle = ev.title || ev.slug || '';
    const evHasBoth =
      textContainsAny(evTitle, homeAliases) &&
      textContainsAny(evTitle, awayAliases);
    if (!evHasBoth) continue;

    const markets = Array.isArray(ev.markets) ? ev.markets : [];
    for (const m of markets) {
      const q = (m.question || '').toLowerCase();
      const asksHomeWin = /win|beat|advance|reach|defeat/.test(q) && textContainsAny(q, homeAliases);
      const asksAwayWin = /win|beat|advance|reach|defeat/.test(q) && textContainsAny(q, awayAliases);
      const isMatchWinner = /match winner|to win|vs|v\.|versus/.test(q);
      if (asksHomeWin || isMatchWinner) {
        return { event: ev, market: m, side: 'home', asksHomeWin: true };
      }
      if (asksAwayWin) {
        return { event: ev, market: m, side: 'away', asksHomeWin: false };
      }
    }
  }
  return null;
}

function parseYesPrice(market) {
  if (!market) return null;
  let prices = market.outcomePrices;
  if (typeof prices === 'string') {
    try { prices = JSON.parse(prices); } catch { prices = null; }
  }
  if (!Array.isArray(prices) || prices.length < 1) return null;
  const p = parseFloat(prices[0]);
  // Accept 0 (legitimate "0% chance / resolved NO" price) up to 1.
  return Number.isFinite(p) && p >= 0 && p <= 1 ? p : null;
}

/**
 * Compute cross-venue edge for a TxLINE fixture.
 *
 * @param {object} fixture - normalized TxLINE fixture with odds.implied
 * @returns {object} { found, polymarket: {yesPrice, question, marketUrl, eventUrl, side }, txline: {home,draw,away}, edge: {direction, pointsHome, pointsAway, summary} }
 */
export async function getCrossVenueEdge(fixture) {
  const txlineImplied = fixture?.odds?.implied || null;
  const homeName = fixture?.home?.name;
  const awayName = fixture?.away?.name;

  if (!txlineImplied || !homeName || !awayName) {
    return {
      found: false,
      reason: 'Missing TxLINE consensus odds or team names',
      txline: txlineImplied,
    };
  }

  let events;
  try {
    events = await fetchOpenSoccerEvents();
  } catch (err) {
    return {
      found: false,
      reason: `Polymarket fetch failed: ${err.message}`,
      txline: txlineImplied,
    };
  }

  const match = findMatchingMarket(events, homeName, awayName);
  if (!match) {
    // No per-match Polymarket market — this itself is the cross-venue story.
    // Fall back to the outright World Cup winner YES price for context, but
    // be explicit that the two measure different things.
    const outrightHome = findOutrightWinner(events, homeName);
    const outrightAway = findOutrightWinner(events, awayName);
    const outrightHomeYes = outrightHome ? parseYesPrice(outrightHome.market) : null;
    const outrightAwayYes = outrightAway ? parseYesPrice(outrightAway.market) : null;

    return {
      found: false,
      reason: `Polymarket has no open per-match market for ${homeName} vs ${awayName}. The only World Cup market on Polymarket is the outright winner.`,
      outrightContext: {
        homeYesPrice: outrightHomeYes,
        awayYesPrice: outrightAwayYes,
        homeMarketUrl: outrightHome ? `https://polymarket.com/event/world-cup-winner` : null,
        note: 'Outright winner YES price is the tournament-level probability, not per-match. Surface as "Polymarket does not offer per-match World Cup pricing - per-match consensus is TxLINE-exclusive."',
      },
      txline: txlineImplied,
      searchedEvents: events.length,
    };
  }

  const yesPrice = parseYesPrice(match.market);
  const polyMarket = {
    yesPrice,
    side: match.side,
    question: match.market.question || null,
    marketUrl: match.market.slug
      ? `https://polymarket.com/event/${match.event.slug}`
      : `https://polymarket.com/event/${match.event.slug || ''}`,
    eventTitle: match.event.title || match.event.slug,
    eventId: match.event.id || null,
  };

  if (yesPrice == null) {
    return {
      found: true,
      polymarket: polyMarket,
      txline: txlineImplied,
      edge: null,
      reason: 'Polymarket market matched but no usable YES price',
    };
  }

  // Compare: if Polymarket asks "Will home win?", YES price = poly home win prob.
  // TxLINE home implied is the trusted reference.
  const txlineHome = txlineImplied.home;
  const txlineAway = txlineImplied.away;
  const txlineDraw = txlineImplied.draw;

  const polyHome = match.side === 'home' ? yesPrice : 1 - yesPrice;
  const polyAway = match.side === 'away' ? yesPrice : 1 - yesPrice;
  const polyDraw = null; // Polymarket binary markets don't expose draw probability

  const edgeHome = (txlineHome - polyHome) * 100; // positive = TxLINE more bullish on home
  const edgeAway = (txlineAway - polyAway) * 100;

  const absHome = Math.abs(edgeHome);
  const absAway = Math.abs(edgeAway);
  const dominantSide = absHome >= absAway ? 'home' : 'away';
  const dominantEdge = dominantSide === 'home' ? edgeHome : edgeAway;
  const direction = dominantEdge > 0 ? 'txline-higher' : 'txline-lower';

  const summary = `${dominantSide === 'home' ? homeName : awayName}: TxLINE ${(dominantSide === 'home' ? txlineHome : txlineAway) * 100}%, Polymarket ${(dominantSide === 'home' ? polyHome : polyAway) * 100}% — ${Math.abs(dominantEdge).toFixed(1)}-pt ${direction === 'txline-higher' ? 'TxLINE-higher' : 'TxLINE-lower'} discrepancy`;

  return {
    found: true,
    polymarket: { ...polyMarket, home: polyHome, away: polyAway, draw: polyDraw },
    txline: txlineImplied,
    edge: {
      homePts: edgeHome,
      awayPts: edgeAway,
      dominantSide,
      direction,
      magnitude: Math.max(absHome, absAway),
      summary,
    },
  };
}

const crossVenueEdge = { getCrossVenueEdge, fetchOpenSoccerEvents, findMatchingMarket, teamAliases, TEAM_ALIAS_REGISTRY };

export default crossVenueEdge;
