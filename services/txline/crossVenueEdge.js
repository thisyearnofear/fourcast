/**
 * Cross-venue edge detection - TxLINE consensus vs Polymarket.
 *
 * TxLINE provides trusted consensus odds (Bookmaker = TXLineStablePriceDemargined)
 * for each World Cup fixture. Polymarket offers peer-to-peer pricing on the same
 * matches. The gap between the two is the cross-venue edge Fourcast surfaces.
 *
 * Example callout:
 *   "TxLINE consensus is 61%, Polymarket trading at 54% - 7-pt cross-venue discrepancy"
 *
 * Polymarket's public gamma API is read-only and doesn't require auth.
 *   GET https://gamma-api.polymarket.com/events?tag=soccer&closed=false&limit=100
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
  // Common short-forms
  const map = {
    'spain': ['spain', 'esp', 'es'],
    'argentina': ['argentina', 'arg', 'ar'],
    'france': ['france', 'fra', 'fr'],
    'england': ['england', 'eng', 'en'],
    'morocco': ['morocco', 'mar', 'ma'],
    'brazil': ['brazil', 'bra', 'br'],
    'germany': ['germany', 'ger', 'de'],
    'portugal': ['portugal', 'por', 'pt'],
    'netherlands': ['netherlands', 'ned', 'dutch', 'holland'],
    'usa': ['usa', 'us', 'united states'],
    'mexico': ['mexico', 'mex'],
    'japan': ['japan', 'jpn'],
    'south korea': ['south korea', 'kor', 'korea republic'],
    'australia': ['australia', 'aus'],
  };
  if (map[lower]) for (const a of map[lower]) aliases.add(a);
  return Array.from(aliases);
}

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
        headers: { Accept: 'application/json', 'User-Agent': 'fourcast-worldcup/1.0' },
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

const crossVenueEdge = { getCrossVenueEdge, fetchOpenSoccerEvents, findMatchingMarket };

export default crossVenueEdge;
