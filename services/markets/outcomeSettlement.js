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

/**
 * Contract-switchable settlement verdict — the Telegraph settlement reader's
 * vocabulary. A Mission 13/14 contract can release on `resolved` and only on
 * `resolved`; every other status is a hold:
 *
 *   open                — still trading; no resolution exists yet.
 *   pending_resolution  — the market is closed/halted or otherwise known,
 *                         but the venue has not finalized (UMA proposed or
 *                         disputed, Kalshi determined-not-settled, or a
 *                         terminal state we cannot read).
 *   resolved            — one unambiguous winner (exactly one price == 1,
 *                         the rest 0 — two-outcome or N-outcome alike — or
 *                         a Kalshi yes/no result).
 *   void                — the venue finalized a split or cancellation
 *                         (UMA-resolved 0.5/0.5, Kalshi non-yes/no result).
 *                         Release only when the escrow's own terms say split.
 *
 * `absent` is deliberately not a market verdict — it is the resolver's
 * report that no market matched the name asked.
 *
 * @returns {{ status: 'resolved'|'open'|'pending_resolution'|'void',
 *   outcome?: number, label?: string, reason: string }}
 */
export function classifyOutcome(platform, rawMarket) {
  if (platform === 'polymarket') {
    if (!rawMarket || typeof rawMarket !== 'object') {
      return { status: 'pending_resolution', reason: 'no market payload' };
    }
    if (rawMarket.closed !== true) return { status: 'open', reason: 'still trading' };
    if ('umaResolutionStatus' in rawMarket && rawMarket.umaResolutionStatus !== 'resolved') {
      return { status: 'pending_resolution', reason: `umaResolutionStatus=${rawMarket.umaResolutionStatus}` };
    }
    const outcomes = parseMaybeJson(rawMarket.outcomes);
    const prices = parseMaybeJson(rawMarket.outcomePrices)?.map(Number);
    if (!outcomes || outcomes.length < 2 || outcomes.some((o) => typeof o !== 'string' || !o)) {
      return { status: 'pending_resolution', reason: 'unreadable outcomes' };
    }
    if (!prices || prices.length !== outcomes.length) {
      return { status: 'pending_resolution', reason: 'unparseable outcomePrices' };
    }
    const winners = prices.reduce((idx, p, i) => (p === 1 ? [...idx, i] : idx), []);
    if (winners.length === 1 && prices.every((p) => p === 0 || p === 1)) {
      return { status: 'resolved', outcome: winners[0], label: outcomes[winners[0]], reason: 'terminal outcome' };
    }
    if (prices.every((p) => p === prices[0])) {
      return { status: 'void', reason: `equal terminal prices ${JSON.stringify(prices)}` };
    }
    return { status: 'pending_resolution', reason: `non-terminal outcomePrices ${JSON.stringify(prices)}` };
  }

  if (platform === 'kalshi') {
    const market = rawMarket?.market || rawMarket;
    if (!market || typeof market !== 'object') {
      return { status: 'pending_resolution', reason: 'no market payload' };
    }
    if (['settled', 'finalized'].includes(market.status)) {
      if (market.result === 'yes') return { status: 'resolved', outcome: 1, label: 'yes', reason: 'kalshi settled yes' };
      if (market.result === 'no') return { status: 'resolved', outcome: 0, label: 'no', reason: 'kalshi settled no' };
      return { status: 'void', reason: `result=${JSON.stringify(market.result)}` };
    }
    if (['closed', 'determined'].includes(market.status)) {
      return { status: 'pending_resolution', reason: `status=${market.status}` };
    }
    if (['open', 'active', 'unopened', 'initialized'].includes(market.status)) {
      return { status: 'open', reason: `status=${market.status}` };
    }
    return { status: 'pending_resolution', reason: `status=${JSON.stringify(market.status)}` };
  }

  return { status: 'pending_resolution', reason: `unknown platform ${JSON.stringify(platform)}` };
}

export function marketApiUrl(platform, marketId) {
  if (platform === 'polymarket') return `https://gamma-api.polymarket.com/markets/${marketId}`;
  if (platform === 'kalshi') {
    const base = process.env.KALSHI_BASE_URL || 'https://api.elections.kalshi.com/trade-api/v2';
    return `${base}/markets/${marketId}`;
  }
  return null;
}
