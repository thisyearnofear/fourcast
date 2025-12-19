/**
 * DeFi Arbitrage Signals API
 * Detects price discrepancies between Polymarket and Kalshi
 * Returns opportunities suitable for flash loan arbitrage and liquidity provision
 */

import { polymarketService } from '@/services/polymarketService';
import { kalshiService } from '@/services/kalshiService';
import { arbitrageService } from '@/services/arbitrageService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 20;
    const minSpread = parseFloat(searchParams.get('minSpread')) || 5; // 5% minimum spread
    const minVolume = parseInt(searchParams.get('minVolume')) || 50000; // $50k minimum

    console.log(`[DeFi Arbitrage] Fetching opportunities: limit=${limit}, minSpread=${minSpread}%, minVolume=$${minVolume}`);

    // Fetch markets from both platforms
    const [polymarketCatalog, kalshiMarkets] = await Promise.allSettled([
      polymarketService.buildMarketCatalog(minVolume, null, 'discovery'),
      kalshiService.getMarketsByCategory('all', 50)
    ]);

    // Extract market arrays, handling promise rejections
    let polymarkets = [];
    let kalshi = [];

    if (polymarketCatalog.status === 'fulfilled' && polymarketCatalog.value?.markets) {
      polymarkets = polymarketCatalog.value.markets.filter(m => {
        const vol = parseFloat(m.volume24h || 0);
        return vol >= minVolume;
      });
    }

    if (kalshiMarkets.status === 'fulfilled' && kalshiMarkets.value) {
      kalshi = kalshiMarkets.value.filter(m => {
        // Kalshi volume is in contracts (~$1 each)
        const vol = parseFloat(m.volume24h || 0);
        return vol >= (minVolume / 100); // Lower threshold for Kalshi contracts
      });
    }

    console.log(`[DeFi Arbitrage] Found ${polymarkets.length} Polymarket markets, ${kalshi.length} Kalshi markets`);

    // Find similar markets and detect arbitrage
    const opportunities = arbitrageService.findSimilarMarkets([...polymarkets, ...kalshi]);

    // Filter by minimum spread threshold
    const qualifyingOpportunities = opportunities
      .filter(opp => parseFloat(opp.arbitrage.priceDiff) >= minSpread)
      .slice(0, limit);

    // Enrich with DeFi-specific metrics
    const enrichedOpportunities = qualifyingOpportunities.map(opp => {
      const polyYes = parseFloat(opp.arbitrage.market1Odds) / 100;
      const kalshiYes = parseFloat(opp.arbitrage.market2Odds) / 100;

      // Calculate potential LP profit per $1 risked
      const capitalEfficiency = calculateCapitalEfficiency(polyYes, kalshiYes);

      // Determine which platform to "buy" and which to "sell"
      const bestBuyPlatform = polyYes > kalshiYes ? 'kalshi' : 'polymarket';
      const bestSellPlatform = polyYes > kalshiYes ? 'polymarket' : 'kalshi';

      return {
        signal_id: `arb_${opp.polymarket.id}_${opp.kalshi.marketID}`,
        market_title: opp.polymarket.title,
        venue: opp.polymarket.location || 'Multi-Platform',
        event_time: new Date(opp.polymarket.resolutionDate).getTime() / 1000,
        
        // Market snapshots
        polymarket: {
          platform: 'polymarket',
          id: opp.polymarket.id,
          title: opp.polymarket.title,
          odds_yes: polyYes,
          volume_24h: parseFloat(opp.polymarket.volume24h || 0)
        },
        kalshi: {
          platform: 'kalshi',
          id: opp.kalshi.marketID,
          title: opp.kalshi.title,
          odds_yes: kalshiYes,
          volume_24h: parseFloat(opp.kalshi.volume24h || 0)
        },

        // Arbitrage metrics
        arbitrage: {
          spread_percent: parseFloat(opp.arbitrage.priceDiff),
          spread_basis_points: Math.round(parseFloat(opp.arbitrage.priceDiff) * 100),
          buy_platform: bestBuyPlatform,
          sell_platform: bestSellPlatform,
          buy_odds: bestBuyPlatform === 'kalshi' ? kalshiYes : polyYes,
          sell_odds: bestSellPlatform === 'kalshi' ? kalshiYes : polyYes,
          similarity_score: parseFloat(opp.similarity)
        },

        // DeFi metrics
        defi_metrics: {
          capital_efficiency: capitalEfficiency.profitPercent,
          min_capital_per_arb: capitalEfficiency.minCapital,
          estimated_profit_per_1k: (1000 * capitalEfficiency.profitPercent / 100).toFixed(2),
          flash_loan_suitable: parseFloat(opp.arbitrage.priceDiff) > 10, // >10% spread
          liquidity_score: calculateLiquidityScore(
            parseFloat(opp.polymarket.volume24h || 0),
            parseFloat(opp.kalshi.volume24h || 0)
          )
        },

        // Signal metadata
        confidence: parseFloat(opp.arbitrage.priceDiff) > 15 ? 'HIGH' : 'MEDIUM',
        odds_efficiency: 'INEFFICIENT', // By definition, arb means market is inefficient
        ai_digest: `${opp.polymarket.title}: ${(polyYes * 100).toFixed(1)}% on Polymarket vs ${(kalshiYes * 100).toFixed(1)}% on Kalshi. ${parseFloat(opp.arbitrage.priceDiff).toFixed(1)}% spread suggests market inefficiency. Buy on ${bestBuyPlatform}, sell on ${bestSellPlatform} for risk-free profit.`,
        
        timestamp: Math.floor(Date.now() / 1000)
      };
    });

    console.log(`[DeFi Arbitrage] Returning ${enrichedOpportunities.length} opportunities above ${minSpread}% spread threshold`);

    return Response.json({
      success: true,
      data: {
        opportunities: enrichedOpportunities,
        summary: {
          total_opportunities: enrichedOpportunities.length,
          avg_spread: enrichedOpportunities.length > 0
            ? (enrichedOpportunities.reduce((sum, o) => sum + o.arbitrage.spread_percent, 0) / enrichedOpportunities.length).toFixed(2)
            : 0,
          total_liquidity: enrichedOpportunities.reduce((sum, o) => 
            sum + o.polymarket.volume_24h + o.kalshi.volume_24h, 0
          ).toFixed(2),
          filters_applied: {
            min_spread_percent: minSpread,
            min_volume_usd: minVolume,
            limit: limit
          }
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[DeFi Arbitrage] Error:', error.message);
    return Response.json({
      success: false,
      error: {
        code: 'ARBITRAGE_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Calculate capital efficiency of arbitrage opportunity
 * Returns: profit as % of capital deployed
 */
function calculateCapitalEfficiency(odds1, odds2) {
  // Simplified model: profit = (1/odds_buy - 1/odds_sell) / (1/odds_buy)
  // But for simplicity: profit margin = (better_odds - worse_odds) / worse_odds
  
  const buyOdds = Math.min(odds1, odds2);
  const sellOdds = Math.max(odds1, odds2);
  
  // If we buy at lower odds and sell at higher odds:
  // For every $1 of capital deployed at buy price:
  // - We get 1/buyOdds shares
  // - We can sell them for (1/buyOdds) * sellOdds dollars
  // - Profit = (sellOdds/buyOdds - 1) * 100%
  
  const profitPercent = ((sellOdds / buyOdds) - 1) * 100;
  
  return {
    profitPercent: parseFloat(profitPercent.toFixed(2)),
    minCapital: 100, // Min $100 capital to make meaningful arb
    roi: profitPercent
  };
}

/**
 * Calculate combined liquidity score (0-100)
 * Higher score = more liquidity available on both platforms
 */
function calculateLiquidityScore(poly24h, kalshi24h) {
  const totalVolume = poly24h + kalshi24h;
  
  // Score based on volume
  // $500k+ = 100, $100k = 80, $10k = 40
  let score;
  if (totalVolume >= 500000) score = 100;
  else if (totalVolume >= 250000) score = 90;
  else if (totalVolume >= 100000) score = 80;
  else if (totalVolume >= 50000) score = 70;
  else if (totalVolume >= 10000) score = 50;
  else score = 30;
  
  // Penalize if liquidity is one-sided
  const ratio = Math.max(poly24h, kalshi24h) / Math.max(Math.min(poly24h, kalshi24h), 1);
  if (ratio > 5) score -= 10; // One platform dominates
  if (ratio > 10) score -= 20;
  
  return Math.max(1, Math.min(100, score));
}
