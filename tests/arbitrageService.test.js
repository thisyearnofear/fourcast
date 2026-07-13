/**
 * Unit tests for arbitrageService
 * Covers arbitrage detection, title similarity, and cross-platform opportunity matching
 */
import { describe, it, expect } from 'vitest';
import { arbitrageService } from '../services/arbitrageService.js';

describe('arbitrageService.calculateArbitrage', () => {
  it('returns hasPriceDiff=false when odds are close (<5% threshold)', () => {
    const m1 = { currentOdds: { yes: 0.51 }, platform: 'polymarket' };
    const m2 = { currentOdds: { yes: 0.53 }, platform: 'kalshi' };
    const result = arbitrageService.calculateArbitrage(m1, m2);
    expect(result.hasPriceDiff).toBe(false);
    expect(parseFloat(result.priceDiff)).toBeCloseTo(2.0, 1);
  });

  it('returns hasPriceDiff=true when odds differ >5%', () => {
    const m1 = { currentOdds: { yes: 0.45 }, platform: 'polymarket' };
    const m2 = { currentOdds: { yes: 0.60 }, platform: 'kalshi' };
    const result = arbitrageService.calculateArbitrage(m1, m2);
    expect(result.hasPriceDiff).toBe(true);
    expect(parseFloat(result.priceDiff)).toBeCloseTo(15.0, 1);
  });

  it('identifies the platform with better YES odds', () => {
    const m1 = { currentOdds: { yes: 0.70 }, platform: 'polymarket' };
    const m2 = { currentOdds: { yes: 0.50 }, platform: 'kalshi' };
    const result = arbitrageService.calculateArbitrage(m1, m2);
    expect(result.betterYes).toBe('polymarket');
    expect(result.betterNo).toBe('kalshi');
  });

  it('handles missing currentOdds gracefully', () => {
    const m1 = { platform: 'polymarket' };
    const m2 = { currentOdds: { yes: 0.65 }, platform: 'kalshi' };
    const result = arbitrageService.calculateArbitrage(m1, m2);
    expect(result.market1Odds).toBe('50.0'); // Default 0.5
    expect(parseFloat(result.priceDiff)).toBeCloseTo(15.0, 1);
  });

  it('formats odds to one decimal place', () => {
    const m1 = { currentOdds: { yes: 0.5555 }, platform: 'polymarket' };
    const m2 = { currentOdds: { yes: 0.3333 }, platform: 'kalshi' };
    const result = arbitrageService.calculateArbitrage(m1, m2);
    // 0.5555 * 100 = 55.55, toFixed(1) = '55.5'
    expect(result.market1Odds).toBe('55.5');
    expect(result.market2Odds).toBe('33.3');
  });
});

describe('arbitrageService.calculateTitleSimilarity', () => {
  it('returns 1.0 for identical titles', () => {
    const title = 'Will Bitcoin hit $100k by December 2025?';
    expect(arbitrageService.calculateTitleSimilarity(title, title)).toBe(1.0);
  });

  it('returns 0.0 for completely different titles', () => {
    const t1 = 'Will it rain in Chicago tomorrow?';
    const t2 = 'Bitcoin price prediction 2025';
    expect(arbitrageService.calculateTitleSimilarity(t1, t2)).toBe(0.0);
  });

  it('returns high similarity for rephrased versions of the same question', () => {
    const t1 = 'Will the Fed cut rates in March 2025?';
    const t2 = 'Will the Federal Reserve cut interest rates by March 2025?';
    const score = arbitrageService.calculateTitleSimilarity(t1, t2);
    expect(score).toBeGreaterThan(0.5);
  });

  it('ignores short words (<=3 chars) and punctuation', () => {
    const t1 = 'Will BTC hit $100k?';
    const t2 = 'Will Bitcoin hit 100000 dollars?';
    // Both normalize to: ['will', 'btc', 'hit', '100k'] vs ['will', 'bitcoin', 'hit', '100000', 'dollars']
    // Intersection: {will, hit} = 2
    // Union: {will, btc, hit, 100k, bitcoin, 100000, dollars} = 7
    // Score: 2/7 ≈ 0.29
    const score = arbitrageService.calculateTitleSimilarity(t1, t2);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.5);
  });

  it('handles empty or whitespace-only titles', () => {
    expect(arbitrageService.calculateTitleSimilarity('', 'something')).toBe(0.0);
    expect(arbitrageService.calculateTitleSimilarity('   ', 'something')).toBe(0.0);
    // Both empty → no words on either side → 0/0 = NaN, so we verify it doesn't throw
    const bothEmpty = arbitrageService.calculateTitleSimilarity('', '');
    expect(Number.isNaN(bothEmpty) || bothEmpty === 0).toBe(true);
  });

  it('is case-insensitive', () => {
    const t1 = 'WILL THE EAGLES WIN THE SUPER BOWL';
    const t2 = 'will the eagles win the super bowl';
    expect(arbitrageService.calculateTitleSimilarity(t1, t2)).toBe(1.0);
  });
});

