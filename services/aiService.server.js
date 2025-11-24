/**
 * Server-only AI Service functions
 * Import this only in API routes (server-side)
 */

import OpenAI from 'openai';
import { getRedisClient } from './redisService';
import { LocationValidator } from './locationValidator.js';

const callVeniceAI = async (params, options = {}) => {
  const { eventType, location, weatherData, currentOdds, participants, title, isFuturesBet } = params;
  const { webSearch = false, showThinking = false } = options;

  // Configure Venice AI client
  const client = new OpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: 'https://api.venice.ai/api/v1'
  });

  // Format odds properly
  const oddsText = typeof currentOdds === 'object'
    ? `YES: ${currentOdds.yes || 'N/A'}, NO: ${currentOdds.no || 'N/A'}`
    : currentOdds;

  // Format participants if available
  const participantText = participants
    ? ` (${Array.isArray(participants) ? participants.join(' vs ') : participants})`
    : '';

  // Validate location using consolidated LocationValidator service
  const locationValidation = LocationValidator.validateLocation(eventType, location, { title });
  if (!locationValidation.valid) {
    const locationText = location?.name || location || 'Unknown';
    return LocationValidator.generateValidationErrorResponse(locationValidation, eventType, locationText);
  }

  const messages = [
    {
      role: 'system',
      content: `You are an expert sports betting analyst specializing in weather impacts on game outcomes. You provide SPECIFIC, ACTIONABLE analysis with clear reasoning. Focus on:

1. How specific weather conditions affect game dynamics (passing vs running, scoring, field conditions)
2. Which team benefits more from these conditions and why
3. Whether the current market odds properly reflect this weather edge
4. Clear YES/NO/AVOID recommendation with rationale

Be concise but specific. No generic advice.`
    },

    {
      role: 'user',
      content: `Analyze this prediction market for weather-driven betting opportunities:

MARKET: ${eventType}${participantText}
LOCATION: ${location?.name || location || 'Unknown'}
GAME TIME: ${weatherData?.forecast?.forecastday?.[0]?.date || 'Unknown'}

WEATHER CONDITIONS:
- Temperature: ${weatherData?.current?.temp_f || weatherData?.forecast?.forecastday?.[0]?.day?.avgtemp_f || 'unknown'}°F
- Conditions: ${weatherData?.current?.condition?.text || weatherData?.forecast?.forecastday?.[0]?.day?.condition?.text || 'unknown'}
- Precipitation: ${weatherData?.current?.precip_chance || weatherData?.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || '0'}% chance
- Wind: ${weatherData?.current?.wind_mph || weatherData?.forecast?.forecastday?.[0]?.day?.maxwind_mph || '0'} mph

CURRENT MARKET ODDS: ${oddsText}

Provide your analysis in this EXACT JSON format (replace the example values with your actual analysis):

EXAMPLE (for a different game):
{
  "weather_impact": "HIGH",
  "odds_efficiency": "UNDERPRICED",
  "confidence": "MEDIUM",
  "analysis": "Heavy rain (90% chance) and 15mph winds severely limit aerial attacks. Patriots' pass-heavy offense will struggle more than Steelers' ground game. Market underprices weather advantage by ~8%.",
  "key_factors": ["Rain reduces passing completion by 12%", "Wind favors run-heavy teams", "Steelers ranked #3 in rushing"],
  "recommended_action": "BET YES (Steelers) - Weather creates 8% edge for ground game"
}

NOW analyze THIS game and return YOUR analysis in the same JSON format:`
    }
  ];

  try {
    console.log('🤖 Calling Venice AI...');
    const response = await client.chat.completions.create({
      model: 'qwen3-235b',
      messages,
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      // Venice-specific parameters
      venice_parameters: {
        enable_web_search: webSearch ? 'auto' : undefined,
        strip_thinking_response: showThinking ? false : true
      }
    });

    const content = response.choices[0].message.content;
    console.log('🤖 Venice AI raw response:', content);

    const parsed = JSON.parse(content);
    console.log('🤖 Venice AI parsed response:', parsed);

    // Validate that we got actual analysis, not echoed input
    const hasValidAnalysis = parsed.analysis &&
      parsed.analysis !== 'string' &&
      !parsed.analysis.includes('Your detailed') &&
      typeof parsed.analysis === 'string' &&
      parsed.analysis.length > 20;

    const hasValidFactors = Array.isArray(parsed.key_factors) &&
      parsed.key_factors.length > 0 &&
      !parsed.key_factors[0]?.includes('Factor');

    if (!hasValidAnalysis || !hasValidFactors) {
      console.warn('⚠️ AI returned invalid/template response, using fallback');
      throw new Error('AI returned template instead of analysis');
    }

    return {
      assessment: {
        weather_impact: parsed.weather_impact || 'MEDIUM',
        odds_efficiency: parsed.odds_efficiency || 'UNKNOWN',
        confidence: parsed.confidence || 'LOW'
      },
      analysis: parsed.analysis || 'Analysis completed via Venice AI',
      key_factors: Array.isArray(parsed.key_factors) ? parsed.key_factors : [parsed.key_factors || 'Weather factors analyzed'],
      recommended_action: parsed.recommended_action || 'Monitor the market closely',
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      limitations: parsed.limitations || null
    };

  } catch (error) {
    console.error('Venice AI error:', error);
    throw new Error(`Venice AI analysis failed: ${error.message}`);
  }
};

import { weatherService } from './weatherService';

