import { polymarketService } from '@/services/polymarketService';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      return Response.json({
        success: false,
        error: 'Invalid JSON in request body',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const { location, weatherData, eventType, confidence, limitCount } = body;

    // REFACTORED: New architecture - location is optional for personalization
    // Primary discovery is now edge-ranked by weather sensitivity
    const filters = {
      weatherData,
      eventType: eventType || 'all',
      confidence: confidence || 'all',
      location: location || null, // Optional for filtering
      minVolume: 50000
    };

    const limit = limitCount || 8;

    // Use new liquidity-first, edge-ranked discovery
    let result;
    try {
      result = await polymarketService.getTopWeatherSensitiveMarkets(limit, filters);
    } catch (serviceErr) {
      console.error('Service error in getTopWeatherSensitiveMarkets:', serviceErr);
      result = {
        markets: [],
        totalFound: 0,
        error: serviceErr.message
      };
    }

    if (!result.markets || result.markets.length === 0) {
      // No weather-sensitive edges found - show helpful message instead of fallback markets
      return Response.json({
        success: true,
        markets: [],
        message: 'No weather edges detected right now. Weather conditions must change significantly or new events must be added for new opportunities. Check back when weather forecasts update.',
        noEdgesReason: 'Current market conditions and forecasts don\'t show strong weather-driven mispricings',
        totalFound: 0,
        cached: false,
        timestamp: new Date().toISOString()
      });
    }

    // Transform to API response format - include all enriched data
     const transformedMarkets = result.markets.map(m => {
       // Ensure odds are always valid (use oddsAnalysis as primary, fallback to currentOdds, finally default to 0.5)
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
         bid: m.bid || validOdds.no, // fallback for old UI compatibility
         ask: m.ask || validOdds.yes, // fallback for old UI compatibility
         orderBookMetrics: m.orderBookMetrics,
         volumeMetrics: m.volumeMetrics,
         marketEfficiency: m.marketEfficiency,
         enrichmentSource: m.enrichmentSource,
         enriched: m.enriched,
         oddsAnalysis: validOddsAnalysis,
         rawMarket: m.rawMarket
       };
     });

    // Pre-cache market details for top 5 (fire and forget)
    const top5Ids = transformedMarkets.slice(0, 5).map(m => m.marketID);
    Promise.allSettled(
      top5Ids.map(id => polymarketService.getMarketDetails(id))
    ).catch(err => console.debug('Pre-caching market details:', err.message));

    return Response.json({
      success: true,
      markets: transformedMarkets,
      totalFound: result.totalFound,
      cached: result.cached,
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

    // Use new discovery method
    let result;
    try {
      result = await polymarketService.getTopWeatherSensitiveMarkets(limit, {
        minVolume,
        location,
        eventType,
        confidence
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
