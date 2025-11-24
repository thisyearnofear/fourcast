import { analyzeWeatherImpactServer, getAIStatus } from '@/services/aiService.server';
import { APIInputValidator, WeatherDataValidator, FuturesBetValidator } from '@/services/validators/index.js';

// Rate limiting for AI analysis
const analysisRateLimit = new Map();
const ANALYSIS_RATE_LIMIT = 10; // 10 analyses per hour
const ANALYSIS_WINDOW = 60 * 60 * 1000; // 1 hour

function checkAnalysisRateLimit(identifier) {
  const now = Date.now();
  const userRequests = analysisRateLimit.get(identifier) || [];

  // Remove old requests
  const validRequests = userRequests.filter(timestamp => now - timestamp < ANALYSIS_WINDOW);

  if (validRequests.length >= ANALYSIS_RATE_LIMIT) {
    return false;
  }

  // Add current request
  validRequests.push(now);
  analysisRateLimit.set(identifier, validRequests);

  return true;
}

function getClientIdentifier(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const userAgent = request.headers.get('user-agent');

  return forwarded?.split(',')[0]?.trim() ||
         realIp?.trim() ||
         userAgent ||
         'unknown';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventType, location, weatherData, currentOdds, participants, marketID, title, isFuturesBet, mode = 'basic' } = body;

    // ENHANCED: Comprehensive input validation using APIInputValidator
    const inputValidation = APIInputValidator.validateAPIInput('analyze', {
      marketId: marketID,
      location,
      weatherData,
      eventType,
      mode
    });

    if (!inputValidation.valid) {
      return Response.json({
        success: false,
        error: 'Input validation failed',
        errors: inputValidation.errors,
        warnings: inputValidation.warnings
      }, { status: 400 });
    }

    let weatherValidation = { valid: true, errors: [], warnings: [], dataQuality: 'UNKNOWN' };
    if (weatherData) {
      weatherValidation = WeatherDataValidator.validateWeatherData('current', weatherData);
    }

    // Market type validation for weather compatibility
    const marketData = { title, description: title, tags: [] };
    const futuresValidation = FuturesBetValidator.validateMarketType('weather-compatibility', marketData, {
      requestedAnalysis: 'weather'
    });

    // Include validation warnings in response (don't fail for warnings)
    const allWarnings = [
      ...inputValidation.warnings,
      ...weatherValidation.warnings,
      ...futuresValidation.warnings
    ];

    // Rate limiting
    const clientId = getClientIdentifier(request);
    const limitPerHour = mode === 'deep' ? 10 : ANALYSIS_RATE_LIMIT;
    if (!checkAnalysisRateLimit(clientId)) {
      return Response.json({
        error: 'Analysis rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(ANALYSIS_WINDOW / 1000)
      }, { status: 429 });
    }

    // ENHANCED: Perform AI analysis with Redis caching and roadmap alignment
    const analysis = await analyzeWeatherImpactServer({
      eventType,
      location,
      weatherData,
      currentOdds,
      participants,
      title,
      isFuturesBet,
      marketId: marketID, // ← Roadmap-aligned cache key: analysis:{marketID}
      eventDate: body.eventDate, // ← Dynamic TTL based on event timing
      mode
    });

    // Format weather conditions for display
    const weatherConditions = analysis.weather_conditions || {
      temperature: `${weatherData?.current?.temp_f || weatherData?.forecast?.forecastday?.[0]?.day?.avgtemp_f || 'N/A'}°F`,
      condition: weatherData?.current?.condition?.text || weatherData?.forecast?.forecastday?.[0]?.day?.condition?.text || 'Unknown',
      precipitation: `${weatherData?.current?.precip_chance || weatherData?.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || '0'}%`,
      wind: `${weatherData?.current?.wind_mph || weatherData?.forecast?.forecastday?.[0]?.day?.maxwind_mph || '0'} mph`,
      location: location?.name || location || 'Unknown'
    };

    return Response.json({
      success: true,
      marketId: marketID,
      assessment: {
        weather_impact: analysis.assessment?.weather_impact || 'UNKNOWN',
        odds_efficiency: analysis.assessment?.odds_efficiency || 'UNKNOWN', 
        confidence: analysis.assessment?.confidence || 'LOW'
      },
      reasoning: analysis.analysis || 'Analysis not available',
      key_factors: analysis.key_factors || [],
      recommended_action: analysis.recommended_action || 'Monitor manually',
      weather_conditions: weatherConditions,
      cached: analysis.cached || false,
      source: analysis.source || 'unknown',
      citations: analysis.citations || [],
      limitations: analysis.limitations || null,
      web_search: mode === 'deep',
      // ENHANCED: Include validation results
      validation: {
        weatherDataQuality: weatherValidation.dataQuality,
        marketWeatherCompatible: futuresValidation.weatherCompatible,
        warnings: allWarnings
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis API Error:', error);

    return Response.json({
      success: false,
      error: 'Analysis failed',
      message: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  // ENHANCED: Return AI service status with Redis info
  const status = getAIStatus();

  return Response.json({
    service: 'Weather Edge AI Analysis',
    status: status.available ? 'available' : 'unavailable',
    model: status.model || 'qwen3-235b',
    cache: status.cache || {
      memory: { size: status.cacheSize, duration: `${status.cacheDuration / (60 * 1000)} minutes` },
      redis: { connected: false, ttl: '6 hours' }
    },
    rateLimit: `${ANALYSIS_RATE_LIMIT} analyses per hour`,
    features: [
      'Redis caching with dynamic TTL',
      'Market-specific cache keys (analysis:{marketID})',
      'Graceful fallback to in-memory cache'
    ]
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
