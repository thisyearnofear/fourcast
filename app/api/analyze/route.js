import { aiService } from '@/services/aiService';

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
    const { eventType, location, weatherData, currentOdds, participants, marketID } = body;

    // Validate required fields
    if (!eventType || !location || !weatherData || !currentOdds) {
      return Response.json({
        success: false,
        error: 'Missing required fields: eventType, location, weatherData, currentOdds'
      }, { status: 400 });
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    if (!checkAnalysisRateLimit(clientId)) {
      return Response.json({
        error: 'Analysis rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(ANALYSIS_WINDOW / 1000)
      }, { status: 429 });
    }

    // ENHANCED: Perform AI analysis with Redis caching and roadmap alignment
    const analysis = await aiService.analyzeWeatherImpact({
      eventType,
      location,
      weatherData,
      currentOdds,
      participants,
      marketId: marketID, // ← Roadmap-aligned cache key: analysis:{marketID}
      eventDate: body.eventDate // ← Dynamic TTL based on event timing
    });

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
      cached: analysis.cached || false, // ← Shows if result came from Redis
      source: analysis.source || 'unknown', // ← redis/memory/venice_ai
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
  const status = aiService.getStatus();

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