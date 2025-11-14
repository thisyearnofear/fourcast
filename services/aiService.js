// AI Service for Venice API integration
import OpenAI from 'openai';

class AIService {
  constructor() {
    this.client = null;
    this.cache = new Map();
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    this.initClient();
  }

  initClient() {
    const apiKey = process.env.VENICE_API_KEY || process.env.NEXT_PUBLIC_VENICE_API_KEY;

    if (!apiKey) {
      console.warn('Venice API key not found. AI features will be disabled.');
      return;
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.venice.ai/api/v1'
    });
  }

  // Generate cache key for weather analysis
  generateCacheKey(eventType, location, weatherData, currentOdds) {
    const weatherHash = JSON.stringify({
      temp: weatherData.current?.temp_f,
      condition: weatherData.current?.condition?.text,
      wind: weatherData.current?.wind_mph,
      precip: weatherData.current?.precip_mm,
      humidity: weatherData.current?.humidity
    });

    return `ai_${eventType}_${location}_${weatherHash}_${currentOdds}`;
  }

  // Check if cached analysis is still valid
  getCachedAnalysis(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // Cache analysis result
  setCachedAnalysis(cacheKey, analysis) {
    this.cache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  // Analyze weather impact on events
  async analyzeWeatherImpact(eventData) {
    if (!this.client) {
      return {
        error: 'AI service not available',
        fallback: true
      };
    }

    const { eventType, location, weatherData, currentOdds, participants } = eventData;

    // Check cache first
    const cacheKey = this.generateCacheKey(eventType, location, weatherData, currentOdds);
    const cachedResult = this.getCachedAnalysis(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        cached: true
      };
    }

    try {
      const prompt = this.buildAnalysisPrompt(eventData);

      const response = await this.client.chat.completions.create({
        model: 'qwen3-235b',
        messages: [
          {
            role: 'system',
            content: 'You are an expert analyst specializing in weather impacts on sports and events. Provide detailed, evidence-based analysis in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      // Validate response structure
      const validatedAnalysis = this.validateAnalysisResponse(analysis);

      // Cache the result
      this.setCachedAnalysis(cacheKey, validatedAnalysis);

      return {
        ...validatedAnalysis,
        cached: false
      };

    } catch (error) {
      console.error('AI Analysis Error:', error);

      // Return fallback analysis
      return {
        error: 'Analysis temporarily unavailable',
        fallback: true,
        assessment: {
          weather_impact: 'UNKNOWN',
          odds_efficiency: 'UNKNOWN',
          confidence: 'LOW'
        },
        analysis: 'Weather analysis is currently unavailable. Please try again later.',
        key_factors: ['Service temporarily unavailable'],
        recommended_action: 'Monitor weather updates manually'
      };
    }
  }

  // Build analysis prompt
  buildAnalysisPrompt(eventData) {
    const { eventType, location, weatherData, currentOdds, participants } = eventData;

    return `Analyze this event for weather-related edge:

Event: ${eventType}
Location: ${location}
Participants: ${participants || 'Various competitors'}
Weather: ${weatherData.current?.temp_f}°F, ${weatherData.current?.wind_mph} mph winds, ${weatherData.current?.precip_mm}mm precipitation, ${weatherData.current?.humidity}% humidity, ${weatherData.current?.condition?.text}
Current Odds: ${currentOdds}

Respond with JSON in this exact format:
{
  "assessment": {
    "weather_impact": "HIGH|MEDIUM|LOW|UNKNOWN",
    "odds_efficiency": "EFFICIENT|INEFFICIENT|UNKNOWN",
    "confidence": "HIGH|MEDIUM|LOW"
  },
  "analysis": "2-3 paragraph detailed analysis with specific reasoning",
  "key_factors": ["factor1", "factor2", "factor3"],
  "recommended_action": "Specific recommendation based on analysis"
}`;
  }

  // Validate analysis response structure
  validateAnalysisResponse(analysis) {
    const defaultAnalysis = {
      assessment: {
        weather_impact: 'UNKNOWN',
        odds_efficiency: 'UNKNOWN',
        confidence: 'LOW'
      },
      analysis: 'Analysis could not be completed properly.',
      key_factors: ['Analysis validation failed'],
      recommended_action: 'Exercise caution with weather-sensitive events'
    };

    if (!analysis || typeof analysis !== 'object') {
      return defaultAnalysis;
    }

    // Ensure required fields exist
    if (!analysis.assessment) analysis.assessment = defaultAnalysis.assessment;
    if (!analysis.analysis) analysis.analysis = defaultAnalysis.analysis;
    if (!Array.isArray(analysis.key_factors)) analysis.key_factors = defaultAnalysis.key_factors;
    if (!analysis.recommended_action) analysis.recommended_action = defaultAnalysis.recommended_action;

    // Validate assessment values
    const validImpacts = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
    const validEfficiency = ['EFFICIENT', 'INEFFICIENT', 'UNKNOWN'];
    const validConfidence = ['HIGH', 'MEDIUM', 'LOW'];

    if (!validImpacts.includes(analysis.assessment.weather_impact)) {
      analysis.assessment.weather_impact = 'UNKNOWN';
    }
    if (!validEfficiency.includes(analysis.assessment.odds_efficiency)) {
      analysis.assessment.odds_efficiency = 'UNKNOWN';
    }
    if (!validConfidence.includes(analysis.assessment.confidence)) {
      analysis.assessment.confidence = 'LOW';
    }

    return analysis;
  }

  // Get AI service status
  getStatus() {
    return {
      available: !!this.client,
      cacheSize: this.cache.size,
      cacheDuration: this.CACHE_DURATION
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;