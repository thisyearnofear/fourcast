import { polymarketService } from '@/services/polymarketService';
import { kalshiService } from '@/services/kalshiService';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error('[POST /api/markets] JSON parse error:', parseErr.message);
      return Response.json({
        success: false,
        error: 'Invalid JSON in request body',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log('[POST /api/markets] Request body:', JSON.stringify(body, null, 2));

    const { location, weatherData, eventType, confidence, limitCount, theme, excludeFutures, searchText, maxDaysToResolution, minVolume, analysisType } = body;

    // REFACTORED: New architecture - supports two analysis modes:
    // 1. 'event-weather' (/ai page): Fetches weather at event venues
    // 2. 'discovery' (/discovery page): Location-agnostic market browsing
    const filters = {
      weatherData,
      eventType: eventType || 'all',
      confidence: confidence || 'all',
      location: location === null || location === undefined ? null : location,
      minVolume: typeof minVolume === 'number' ? minVolume : 50000,
      excludeFutures: excludeFutures !== false,
      searchText: searchText || null,
      maxDaysToResolution: typeof maxDaysToResolution === 'number' ? maxDaysToResolution : 14,
      analysisType: analysisType || 'discovery'
    };

    const limit = limitCount || 8;

    // 1. Fetch Polymarket Data
    let polymarketResults = { markets: [], totalFound: 0 };
    try {
      console.log('[Markets API] Calling polymarketService...');
      polymarketResults = await polymarketService.getTopWeatherSensitiveMarkets(limit, filters);
    } catch (serviceErr) {
      console.error('[Markets API] Polymarket service error:', serviceErr.message);
    }

    // 2. Fetch Kalshi Data (Category-aware)
    let kalshiMarkets = [];
    const shouldFetchKalshi = analysisType === 'discovery' || eventType === 'all' || eventType === 'Weather' || eventType === 'Politics' || eventType === 'Economics';

    if (shouldFetchKalshi) {
      try {
        console.log('[Markets API] Calling kalshiService for category:', eventType);

        // Map our eventType to Kalshi categories
        let kalshiCategory = 'all';
        if (eventType === 'Weather') kalshiCategory = 'Climate and Weather';
        else if (eventType === 'Politics') kalshiCategory = 'Politics';
        else if (eventType === 'Economics') kalshiCategory = 'Economics';
        else if (eventType === 'Crypto') kalshiCategory = 'Financials';

        const kMarkets = await kalshiService.getMarketsByCategory(kalshiCategory, 30);

        // Apply basic filtering to Kalshi markets
        kalshiMarkets = kMarkets.filter(m => {
          if (searchText && !m.title.toLowerCase().includes(searchText.toLowerCase())) return false;
          // Kalshi volume is in contracts (approx $1), so we scale minVolume down
          // If minVolume is > 10000, we require > 100 contracts on Kalshi
          if (minVolume && minVolume > 10000 && m.volume24h < 100) return false;
          return true;
        });
        console.log(`[Markets API] Found ${kalshiMarkets.length} Kalshi markets for category ${kalshiCategory}`);
      } catch (err) {
        console.error('[Markets API] Kalshi service error:', err.message);
      }
    }

    // 3. Merge Results
    let marketsList = [...(polymarketResults.markets || []), ...kalshiMarkets];

    // Sort by volume (descending) to mix them
    marketsList.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

    // Limit total
    marketsList = marketsList.slice(0, limit * 2);

    // 4. Transform for Frontend
    const transformedMarkets = marketsList.map(m => {
      // Ensure odds are always valid
      const bestBid = m.oddsAnalysis?.bestBid ?? m.orderBookMetrics?.bestBid ?? m.currentOdds?.no ?? 0.5;
      const bestAsk = m.oddsAnalysis?.bestAsk ?? m.orderBookMetrics?.bestAsk ?? m.currentOdds?.yes ?? 0.5;

      const validOdds = {
        yes: bestAsk,
        no: bestBid
      };

      const validOddsAnalysis = m.oddsAnalysis || {
        bestBid,
        bestAsk,
        spread: m.orderBookMetrics?.spread || 0,
        spreadPercent: m.orderBookMetrics?.spreadPercent || 0
      };

      return {
        marketID: m.marketID,
        platform: m.platform || 'polymarket', // Default to polymarket if missing
        title: m.title,
        description: m.description,
        location: m.location,
        currentOdds: validOdds,
        volume24h: m.volume24h,
        liquidity: m.liquidity,
        tags: m.tags,
        resolutionDate: m.resolutionDate,
        eventType: m.eventType,
        teams: m.teams,
        edgeScore: m.edgeScore,
        edgeFactors: m.edgeFactors,
        confidence: m.confidence,
        weatherContext: m.weatherContext,
        isWeatherSensitive: m.isWeatherSensitive,

        // Include enriched market data for richer UI
        bid: m.bid || validOdds.no,
        ask: m.ask || validOdds.yes,
        orderBookMetrics: m.orderBookMetrics,
        volumeMetrics: m.volumeMetrics,
        marketEfficiency: m.marketEfficiency,
        enrichmentSource: m.enrichmentSource,
        enriched: m.enriched,
        oddsAnalysis: validOddsAnalysis,
        rawMarket: m.rawMarket
      };
    });

    // Pre-cache market details for top 5 (fire and forget) - only for Polymarket for now
    const top5PolymarketIds = transformedMarkets
      .filter(m => m.platform === 'polymarket')
      .slice(0, 5)
      .map(m => m.marketID);

    if (top5PolymarketIds.length > 0) {
      Promise.allSettled(
        top5PolymarketIds.map(id => polymarketService.getMarketDetails(id))
      ).catch(err => console.debug('Pre-caching market details:', err.message));
    }

    return Response.json({
      success: true,
      markets: transformedMarkets,
      totalFound: marketsList.length,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Markets API Error:', error);

    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch market data',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // If no query params, return service status
    if (!searchParams.toString()) {
      const status = polymarketService.getStatus ? polymarketService.getStatus() : { available: true, baseURL: 'https://gamma-api.polymarket.com' };
      return Response.json({
        service: 'Polymarket Data Service (Edge-Ranked Discovery)',
        status: status.available ? 'available' : 'unavailable',
        baseURL: status.baseURL,
        timestamp: new Date().toISOString()
      });
    }

    // REFACTORED: Edge-ranked discovery parameters
    const category = searchParams.get('category') || 'all';
    const minVolume = parseInt(searchParams.get('minVolume') || '50000');
    const location = searchParams.get('location') || null;
    const eventType = searchParams.get('eventType') || 'all';
    const confidence = searchParams.get('confidence') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');
    const excludeFutures = (searchParams.get('excludeFutures') || 'true') !== 'false';
    const searchText = searchParams.get('q') || null;
    const maxDaysToResolution = parseInt(searchParams.get('maxDays') || '14');

    // Use new discovery method
    let result;
    try {
      result = await polymarketService.getTopWeatherSensitiveMarkets(limit, {
        minVolume,
        location,
        eventType,
        confidence,
        excludeFutures,
        searchText,
        maxDaysToResolution
      });
    } catch (serviceErr) {
      console.error('Service error in GET /api/markets:', serviceErr);
      result = { markets: [], totalFound: 0, error: serviceErr.message };
    }

    const markets = (result.markets || []).map(m => ({
      id: m.marketID,
      marketID: m.marketID,
      title: m.title,
      description: m.description,
      location: m.location,
      currentOdds: m.currentOdds,
      volume24h: m.volume24h,
      liquidity: m.liquidity,
      tags: m.tags,
      eventType: m.eventType,
      teams: m.teams,
      edgeScore: m.edgeScore,
      confidence: m.confidence,
      isWeatherSensitive: m.isWeatherSensitive,

      // Include enriched market data for richer UI
      bid: m.bid,
      ask: m.ask,
      orderBookMetrics: m.orderBookMetrics,
      volumeMetrics: m.volumeMetrics,
      marketEfficiency: m.marketEfficiency,
      enrichmentSource: m.enrichmentSource,
      enriched: m.enriched,
      oddsAnalysis: m.oddsAnalysis,
      rawMarket: m.rawMarket
    }));

    return Response.json({
      markets,
      total: markets.length,
      totalFound: result.totalFound,
      filters: { category, minVolume, location, eventType, confidence },
      cached: result.cached,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Markets GET API error:', error);
    return Response.json({
      error: 'Failed to fetch markets',
      markets: [],
      total: 0,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
