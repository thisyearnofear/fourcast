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
      let analysisLocation = market.location || market.eventLocation || 'Unknown Location';

      // For sports events, validate that the location makes sense for the sport
      if (market.eventType && market.eventType === 'NFL' && analysisLocation) {
        // If location is clearly not in the US/Canada, try to extract meaningful location from other fields
        const lowerLocation = analysisLocation.toLowerCase();
        const usCanadaCountries = ['us', 'usa', 'united states', 'ca', 'canada', 'american', 'canadian'];
        const isUsCanada = usCanadaCountries.some(country => lowerLocation.includes(country));

        if (!isUsCanada) {
          // For NFL games, location outside US/Canada is invalid
          // This indicates we're using the user's location instead of the game location
          // In this case, we should try to get a more appropriate location or use generic info
          // For now, we'll use the teams info to get the correct location if possible
          if (market.teams && market.teams.length > 0) {
            // The location should have been set based on the teams, but if we're here,
            // it means the location extraction didn't work properly
            analysisLocation = 'US Location'; // Generic placeholder
          }
        }
      }

      const eventData = {
        eventType: market.title || 'Prediction Market',
        location: analysisLocation,
        currentOdds: { yes: market.currentOdds?.yes || 0.5, no: market.currentOdds?.no || 0.5 },
        participants: market.description || 'Market participants'
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventData,
          weatherData: null,
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
