import { polymarketService } from '@/services/polymarketService';
import { isLiveMarket } from '@/utils/marketFilters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight live-markets feed for the landing page.
 *
 * Calls buildMarketCatalog directly (cached 30 min at the service layer)
 * and returns a minimal shape: title, platform, ask, bid, edgeScore,
 * volume24h. No weather scoring, no ML forecasts, no order-book enrichment.
 * Designed to respond in <500ms on a warm cache.
 */
export async function GET() {
  try {
    const catalogResult = await polymarketService.buildMarketCatalog(
      50000,
      null,
      'discovery',
    );

    const markets = (catalogResult.markets || [])
      // Gamma's closed=false catalog can still contain ended markets. Do not
      // call a market live unless its own status and resolution date agree.
      .filter((market) => isLiveMarket(market))
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, 6)
      .map((m) => ({
        marketID: m.marketID,
        title: m.title,
        platform: 'polymarket',
        ask: m.currentOdds?.yes ?? null,
        bid: m.currentOdds?.no ?? null,
        edgeScore: m.edgeScore ?? null,
        volume24h: m.volume24h ?? null,
      }));

    return Response.json(
      {
        success: true,
        markets,
        total: markets.length,
        cached: catalogResult.cached || false,
        timestamp: new Date().toISOString(),
      },
      {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' },
      },
    );
  } catch (error) {
    console.error('[/api/markets/live] error:', error.message);
    return Response.json(
      {
        success: false,
        markets: [],
        error: error.message || 'market data unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
