/**
 * Cross-venue contract assessment.
 *
 * A price delta is not an arbitrage opportunity by itself. Before surfacing a
 * pair we check that the contracts plausibly resolve on the same event, model
 * a conservative execution buffer, and make uncertainty explicit.
 */

const STOP_WORDS = new Set(['will', 'the', 'a', 'an', 'by', 'on', 'in', 'of', 'to', 'for', 'and', 'or', 'is', 'be']);
const COST_BUFFER = 0.03; // conservative combined fee + slippage reserve
const MIN_GROSS_SPREAD = 0.05;
const MIN_NET_SPREAD = 0.02;

function numberOr(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function marketVolume(market) {
  return numberOr(market.volume24h, numberOr(market.volume, null));
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\$([0-9]+)k\b/g, '$1000')
    .replace(/federal reserve/g, 'fed')
    .replace(/interest rates?/g, 'rates')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function semanticTokens(market) {
  return normalizeText(`${market.title || ''} ${market.description || ''}`)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function dateBucket(market) {
  if (!market.resolutionDate) return null;
  const date = new Date(market.resolutionDate);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}

export const arbitrageService = {
  calculateArbitrage(market1, market2) {
    const odds1Yes = market1.currentOdds?.yes || 0.5;
    const odds2Yes = market2.currentOdds?.yes || 0.5;
    const priceDiff = Math.abs(odds1Yes - odds2Yes) * 100;
    const betterYes = odds1Yes > odds2Yes ? market1.platform : market2.platform;
    const betterNo = odds1Yes < odds2Yes ? market1.platform : market2.platform;

    return {
      hasPriceDiff: priceDiff > 5,
      priceDiff: priceDiff.toFixed(1),
      betterYes,
      betterNo,
      market1Odds: (odds1Yes * 100).toFixed(1),
      market2Odds: (odds2Yes * 100).toFixed(1),
    };
  },

  /** Explain whether two venue contracts are safe enough to compare. */
  assessMarketPair(market1, market2) {
    const jaccard = this.calculateTitleSimilarity(market1.title || '', market2.title || '');
    const dice = this.diceCoefficient(market1.title || '', market2.title || '');
    const sharedTerms = [...new Set(semanticTokens(market1))]
      .filter((term) => semanticTokens(market2).includes(term));
    const firstDate = dateBucket(market1);
    const secondDate = dateBucket(market2);
    const dateCompatible = firstDate == null || secondDate == null || Math.abs(firstDate - secondDate) <= 1;
    const semanticCompatible = dice >= 0.45 && jaccard >= 0.35 && sharedTerms.length >= 2;
    const price = this.calculateArbitrage(market1, market2);
    const grossSpread = Math.abs((market1.currentOdds?.yes ?? 0.5) - (market2.currentOdds?.yes ?? 0.5));
    const netSpread = Math.max(0, grossSpread - COST_BUFFER);
    const knownLiquidity = [marketVolume(market1), marketVolume(market2)].every((volume) => volume != null);
    const sufficientLiquidity = !knownLiquidity || [marketVolume(market1), marketVolume(market2)].every((volume) => volume >= 10_000);
    const reviewReasons = [];

    if (!semanticCompatible) reviewReasons.push('contract wording is not equivalent enough');
    if (!dateCompatible) reviewReasons.push('resolution windows differ');
    if (!knownLiquidity) reviewReasons.push('venue liquidity unavailable');
    else if (!sufficientLiquidity) reviewReasons.push('venue liquidity below $10k');
    if (grossSpread < MIN_GROSS_SPREAD) reviewReasons.push('gross spread below 5%');
    if (netSpread < MIN_NET_SPREAD) reviewReasons.push('net spread below 2% after costs');

    const executionReady = semanticCompatible && dateCompatible && sufficientLiquidity
      && grossSpread >= MIN_GROSS_SPREAD && netSpread >= MIN_NET_SPREAD;

    return {
      similarity: Math.round(jaccard * 100).toString(),
      semanticScore: Math.round(((jaccard + dice) / 2) * 100),
      sharedTerms: sharedTerms.slice(0, 6),
      resolutionCompatible: dateCompatible,
      liquidityKnown: knownLiquidity,
      grossSpread: (grossSpread * 100).toFixed(1),
      estimatedCosts: (COST_BUFFER * 100).toFixed(1),
      netSpread: (netSpread * 100).toFixed(1),
      executionReady,
      decision: {
        verdict: executionReady ? 'READY' : 'REVIEW',
        rationale: executionReady
          ? `Equivalent contract; ${(netSpread * 100).toFixed(1)}% net spread after a ${(COST_BUFFER * 100).toFixed(1)}% cost reserve`
          : reviewReasons.join(' · '),
        reviewReasons,
      },
      arbitrage: price,
    };
  },

  findSimilarMarkets(markets = []) {
    const polymarketMarkets = markets.filter((market) => market.platform === 'polymarket');
    const kalshiMarkets = markets.filter((market) => market.platform === 'kalshi');
    const matches = [];

    for (const polymarket of polymarketMarkets) {
      for (const kalshi of kalshiMarkets) {
        const assessment = this.assessMarketPair(polymarket, kalshi);
        // Keep only genuine semantic matches. A match can still be REVIEW when
        // liquidity or net spread prevents autonomous execution.
        if (assessment.decision.reviewReasons.includes('contract wording is not equivalent enough') || !assessment.resolutionCompatible) continue;
        if (Number(assessment.grossSpread) < MIN_GROSS_SPREAD * 100) continue;
        matches.push({
          polymarket,
          kalshi,
          similarity: assessment.similarity,
          ...assessment,
        });
      }
    }

    return matches.sort((a, b) => Number(b.netSpread) - Number(a.netSpread));
  },

  diceCoefficient(title1, title2) {
    const first = normalizeText(title1);
    const second = normalizeText(title2);
    if (!first && !second) return 1;
    if (!first || !second) return 0;
    const bigrams = (value) => {
      const pairs = new Set();
      for (let index = 0; index < value.length - 1; index += 1) pairs.add(value.slice(index, index + 2));
      return pairs;
    };
    const a = bigrams(first);
    const b = bigrams(second);
    const intersection = [...a].filter((pair) => b.has(pair)).length;
    return (2 * intersection) / (a.size + b.size);
  },

  calculateTitleSimilarity(title1, title2) {
    // Keep lexical similarity separate from the richer semantic token pass.
    // It is deliberately unforgiving: a typo or a changed threshold should not
    // be mistaken for an equivalent financial contract.
    const tokens = (title) => String(title || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter((token) => token.length > 3);
    const first = new Set(tokens(title1));
    const second = new Set(tokens(title2));
    if (!first.size && !second.size) return 0;
    const intersection = [...first].filter((word) => second.has(word)).length;
    return intersection / new Set([...first, ...second]).size;
  },

  detectOpportunities(markets) {
    const opportunities = this.findSimilarMarkets(markets);
    return {
      count: opportunities.length,
      executableCount: opportunities.filter((opportunity) => opportunity.executionReady).length,
      opportunities: opportunities.slice(0, 10),
      totalMarkets: markets.length,
      polymarketCount: markets.filter((market) => market.platform === 'polymarket').length,
      kalshiCount: markets.filter((market) => market.platform === 'kalshi').length,
    };
  },
};
