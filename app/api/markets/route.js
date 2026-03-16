import { polymarketService } from '@/services/polymarketService';
import { kalshiService } from '@/services/kalshiService';
import { synthService } from '@/services/synthService';
import * as pathDependentService from '@/services/pathDependentService';

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

    const { location, weatherData, eventType, confidence, limitCount, theme, excludeFutures, searchText, maxDaysToResolution, minVolume, analysisType, platform } = body;

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
      analysisType: analysisType || 'discovery',
      platform: platform || 'all' // Add platform filter
    };

    const limit = limitCount || 8;

    // 1. Fetch Polymarket Data
    let polymarketResults = { markets: [], totalFound: 0 };
    const weatherSensitiveCategories = ['Sports', 'Soccer', 'NFL', 'NBA', 'Weather', 'all'];
    // Always fetch Polymarket in discovery mode; in event-weather mode, only for weather-sensitive categories
    const shouldFetchPolymarket = filters.platform !== 'kalshi' && (
      analysisType === 'discovery' || weatherSensitiveCategories.includes(eventType)
    );

    if (shouldFetchPolymarket) {
      try {
        console.log('[Markets API] Fetching Polymarket markets for:', eventType);

        // For weather-sensitive categories, use the full weather scoring pipeline
        if (analysisType === 'event-weather' || eventType === 'Weather') {
          polymarketResults = await polymarketService.getTopWeatherSensitiveMarkets(limit, filters);
        } else {
          // For general discovery (Sports, Politics, etc.), use catalog directly without weather scoring
          const catalogResult = await polymarketService.buildMarketCatalog(
            filters.minVolume || 50000,
            eventType,
            'discovery'
          );

          if (catalogResult.markets && catalogResult.markets.length > 0) {
            // Sort by volume and take top results
            const sortedMarkets = catalogResult.markets
              .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
              .slice(0, limit * 2); // Get more to allow for filtering

            polymarketResults = {
              markets: sortedMarkets,
              totalFound: catalogResult.markets.length,
              cached: catalogResult.cached || false
            };
          }
        }
      } catch (serviceErr) {
        console.error('[Markets API] Polymarket service error:', serviceErr.message);
      }
    } else {
      console.log(`[Markets API] Skipping Polymarket for category: ${eventType} (Kalshi-only)`);
    }

    // 2. Fetch Kalshi Data (Category-aware)
    let kalshiMarkets = [];
    // Only fetch Kalshi if in discovery mode OR if the category is supported
    const supportedKalshiCategories = ['all', 'Weather', 'Politics', 'Economics', 'Crypto', 'Sports', 'Soccer', 'NFL', 'NBA'];
    const shouldFetchKalshi = (analysisType === 'discovery' || supportedKalshiCategories.includes(eventType)) && filters.platform !== 'polymarket';

    console.log('[Markets API] Kalshi fetch decision:', {
      shouldFetchKalshi,
      analysisType,
      eventType,
      platform: filters.platform,
      supportedCategory: supportedKalshiCategories.includes(eventType)
    });

    if (shouldFetchKalshi) {
      console.log('[Markets API] Calling kalshiService for category:', eventType);
      
      try {
        const kMarkets = await kalshiService.getMarketsByCategory(eventType, 30);
        
        // Apply enhanced filtering to Kalshi markets with adaptive thresholds
        kalshiMarkets = kMarkets.filter(m => {
          const vol = parseFloat(m.volume24h || 0);
          // Enhanced logic: More aggressive discovery for Kalshi
          // Lower the barrier for discovery while maintaining quality
          const minContracts = Math.max(3, minVolume / 1000); // Much lower threshold
          const hasLiquidity = (m.liquidity || 0) > 1000; // Alternative quality signal
          const isActiveMarket = vol > 0 || hasLiquidity; // At least some activity
          
          // For 'all' category or when Kalshi is specifically selected, be more inclusive
          if (eventType === 'all' || filters.platform === 'kalshi') {
            return isActiveMarket;
          }
          
          return vol >= minContracts || hasLiquidity;
        });

        console.log(`[Markets API] Found ${kalshiMarkets.length} Kalshi markets for category ${eventType}`);
      } catch (err) {
        console.error('[Markets API] Kalshi service error:', err.message);
        // Continue without Kalshi markets on error
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
      // In binary markets, YES price + NO price should sum to ~1.0
      // Polymarket currentOdds.yes/no are YES and NO prices respectively
      let yesPrice = m.currentOdds?.yes ?? m.oddsAnalysis?.bestAsk ?? m.orderBookMetrics?.bestAsk ?? 0.5;
      let noPrice = m.currentOdds?.no ?? m.oddsAnalysis?.bestBid ?? m.orderBookMetrics?.bestBid ?? (1 - yesPrice);

      // Binary Market Sanity Check:
      // If prices are identical and > 0.9, they are likely mapping errors (YES bid/ask mixed up)
      if (Math.abs(yesPrice - noPrice) < 0.01 && yesPrice > 0.9) {
        noPrice = 1 - yesPrice;
      }
      
      // If both are 0, default to 50/50
      if (yesPrice === 0 && noPrice === 0) {
        yesPrice = 0.5;
        noPrice = 0.5;
      }

      // Final bound check
      const validOdds = {
        yes: Math.max(0, Math.min(1, yesPrice)),
        no: Math.max(0, Math.min(1, noPrice))
      };

      const validOddsAnalysis = m.oddsAnalysis || {
        bestBid: validOdds.no,
        bestAsk: validOdds.yes,
        spread: m.orderBookMetrics?.spread || 0,
        spreadPercent: m.orderBookMetrics?.spreadPercent || 0
      };

      // Detect if this market can benefit from SynthData ML analysis
      const detectedAsset = synthService.detectAsset(m.title, m.description || '');
      const isMLReady = !!detectedAsset;

      // Detect if this is a path-dependent market (e.g. BTC touches $60k before $65k)
      const pathContext = pathDependentService.detectPathDependentMarket(m.title);
      const isPathDependent = pathContext.detected;

      // Calculate days to resolution
      let daysToResolution = null;
      if (m.resolutionDate) {
        const resDate = new Date(m.resolutionDate);
        if (!isNaN(resDate.getTime())) {
          daysToResolution = (resDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        }
      }

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
        daysToResolution,
        eventType: m.eventType,
        teams: m.teams,
        edgeScore: m.edgeScore,
        edgeFactors: m.edgeFactors,
        confidence: m.confidence,
        weatherContext: m.weatherContext,
        isWeatherSensitive: m.isWeatherSensitive,
        isMLReady,
        detectedAsset,
        isPathDependent,
        pathContext,

        // Include enriched market data for richer UI
        bid: validOdds.no,
        ask: validOdds.yes,
        orderBookMetrics: m.orderBookMetrics,
        volumeMetrics: m.volumeMetrics,
        marketEfficiency: m.marketEfficiency,
        enrichmentSource: m.enrichmentSource,
        enriched: m.enriched,
        oddsAnalysis: validOddsAnalysis,
        rawMarket: m.rawMarket
      };
    });

    // Filter out past markets
    const activeMarkets = transformedMarkets.filter(m => {
      // If we have daysToResolution, it must be in the future
      if (m.daysToResolution !== null) {
        return m.daysToResolution > 0;
      }
      return true;
    });

    // 5. PRE-BAKED INSIGHTS: Pre-calculate ML Fair odds for top 5 ML-ready markets
    const topMLReadyMarkets = activeMarkets
      .filter(m => m.isMLReady && m.detectedAsset)
      .slice(0, 5);

    if (topMLReadyMarkets.length > 0 && synthService.isAvailable()) {
      console.log(`[Markets API] Pre-calculating ML forecasts for ${topMLReadyMarkets.length} markets...`);
      
      const forecastResults = await Promise.allSettled(
        topMLReadyMarkets.map(m => synthService.buildForecast(m.detectedAsset, { horizon: '24h' }))
      );

      // Inject forecast data into the activeMarkets objects
      forecastResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          const market = topMLReadyMarkets[idx];
          // Find the actual object in activeMarkets to update it
          const originalMarket = activeMarkets.find(m => m.marketID === market.marketID);
          if (originalMarket) {
            originalMarket.preCalculatedForecast = result.value;
            console.log(`[Markets API] Pre-calculated forecast for ${market.detectedAsset} (${market.marketID})`);
          }
        }
      });
    }

    // Pre-cache market details for top 5 (fire and forget) - only for Polymarket for now
    const top5PolymarketIds = activeMarkets
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
      markets: activeMarkets,
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