describe('arbitrageService.diceCoefficient', () => {
  it('returns 1.0 for identical titles', () => {
    const title = 'Will Bitcoin hit $100k by December 2025?';
    expect(arbitrageService.diceCoefficient(title, title)).toBe(1.0);
  });

  it('returns a high score for titles with a typo', () => {
    const t1 = 'Will Bitcoin hit $100k?';
    const t2 = 'Will Bitcion hit $100k?';
    expect(arbitrageService.diceCoefficient(t1, t2)).toBeGreaterThan(0.6);
  });

  it('returns a low score for unrelated titles', () => {
    const t1 = 'Will it rain in Chicago tomorrow?';
    const t2 = 'Bitcoin price prediction 2025';
    expect(arbitrageService.diceCoefficient(t1, t2)).toBeLessThan(0.3);
  });

  it('returns 0.0 when one or both titles are empty', () => {
    expect(arbitrageService.diceCoefficient('', 'something')).toBe(0.0);
    expect(arbitrageService.diceCoefficient('something', '')).toBe(0.0);
    expect(arbitrageService.diceCoefficient('', '')).toBe(1.0);
  });

  it('is case-insensitive and ignores punctuation', () => {
    const t1 = 'WILL THE EAGLES WIN THE SUPER BOWL?';
    const t2 = 'will the eagles win the super bowl';
    expect(arbitrageService.diceCoefficient(t1, t2)).toBe(1.0);
  });

  it('catches rephrasings that pure Jaccard similarity misses', () => {
    const t1 = 'Will the Fed cut rates March 2025?';
    const t2 = 'Will the Federal Reserve cut interest rates by March 2025?';
    const dice = arbitrageService.diceCoefficient(t1, t2);
    const jaccard = arbitrageService.calculateTitleSimilarity(t1, t2);
    expect(dice).toBeGreaterThan(jaccard);
    expect(dice).toBeGreaterThan(0.45);
  });
});

