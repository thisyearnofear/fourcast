/**
 * AI Service - Client-safe version
 * All API calls go through server routes
 * For server-side AI logic, use aiService.server.js
 */

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
   * This method now relies on the API route which handles Redis caching server-side
   */
  async analyzeMarket(market, weatherData) {
    try {
      const eventData = {
        eventType: market.title || 'Prediction Market',
        location: weatherData?.location?.name || 'Unknown Location',
        currentOdds: { yes: market.currentOdds?.yes || 0.5, no: market.currentOdds?.no || 0.5 },
        participants: market.description || 'Market participants'
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventData,
          weatherData,
          marketID: market.marketID,
          mode: market.mode || 'basic',
          eventDate: market.resolutionDate || null
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
