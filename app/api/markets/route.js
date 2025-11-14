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
      // Still return success but with a message
      return Response.json({
        success: true,
        opportunities: [],
        message: `No weather-sensitive markets available for ${location} at this time`,
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

export async function GET() {
  // Return market service status
  const status = polymarketService.getStatus();

  return Response.json({
    service: 'Polymarket Data Service',
    status: status.available ? 'available' : 'unavailable',
    cache: {
      size: status.cacheSize,
      duration: status.cacheDuration
    },
    baseURL: status.baseURL,
    timestamp: new Date().toISOString()
  });
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
