/**
 * Settled-market outcome reads — the shared, strict vocabulary for "did this
 * prediction market resolve, and which side won".
 *
 * Rules are deliberately narrow: a market resolves a question only on an
 * unambiguous terminal state. Anything else is `{ skip: reason }` — never a
 * guessed outcome. Outcome 1 means the market's first listed outcome won
 * (the side `currentOdds.yes` refers to); outcome 0 means the second won.
 *
 * Lives in services/ (not scripts/) so both the forecast resolver
 * (scripts/forecast-and-resolve.mjs, which re-exports these) and the
 * Telegraph miner's EVENT_OUTCOME_RESOLUTION leg read the same rules.
 */

export const parseMaybeJson = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return null;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * @returns {{ outcome: 0|1, label?: string } | { skip: string }}
 */
export function deriveOutcome(platform, rawMarket) {
  if (platform === 'polymarket') {
    if (!rawMarket || typeof rawMarket !== 'object') return { skip: 'no market payload' };
    if (rawMarket.closed !== true) return { skip: 'not closed' };
    if ('umaResolutionStatus' in rawMarket && rawMarket.umaResolutionStatus !== 'resolved') {
      return { skip: `umaResolutionStatus=${rawMarket.umaResolutionStatus}` };
    }
    const outcomes = parseMaybeJson(rawMarket.outcomes);
    const prices = parseMaybeJson(rawMarket.outcomePrices)?.map(Number);
    if (!outcomes || outcomes.length !== 2 || outcomes.some((o) => typeof o !== 'string' || !o)) {
      return { skip: 'not a two-outcome market' };
    }
    if (!prices || prices.length !== 2) return { skip: 'unparseable outcomePrices' };
    if (prices[0] === 1 && prices[1] === 0) return { outcome: 1, label: outcomes[0] };
    if (prices[0] === 0 && prices[1] === 1) return { outcome: 0, label: outcomes[1] };
    return { skip: `ambiguous outcomePrices ${JSON.stringify(prices)}` };
  }

  if (platform === 'kalshi') {
    const market = rawMarket?.market || rawMarket;
    if (!market || typeof market !== 'object') return { skip: 'no market payload' };
    if (!['settled', 'finalized'].includes(market.status)) {
      return { skip: `status=${market.status}` };
    }
    if (market.result === 'yes') return { outcome: 1, label: 'yes' };
    if (market.result === 'no') return { outcome: 0, label: 'no' };
    return { skip: `result=${JSON.stringify(market.result)}` };
  }

  return { skip: `unknown platform ${JSON.stringify(platform)}` };
}

export function marketApiUrl(platform, marketId) {
  if (platform === 'polymarket') return `https://gamma-api.polymarket.com/markets/${marketId}`;
  if (platform === 'kalshi') {
    const base = process.env.KALSHI_BASE_URL || 'https://api.elections.kalshi.com/trade-api/v2';
    return `${base}/markets/${marketId}`;
  }
  return null;
}
