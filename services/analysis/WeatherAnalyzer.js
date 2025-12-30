import { EdgeAnalyzer } from './EdgeAnalyzer.js';
import { weatherService } from '../weatherService.js';

/**
 * Weather-specific implementation of EdgeAnalyzer
 */
export class WeatherAnalyzer extends EdgeAnalyzer {
  constructor() {
    super({ 
      name: 'WeatherAnalyzer',
      version: '2.0.0',
      model: 'llama-3.3-70b'
    });
  }

  /**
   * Enrich context with real-time weather data
   */
  async enrichContext(context) {
    const location = context.location || context.venue;
    if (!location) {
      throw new Error('Weather analysis requires a location');
    }

    // Fetch weather data using existing service
    const weatherData = await weatherService.getCurrentWeather(location);
    
    return {
      ...context,
      weatherData,
      weatherHash: this.generateHash(weatherData) // Hash the weather state
    };
  }

  /**
   * Construct a weather-specific prompt
   */
  constructPrompt(context) {
    const { title, weatherData, currentOdds } = context;
    const weatherText = `${weatherData.current.condition.text}, ${weatherData.current.temp_c}°C, Wind: ${weatherData.current.wind_kph}kph`;

    return `
      Analyze this prediction market based on weather conditions:
      Market: "${title}"
      Current Odds: Yes ${currentOdds?.yes || 0.5} | No ${currentOdds?.no || 0.5}
      Weather: ${weatherText}
      
      Does the weather significantly impact this outcome?
      Provide:
      1. Confidence (HIGH/MEDIUM/LOW)
      2. Odds Efficiency (INEFFICIENT/EFFICIENT)
      3. Brief Digest (max 200 chars)
    `;
  }

  /**
   * Override executeAnalysis to use the existing specific API route if needed
   * or keep default behavior. For now, we'll keep default which calls /api/analyze/generic
   * But since we have a specific /api/analyze route, we might want to use that.
   * 
   * However, to prove the "Generic" pattern, we should try to standardise.
   * Let's stick to the base class's generic execution which we will map to a server-side handler.
   */
}
