/**
 * Gemini 3 Service - BYOK Implementation
 * Enhanced module that works with user-provided API keys
 */

export class GeminiService {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'models/gemini-3.0-pro';
  }

  /**
   * Enhanced analysis with user-provided API key
   */
  async analyze(params, options = {}) {
    const apiKey = options.apiKey || this.getUserApiKey();
    
    if (!apiKey) {
      throw new Error('No Gemini API key provided. Please set your API key in settings.');
    }

    try {
      console.log('🤖 Gemini 3: Analyzing with user-provided key');
      
      const prompt = this.buildEnhancedPrompt(params);
      const response = await this.callGeminiAPI(prompt, apiKey);
      
      return this.formatResponse(response, params);
    } catch (error) {
      console.error('Gemini 3 analysis failed:', error);
      throw new Error(`Gemini 3 analysis failed: ${error.message}`);
    }
  }

  /**
   * Build enhanced prompt leveraging Gemini 3's capabilities
   */
  buildEnhancedPrompt(params) {
    const { eventType, location, weatherData, currentOdds, participants, title } = params;
    
    // Format odds properly
    const oddsText = typeof currentOdds === "object"
      ? `YES: ${currentOdds.yes || "N/A"}, NO: ${currentOdds.no || "N/A"}`
      : currentOdds;

    // Format participants if available
    const participantText = participants
      ? ` (${Array.isArray(participants) ? participants.join(" vs ") : participants})`
      : "";

    return `You are an expert sports betting analyst specializing in weather impacts on game outcomes. Provide SPECIFIC, ACTIONABLE analysis with clear reasoning.

EVENT CONTEXT:
- Event Title: ${title || "Unknown"}
- Event Type: ${eventType}
- Participants: ${participantText || "Unknown"}
- Venue: ${location?.name || location || "Unknown"}
- Weather Conditions: ${this.formatWeatherData(weatherData)}

MARKET ODDS: ${oddsText}

RESPONSE FORMAT - Return ONLY this JSON structure:
{
  "weather_impact": "LOW|MEDIUM|HIGH",
  "odds_efficiency": "FAIR|OVERPRICED|UNDERPRICED|UNKNOWN",
  "confidence": "LOW|MEDIUM|HIGH",
  "analysis": "Detailed reasoning about weather impact on this specific event",
  "key_factors": ["specific, measurable factors affecting the outcome"],
  "recommended_action": "Clear recommendation based on analysis",
  "chain_recommendation": "PUBLISH|TRADE|BOTH"
}`;
  }

  /**
   * Format weather data for the prompt
   */
  formatWeatherData(weatherData) {
    if (!weatherData) return "Weather data not available";
    
    return `Temperature: ${
      weatherData?.current?.temp_f ||
      weatherData?.forecast?.forecastday?.[0]?.day?.avgtemp_f ||
      "unknown"
    }°F, Condition: ${
      weatherData?.current?.condition?.text ||
      weatherData?.forecast?.forecastday?.[0]?.day?.condition?.text ||
      "unknown"
    }, Precipitation: ${
      weatherData?.current?.precip_chance ||
      weatherData?.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain ||
      "0"
    }%, Wind: ${
      weatherData?.current?.wind_mph ||
      weatherData?.forecast?.forecastday?.[0]?.day?.maxwind_mph ||
      "0"
    } mph`;
  }

  /**
   * Call Gemini API with user key
   */
  async callGeminiAPI(prompt, apiKey) {
    const response = await fetch(`${this.baseUrl}/${this.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Format Gemini response to match existing structure
   */
  formatResponse(geminiResponse, originalParams) {
    try {
      const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('Invalid Gemini response format');
      }

      // Handle potential markdown code blocks
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?|\n?```/g, '').trim();
      }

      const parsed = JSON.parse(cleanContent);
      
      return {
        assessment: {
          weather_impact: parsed.weather_impact || "MEDIUM",
          odds_efficiency: parsed.odds_efficiency || "UNKNOWN",
          confidence: parsed.confidence || "LOW"
        },
        analysis: parsed.analysis || "Analysis completed via Gemini 3",
        key_factors: Array.isArray(parsed.key_factors) 
          ? parsed.key_factors 
          : [parsed.key_factors || "Weather factors analyzed"],
        recommended_action: parsed.recommended_action || "Monitor the market closely",
        chain_recommendation: parsed.chain_recommendation || "BOTH",
        citations: [],
        limitations: null,
        source: "gemini_3_byok"
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      throw new Error('Failed to process Gemini 3 response');
    }
  }

  /**
   * Get user API key from preferences
   */
  getUserApiKey() {
    // This will be implemented in the preferences module
    if (typeof window !== 'undefined') {
      const encoded = localStorage.getItem('user-gemini-api-key');
      return encoded ? atob(encoded) : null;
    }
    return null;
  }

  /**
   * Test API key validity
   */
  async testApiKey(apiKey) {
    try {
      const response = await this.callGeminiAPI("Test connection", apiKey);
      return { valid: true, response };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}