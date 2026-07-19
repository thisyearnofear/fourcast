import { analyzeWeatherImpactServer, getAIStatus } from '@/services/aiService.server';
import { APIInputValidator, WeatherDataValidator, FuturesBetValidator } from '@/services/validators/index.js';
import { polymarketService } from '@/services/polymarketService';
import { kalshiService } from '@/services/kalshiService';

// Simple API auth for bot/external access
export const runtime = 'nodejs';
export const maxDuration = 60;

const BOT_API_SECRET = process.env.BOT_API_SECRET || '';

function isAuthorized(request) {
  const auth = request.headers.get('x-fourcast-auth');
  if (!BOT_API_SECRET) return true; // No secret set = open access
  return auth === BOT_API_SECRET;
}

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
    // Auth check
    if (!isAuthorized(request)) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      eventType, 
      location, 
      weatherData, 
      currentOdds, 
      participants, 
      marketID,      // Support both marketID and marketId for backward compatibility
      marketId,
      title, 
      isFuturesBet, 
      mode = 'basic',
      // New analysis options from UI toggles
      includeWeather = true,
      includeSynthData = true,
      includeFutures = false,
      webSearchEnabled = false,
      analysisTypes = []
    } = body;

    // Use either marketID or marketId (support both cases)
    let resolvedMarketId = marketID || marketId;

    // DEBUG: Log the incoming marketID
    console.log('[DEBUG] resolvedMarketId:', resolvedMarketId);

    // ENHANCED: Comprehensive input validation using APIInputValidator
    const inputValidation = APIInputValidator.validateAPIInput('analyze', {
      marketId: resolvedMarketId,
      location,
      weatherData,
      eventType,
      mode
    });

    // Allow free-form queries (no marketId) when eventType is provided
    if (!inputValidation.valid) {
      // If only marketId is missing but eventType is provided, proceed
      const missingMarketId = inputValidation.errors?.length === 1 &&
        inputValidation.errors[0]?.toLowerCase().includes('marketid');
      if (!missingMarketId) {
        return Response.json({
          success: false,
          error: 'Input validation failed',
          errors: inputValidation.errors,
          warnings: inputValidation.warnings
        }, { status: 400 });
      }
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

    // Market-first lookup: when no marketId, search for matching markets
    let marketSearched = false;
    if (!resolvedMarketId && eventType && eventType.trim().length > 0) {
      try {
        const query = (title || eventType).trim().toLowerCase();
        console.log(`[Analyze] Searching markets for: "${query}"`);

        // Fetch markets from both platforms
        const [polyMarkets, kalshiMarkets] = await Promise.allSettled([
          polymarketService.buildMarketCatalog(10000, null, 'discovery').catch(() => ({ markets: [] })),
          kalshiService.getMarketsByCategory('all', 50).catch(() => []),
        ]);

        const polyList = polyMarkets.status === 'fulfilled' ? (polyMarkets.value?.markets || []) : [];
        const kalshiList = kalshiMarkets.status === 'fulfilled' ? kalshiMarkets.value : [];

        // Search titles for the query
        const searchWords = query.split(/\s+/).filter(w => w.length > 2);

        const findMatch = (markets, idField, titleField) => {
          if (!markets || markets.length === 0) return null;
          // Exact match first
          const exact = markets.find(m =>
            (m[titleField] || m.title || '').toLowerCase().includes(query)
          );
          if (exact) return exact;
          // Word-level match
          for (const word of searchWords) {
            const match = markets.find(m =>
              (m[titleField] || m.title || '').toLowerCase().includes(word)
            );
            if (match) return match;
          }
          return null;
        };

        const polyMatch = findMatch(polyList, 'id', 'title');
        const kalshiMatch = findMatch(kalshiList, 'marketID', 'title');

        if (polyMatch) {
          resolvedMarketId = polyMatch.id || polyMatch.marketID;
          marketSearched = true;
          console.log(`[Analyze] Matched Polymarket market: ${polyMatch.title?.slice(0, 60)} (${resolvedMarketId})`);
        } else if (kalshiMatch) {
          resolvedMarketId = kalshiMatch.marketID || kalshiMatch.id;
          marketSearched = true;
          console.log(`[Analyze] Matched Kalshi market: ${kalshiMatch.title?.slice(0, 60)} (${resolvedMarketId})`);
        } else {
          console.log(`[Analyze] No market match for: "${query}"`);
        }
      } catch (err) {
        console.error('[Analyze] Market search failed:', err.message);
        // Continue without marketId — analysis may be less specific
      }
    }

    // Rate limiting — skip for subscribers
    const clientId = getClientIdentifier(request);

    // Check if user has an active subscription (bypass rate limit)
    let isSubscriber = false;
    const contractAddr = process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT;
    const usdcAddr = process.env.NEXT_PUBLIC_USDC_TOKEN;
    if (contractAddr && usdcAddr) {
      try {
        const { createPublicClient, http } = await import('viem');
        const arcChain = {
          id: 5042002, name: 'Arc Testnet',
          nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
        };
        const pc = createPublicClient({
          chain: arcChain,
          transport: http(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network/'),
        });
        const data = await pc.readContract({
          address: contractAddr,
          abi: [{
            inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
            name: 'getSubscription',
            outputs: [
              { internalType: 'bool', name: 'active', type: 'bool' },
              { internalType: 'uint8', name: 'tier', type: 'uint8' },
              { internalType: 'uint256', name: 'expiresAt', type: 'uint256' },
            ],
            stateMutability: 'view', type: 'function',
          }],
          functionName: 'getSubscription',
          args: [clientId],
        });
        // Data[0] = active boolean, data[1] = tier (1=Pro, 2=Premium)
        isSubscriber = data[0] && Number(data[1]) > 0;
      } catch { /* if contract call fails, fall through to normal rate limit */ }
    }

    const limitPerHour = isSubscriber ? Infinity : (mode === 'deep' ? 10 : ANALYSIS_RATE_LIMIT);
    if (!checkAnalysisRateLimit(clientId)) {
      return Response.json({
        error: 'Analysis rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(ANALYSIS_WINDOW / 1000)
      }, { status: 429 });
    }

    // Optional Bright Data enrichment (skipped when disabled/credits exhausted)
    let brightDataIntel = null;
    if (webSearchEnabled) {
      try {
        const { brightDataService } = await import('@/services/brightDataService.js');
        if (!brightDataService.isAvailable()) {
          console.warn('[Analyze] Deep web scrape unavailable — continuing with AI-only analysis');
        } else {
          const { MarketIntelligenceAnalyzer } = await import('@/services/analysis/MarketIntelligenceAnalyzer.js');
          const intelligenceAnalyzer = new MarketIntelligenceAnalyzer();
          const enriched = await intelligenceAnalyzer.enrichContext({
            title: title || eventType,
            description: title || eventType,
            currentOdds,
          });
          if (enriched.intelligenceData && enriched.intelligenceData.results.length > 0) {
            brightDataIntel = enriched.intelligenceData;
          }
        }
      } catch (err) {
        console.warn('[Analyze] Web scrape enrichment failed:', err.message);
      }
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
      marketId: resolvedMarketId, // ← Roadmap-aligned cache key
      eventDate: body.eventDate, // ← Dynamic TTL based on event timing
      mode,
      analysisTypes, // ← Finance analysis types (fundamental, technical, sentiment)
      includeThinking: true, // ← Enable deep reasoning for visualizer
      brightDataContext: brightDataIntel, // ← Bright Data web intelligence
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
      marketId: resolvedMarketId,
      marketSearched,
      assessment: {
        weather_impact: analysis.assessment?.weather_impact || 'UNKNOWN',
        odds_efficiency: analysis.assessment?.odds_efficiency || 'UNKNOWN', 
        confidence: analysis.assessment?.confidence || 'LOW'
      },
      reasoning: analysis.analysis || 'Analysis not available',
      thinking: analysis.thinking, // ← Deep reasoning for visualizer
      key_factors: analysis.key_factors || [],
      recommended_action: analysis.recommended_action || 'Monitor manually',
      chain_recommendation: analysis.chain_recommendation || 'BOTH',
      weather_conditions: weatherConditions,
      cached: analysis.cached || false,
      source: brightDataIntel ? 'brightdata+ai' : (analysis.source || 'unknown'),
      forecastSource: brightDataIntel ? 'brightdata+research' : analysis.source,
      citations: analysis.citations || [],
      limitations: analysis.limitations || null,
      web_search: !!brightDataIntel || mode === 'deep',
      brightData: brightDataIntel ? {
        resultsCount: brightDataIntel.results.length,
        sources: brightDataIntel.results.map(r => ({ title: r.title, source: r.source, link: r.link })),
        deepResearch: brightDataIntel.deepResearch ? {
          title: brightDataIntel.deepResearch.title,
          url: brightDataIntel.deepResearch.url,
          charCount: brightDataIntel.deepResearch.charCount,
          product: brightDataIntel.deepResearchProduct,
        } : null,
        productsUsed: brightDataIntel.productsUsed,
      } : null,
      // ENHANCED: Include SynthData for finance markets
      synthData: analysis.synthData || null,
      // ENHANCED: Include analysis types used for display badges
      analysisTypes: analysisTypes || [],
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
