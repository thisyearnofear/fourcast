import { polymarketService } from '@/services/polymarketService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { location, weatherData } = body;

    // Validate required fields
    if (!location || !weatherData) {
      return Response.json({
        success: false,
        error: 'Missing required fields: location, weatherData'
      }, { status: 400 });
    }

    // Fetch weather-sensitive market opportunities
    const result = await polymarketService.getWeatherAdjustedOpportunities(
      weatherData,
      location
    );

    // Check if we got any opportunities
    if (!result.opportunities || result.opportunities.length === 0) {
      // Fallback: return a success response but fetch all active markets
      console.log(`No weather-sensitive markets for ${location}, fetching all active markets...`);
      const allMarkets = await polymarketService.getAllMarkets();
      const transformed = (allMarkets || []).slice(0, 10).map(m => ({
        marketID: m.tokenID || m.id,
        title: m.title || m.question,
        description: m.description,
        currentOdds: {
          yes: m.bid || m.yesPrice || 0.5,
          no: m.ask || m.noPrice || 0.5
        },
        volume24h: m.volume24h || 0,
        liquidityBin: m.liquidity || 0,
        tags: m.tags || []
      }));
      
      return Response.json({
        success: true,
        opportunities: transformed,
        location,
        message: `Showing top markets for ${location}`,
        weatherContext: result.weatherContext,
        totalFound: transformed.length,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      opportunities: result.opportunities,
      location: result.location,
      weatherContext: result.weatherContext,
      totalFound: result.opportunities.length,
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
    
    // If no query params, return service status (preserving existing behavior)
    if (!searchParams.toString()) {
      const status = polymarketService.getStatus();
      return Response.json({
        service: 'Polymarket Data Service',
        status: status.available ? 'available' : 'unavailable',
        cache: status.cache || { size: status.cacheSize, duration: status.cacheDuration },
        baseURL: status.baseURL,
        timestamp: new Date().toISOString()
      });
    }

    // ENHANCEMENT: Roadmap-aligned market discovery
    const category = searchParams.get('category') || 'all';
    const minVolume = parseInt(searchParams.get('minVolume') || '10000');
    const search = searchParams.get('search');

    let markets = [];
    let cached = false;

    if (search) {
      // Search by location using enhanced polymarketService
      const result = await polymarketService.searchMarketsByLocation(search);
      markets = result.markets || [];
      cached = result.cached || false;
    } else {
      // Get all markets with category filtering
      const tags = category !== 'all' ? [category] : ['Sports', 'Weather'];
      const allMarkets = await polymarketService.getAllMarkets(tags);
      markets = allMarkets;
    }

    // ENHANCEMENT: Apply location extraction and weather relevance (Week 1 roadmap)
    const enhancedMarkets = markets.map(market => {
      const title = market.title || market.question || '';
      const location = polymarketService.extractLocation(title);
      const metadata = polymarketService.extractMarketMetadata(title);
      
      // Mock weather for relevance scoring (will be real weather in full implementation)
      const mockWeatherData = { current: { temp_f: 70 } };
      const weatherRelevance = polymarketService.assessWeatherRelevance(market, mockWeatherData);

      return {
        id: market.tokenID || market.id,
        title,
        description: market.description,
        location, // ← Enhanced with location extraction
        currentOdds: {
          yes: parseFloat(market.outcomePrices?.[0] || market.yesPrice || 0.5),
          no: parseFloat(market.outcomePrices?.[1] || market.noPrice || 0.5)
        },
        volume24h: parseFloat(market.volume || market.volume24h || '0'),
        liquidity: parseFloat(market.liquidity || '0'),
        endDate: market.endDate || market.expiresAt,
        category: market.tags?.join(', ') || 'Sports',
        weatherRelevance: weatherRelevance.score, // ← Enhanced relevance scoring
        teams: metadata.teams,
        eventType: metadata.event_type
      };
    });

    // Filter by minimum volume and weather relevance
    const filteredMarkets = enhancedMarkets.filter(market => {
      const volumeCheck = market.volume24h >= minVolume;
      const relevanceCheck = market.weatherRelevance > 0 || search; // Include all if searching
      return volumeCheck && relevanceCheck;
    });

    // Sort by volume (roadmap default)
    filteredMarkets.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

    // Limit to prevent overload
    const limitedMarkets = filteredMarkets.slice(0, 20);

    return Response.json({
      markets: limitedMarkets,
      total: limitedMarkets.length,
      filters: { category, minVolume, search },
      cached,
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