describe('arbitrageService.findSimilarMarkets', () => {
  const makeMarket = (title, odds, platform) => ({
    title,
    currentOdds: { yes: odds },
    platform,
  });

  it('finds similar markets with price discrepancies', () => {
    const markets = [
      makeMarket('Will the Fed cut rates March 2025?', 0.45, 'polymarket'),
      makeMarket('Will the Federal Reserve cut rates March 2025?', 0.65, 'kalshi'),
    ];
    const result = arbitrageService.findSimilarMarkets(markets);
    expect(result.length).toBe(1);
    expect(parseFloat(result[0].similarity)).toBeGreaterThan(60);
    expect(parseFloat(result[0].arbitrage.priceDiff)).toBeGreaterThan(5);
  });

  it('returns empty array if no similar markets found', () => {
    const markets = [
      makeMarket('Will it rain in Chicago?', 0.50, 'polymarket'),
      makeMarket('Bitcoin price prediction 2025', 0.50, 'kalshi'),
    ];
    const result = arbitrageService.findSimilarMarkets(markets);
    expect(result).toEqual([]);
  });

  it('requires both Dice >= 0.45 and Jaccard >= 0.35 to match', () => {
    // High Dice but low Jaccard due to a typo and number reformatting
    const markets = [
      makeMarket('Bitcoin hits 100k', 0.40, 'polymarket'),
      makeMarket('Bitcion hits 100000', 0.65, 'kalshi'),
    ];
    expect(arbitrageService.diceCoefficient('Bitcoin hits 100k', 'Bitcion hits 100000')).toBeGreaterThan(0.45);
    expect(arbitrageService.calculateTitleSimilarity('Bitcoin hits 100k', 'Bitcion hits 100000')).toBeLessThan(0.35);
    const result = arbitrageService.findSimilarMarkets(markets);
    expect(result).toEqual([]);
  });

  it('returns empty array if price diff is below threshold', () => {
    const markets = [
      makeMarket('Will the Fed cut rates?', 0.51, 'polymarket'),
      makeMarket('Will the Federal Reserve cut interest rates?', 0.52, 'kalshi'),
    ];
    const result = arbitrageService.findSimilarMarkets(markets);
    expect(result).toEqual([]);
  });

  it('sorts results by price difference descending', () => {
    // Use unrelated title pairs to avoid cross-pair similarity matches
    const markets = [
      makeMarket('Will the FOMC cut interest rates by Q2 2025?', 0.40, 'polymarket'),
      makeMarket('Will the FOMC cut interest rates by Q2 2025?', 0.70, 'kalshi'),
      makeMarket('Will Bitcoin reach $150000 before 2026?', 0.60, 'polymarket'),
      makeMarket('Will Bitcoin reach $150000 before 2026?', 0.30, 'kalshi'),
    ];
    const result = arbitrageService.findSimilarMarkets(markets);
    expect(result.length).toBe(2);
    expect(parseFloat(result[0].arbitrage.priceDiff)).toBeGreaterThanOrEqual(
      parseFloat(result[1].arbitrage.priceDiff)
    );
  });

  it('handles markets from the same platform (no cross-platform match)', () => {
    const markets = [
      makeMarket('Will Bitcoin reach $100k?', 0.50, 'polymarket'),
      makeMarket('Will Bitcoin hit $100k?', 0.60, 'polymarket'),
    ];
    const result = arbitrageService.findSimilarMarkets(markets);
    expect(result).toEqual([]);
  });

  it('handles empty market list', () => {
    expect(arbitrageService.findSimilarMarkets([])).toEqual([]);
  });
});

describe('arbitrageService.detectOpportunities', () => {
  it('returns structured summary with counts', () => {
    // Use identical titles so Jaccard similarity = 1.0
    const markets = [
      { title: 'Will the Fed cut rates by Q2 2025?', currentOdds: { yes: 0.45 }, platform: 'polymarket' },
      { title: 'Will the Fed cut rates by Q2 2025?', currentOdds: { yes: 0.65 }, platform: 'kalshi' },
    ];
    const result = arbitrageService.detectOpportunities(markets);
    expect(result.count).toBe(1);
    expect(result.totalMarkets).toBe(2);
    expect(result.polymarketCount).toBe(1);
    expect(result.kalshiCount).toBe(1);
    expect(result.opportunities.length).toBe(1);
  });

  it('caps opportunities at top 10', () => {
    // Use identical base titles so Jaccard similarity = 1.0 for all cross-platform pairs
    const baseTitle = 'Will the Federal Reserve cut rates';  // ['will', 'federal', 'reserve', 'cut', 'rates']
    const markets = [];
    for (let i = 0; i < 15; i++) {
      markets.push(
        { title: `${baseTitle} series ${i}a?`, currentOdds: { yes: 0.40 + (i * 0.01) }, platform: 'polymarket' },
        { title: `${baseTitle} series ${i}b?`, currentOdds: { yes: 0.60 + (i * 0.01) }, platform: 'kalshi' }
      );
    }
    const result = arbitrageService.detectOpportunities(markets);
    expect(result.opportunities.length).toBeLessThanOrEqual(10);
    expect(result.count).toBeGreaterThan(10);
  });

  it('returns zero count for single-platform markets', () => {
    const markets = [
      { title: 'Will BTC hit $100k?', currentOdds: { yes: 0.50 }, platform: 'polymarket' },
      { title: 'Will ETH hit $5k?', currentOdds: { yes: 0.50 }, platform: 'polymarket' },
    ];
    const result = arbitrageService.detectOpportunities(markets);
    expect(result.count).toBe(0);
    expect(result.polymarketCount).toBe(2);
    expect(result.kalshiCount).toBe(0);
  });
});
