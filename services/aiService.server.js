/**
 * Server-only AI Service functions
 * Import this only in API routes (server-side)
 */

import OpenAI from 'openai';
import { getRedisClient } from './redisService';

const callVeniceAI = async (params, options = {}) => {
  const { eventType, location, weatherData, currentOdds, participants } = params;
  const { webSearch = false, showThinking = false } = options;

  // Configure Venice AI client
  const client = new OpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: 'https://api.venice.ai/api/v1'
  });

    const messages = [
    {
      role: 'system',
      content: 'You are a concise prediction market analyst. Analyze weather impacts on odds. Be direct and actionable - no unnecessary detail.'
    },
    {
      role: 'user',
      content: `Analyze how this prediction market might be influenced by weather conditions.

MARKET: "${eventType}"
WEATHER CONDITIONS: ${weatherData?.current?.temp_f || 'unknown'}°F temperature, ${weatherData?.current?.condition?.text || 'unknown'} conditions, ${weatherData?.current?.precip_chance || '0'}% precipitation chance, ${weatherData?.current?.wind_mph || '0'}mph winds
CURRENT ODDS: ${currentOdds}

Respond with this exact JSON structure containing your analysis:
{
  "weather_impact": "LOW",
  "odds_efficiency": "UNKNOWN", 
  "confidence": "HIGH",
  "analysis": "The weather conditions show minimal impact on this corporate market cap prediction.",
  "key_factors": ["Weather has no direct influence on corporate performance"],
  "recommended_action": "No trading action needed - weather irrelevant",
  ${webSearch ? '"citations": [{"title":"...","url":"https://...","snippet":"..."}], "limitations": "..."' : ''}
}`
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

export async function analyzeWeatherImpactServer(params) {
  const { eventType, location, weatherData, currentOdds, participants, marketId, eventDate, mode = 'basic' } = params;

  try {
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

    const analysis = await callVeniceAI({ eventType, location, weatherData, currentOdds, participants }, {
      webSearch: mode === 'deep',
      showThinking: false
    });

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