// Helper to infer location from event title using AI
const inferEventLocation = async (title, eventType) => {
  try {
    const client = new OpenAI({
      apiKey: process.env.VENICE_API_KEY,
      baseURL: 'https://api.venice.ai/api/v1'
    });

    const response = await client.chat.completions.create({
      model: 'qwen3-235b',
      messages: [{
        role: 'system',
        content: 'You are a location extractor. Use web search to find the confirmed venue for this specific event. Return ONLY the city and state/country. JSON format: {"location": "City, State"}'
      }, {
        role: 'user',
        content: `Where is this ${eventType} event taking place? "${title}"`
      }],
      response_format: { type: 'json_object' },
      venice_parameters: {
        enable_web_search: 'auto',
        include_venice_system_prompt: true
      }
    });

    const content = JSON.parse(response.choices[0].message.content);
    return content.location !== 'UNKNOWN' ? content.location : null;
  } catch (e) {
    console.error('Location inference failed:', e);
    return null;
  }
};

export async function analyzeWeatherImpactServer(params) {
  let { eventType, location, weatherData, currentOdds, participants, marketId, eventDate, title, isFuturesBet, mode = 'basic' } = params;

  try {
    // Check for futures bets FIRST
    if (isFuturesBet) {
      console.log('🎯 Futures bet detected, skipping weather analysis');
      return {
        assessment: {
          weather_impact: 'N/A',
          odds_efficiency: 'UNKNOWN',
          confidence: 'LOW'
        },
        analysis: `This is a futures bet for ${title || 'a championship market'}. Weather analysis isn't applicable since the event won't be decided until the season plays out. The current odds reflect team strength, injuries, and schedule difficulty rather than weather conditions.`,
        key_factors: [
          'Futures bets cannot be analyzed based on current weather',
          'Championship location and weather unknown until event is scheduled',
          'Season-long performance depends on many games in varying conditions'
        ],
        recommended_action: `Focus on team fundamentals - This is a futures bet where weather won't impact the outcome. Research team performance metrics, schedule difficulty, and injury reports instead.`,
        citations: [],
        limitations: 'Weather analysis not applicable to futures bets',
        cached: false,
        source: 'futures_bypass'
      };
    }

    // SMART LOCATION CORRECTION
    // Validate location before analysis
    const locationValidation = LocationValidator.validateLocation(eventType, location, { title });
    let correctedLocation = null;
    let correctedWeather = null;

    if (locationValidation.warning) {
      console.log(`⚠️ Location warning: ${locationValidation.warning}. Attempting to infer correct location...`);

      const inferred = await inferEventLocation(title, eventType);

      if (inferred && inferred.toLowerCase() !== (location?.name || location || '').toLowerCase()) {
        console.log(`📍 Inferred correct location: ${inferred}`);
        try {
          // Fetch weather for the CORRECT location
          const newWeather = await weatherService.getCurrentWeather(inferred);

          // Override params for analysis
          location = { name: inferred };
          weatherData = newWeather;
          correctedLocation = inferred;
          correctedWeather = true;

          console.log(`✅ Successfully switched analysis to ${inferred}`);
        } catch (err) {
          console.warn(`Failed to fetch weather for inferred location ${inferred}:`, err);
        }
      }
    }

    const apiKey = process.env.VENICE_API_KEY;
    console.log('Venice API Key available:', !!apiKey, 'length:', apiKey?.length);

    let redis = null;
    const cacheKey = `analysis:${marketId}`;

    // Server-side Redis caching
    redis = await getRedisClient();
    if (redis) {
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        const parsed = JSON.parse(cachedResult);
        return {
          ...parsed,
          cached: true,
          source: 'redis'
        };
      }
    }

    // Call Venice AI API if key is available
    if (!apiKey) {
      return {
        assessment: { weather_impact: 'UNKNOWN', odds_efficiency: 'UNKNOWN', confidence: 'LOW' },
        analysis: 'AI service unavailable - no API key configured',
        key_factors: ['API service not configured'],
        recommended_action: 'Configure VENICE_API_KEY in environment',
        cached: false,
        source: 'unavailable'
      };
    }

    const analysis = await callVeniceAI({
      eventType,
      location,
      weatherData,
      currentOdds,
      participants,
      title,
      isFuturesBet
    }, {
      webSearch: mode === 'deep',
      showThinking: false
    });

    // If we corrected the location, append a note to the analysis
    if (correctedLocation) {
      analysis.analysis += `\n\n(Note: Analysis automatically corrected location from "${params.location?.name || params.location}" to "${correctedLocation}" based on event details.)`;
    }

    // Cache result with roadmap-aligned TTL (6 hours for distant events, 1 hour for near events)
    const baseTtl = eventDate && new Date(eventDate) - new Date() < 24 * 60 * 60 * 1000 ? 3600 : 21600; // 1h or 6h
    const ttl = mode === 'deep' ? Math.max(baseTtl, 21600) : baseTtl; // Deep cached at least 6h
    if (redis) {
      await redis.setEx(cacheKey, ttl, JSON.stringify(analysis));
    }

    return {
      ...analysis,
      cached: false,
      source: 'venice_ai'
    };

  } catch (error) {
    console.error('AI Analysis failed:', error);

    // Fallback to simple heuristic analysis
    return {
      assessment: {
        weather_impact: 'MEDIUM',
        odds_efficiency: 'UNKNOWN',
        confidence: 'LOW'
      },
      analysis: `Error in AI analysis: ${error.message}. Fallback assessment provided.`,
      key_factors: ['Analysis service error'],
      recommended_action: 'Proceed with manual evaluation',
      cached: false,
      source: 'fallback'
    };
  }
}

export function getAIStatus() {
  const hasRedis = !!process.env.REDIS_URL;
  return {
    available: true,
    model: 'qwen3-235b',
    cacheSize: 0,
    cacheDuration: 10 * 60 * 1000,
    cache: {
      memory: { size: 0, duration: '10 minutes' },
      redis: { connected: hasRedis, ttl: '6 hours' }
    }
  };
}
