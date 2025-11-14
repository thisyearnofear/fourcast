/**
 * AI Service - Handles market data fetching and weather analysis
 * Single source of truth for AI-related API calls
 */

export const aiService = {
  /**
   * Fetch weather-sensitive markets for a given location
   */
  async fetchMarkets(location, weatherData) {
    try {
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, weatherData })
      });

      const data = await response.json();
      if (data.success && data.opportunities) {
        // Transform opportunities to match MarketSelector format
        const markets = data.opportunities.map(opp => ({
          marketID: opp.marketID,
          title: opp.title,
          description: opp.description,
          volume24h: opp.volume24h || 0,
          currentOdds: {
            yes: opp.currentOdds?.yes || 0.5,
            no: opp.currentOdds?.no || 0.5
          },
          liquidity: opp.liquidityBin || 0,
          tags: opp.tags || [],
          resolution: opp.resolution
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
   */
  async analyzeMarket(market, weatherData) {
    try {
      const eventData = {
        eventType: market.title || 'Prediction Market',
        location: weatherData?.location?.name || 'Unknown Location',
        currentOdds: `Yes: ${(market.currentOdds?.yes * 100 || 0).toFixed(1)}% / No: ${(market.currentOdds?.no * 100 || 0).toFixed(1)}%`,
        participants: market.description || 'Market participants'
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventData,
          weatherData,
          marketID: market.marketID
        })
      });

      const data = await response.json();
      if (data.success) {
        return { success: true, analysis: data.analysis };
      }
      return { success: false, error: data.error || 'Analysis failed' };
    } catch (err) {
      console.error('Analysis request failed:', err);
      return { success: false, error: 'Failed to connect to analysis service' };
    }
  }
};
