/**
 * AI Service - Client-safe version
 * All API calls go through server routes
 * For server-side AI logic, use aiService.server.js
 */

import { WeatherAnalyzer } from './analysis/WeatherAnalyzer.js';

// Singleton instance
const weatherAnalyzer = new WeatherAnalyzer();

export const aiService = {

  /**
   * Fetch weather-sensitive markets for a given location
   * This method relies on the API route which may have its own caching
   */
  async fetchMarkets(location, weatherData) {
    try {
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, weatherData })
      });

      const data = await response.json();
      if (data.success && data.markets) {
        // Transform markets to match MarketSelector format
        const markets = data.markets.map(market => ({
           marketID: market.marketID,
           title: market.title,
           description: market.description,
           volume24h: market.volume24h || 0,
           currentOdds: {
             yes: market.currentOdds?.yes || 0.5,
             no: market.currentOdds?.no || 0.5
           },
           liquidity: market.liquidity || 0,
           tags: market.tags || [],
           resolution: market.endDate
         }));
        return { success: true, markets };
      }
      return { success: false, error: data.error || 'No markets available' };
    } catch (err) {
      console.error('Market fetch failed:', err);
      return { success: false, error: 'Failed to fetch market data' };
    }
  },

  /**
   * Analyze a market based on weather data
   * REFACTORED: Now uses the Generic EdgeAnalyzer Pattern via WeatherAnalyzer
   */
  async analyzeMarket(market, weatherData) {
    try {
      // 1. Prepare Context
      let analysisLocation = market.location || market.eventLocation || 'Unknown Location';

      // NFL Location Logic (Legacy support)
      if (market.eventType && market.eventType === 'NFL' && analysisLocation) {
        const lowerLocation = analysisLocation.toLowerCase();
        const usCanadaCountries = ['us', 'usa', 'united states', 'ca', 'canada', 'american', 'canadian'];
        const isUsCanada = usCanadaCountries.some(country => lowerLocation.includes(country));

        if (!isUsCanada && market.teams?.length > 0) {
          analysisLocation = 'US Location';
        }
      }

      const context = {
        marketID: market.marketID,
        title: market.title || 'Prediction Market',
        location: analysisLocation,
        venue: analysisLocation,
        currentOdds: { yes: market.currentOdds?.yes || 0.5, no: market.currentOdds?.no || 0.5 },
        eventDate: market.resolutionDate || null,
        description: market.description,
        // Optional: Pass pre-fetched weather data if available to avoid re-fetching
        weatherData: weatherData 
      };

      // 2. Execute Analysis via Class
      // Note: WeatherAnalyzer usually fetches its own weather, but we can modify it 
      // or just let it refetch/use cache. For now, we rely on the class's enrichContext.
      
      // If we are server-side or have direct access, we'd call analyzer.analyze(context).
      // However, client-side, we still likely want to hit an API route that *uses* the analyzer
      // to keep keys secret.
      
      // OPTION A: Client-side usage of Analyzer (if safe/mocked)
      // const signal = await weatherAnalyzer.analyze(context);
      
      // OPTION B: Keep API route for security, but API route uses Analyzer
      // We will stick to the API route pattern for now to minimize breakage, 
      // but we send the data in a structure that the server-side Analyzer expects.

      const eventData = {
        eventType: context.title,
        location: context.location,
        currentOdds: context.currentOdds,
        participants: context.description
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventData,
          weatherData: null, // Let server fetch/verify
          marketID: market.marketID,
          mode: market.mode || 'basic',
          eventDate: market.resolutionDate || null,
          useEdgeAnalyzer: true // Flag to tell server to use new class
        })
      });

      const data = await response.json();
      if (data.success) return { success: true, ...data };
      return { success: false, error: data.error || 'Analysis failed' };

    } catch (err) {
      console.error('Analysis request failed:', err);
      return { success: false, error: 'Failed to connect to analysis service' };
    }
  }
};

