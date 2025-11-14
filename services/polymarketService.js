// Polymarket Service for fetching live market data
import axios from 'axios';

class PolymarketService {
  constructor() {
    this.baseURL = 'https://gamma-api.polymarket.com';
    this.cache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for market data
    this.eventCache = new Map();
  }

  // Generate cache key for markets
  generateCacheKey(location) {
    return `markets_${location}`;
  }

  // Check if cached data is valid
  getCachedMarkets(location) {
    const cacheKey = this.generateCacheKey(location);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // Cache market data
  setCachedMarkets(location, markets) {
    const cacheKey = this.generateCacheKey(location);
    this.cache.set(cacheKey, {
      data: markets,
      timestamp: Date.now()
    });
  }

  /**
   * Fetch all active markets from Polymarket
   * Optionally filter by tags (e.g., "Sports", "Politics")
   */
  async getAllMarkets(tags = null) {
    try {
      const params = {
        limit: 100,
        active: true,
        order: 'volume24h'
      };

      if (tags) {
        params.tags = Array.isArray(tags) ? tags.join(',') : tags;
      }

      const response = await axios.get(`${this.baseURL}/markets`, { params });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching all markets:', error.message);
      return [];
    }
  }

  /**
   * Search markets by keyword (e.g., location name, team name, event type)
   * Returns relevant markets for a given location
   */
  async searchMarketsByLocation(location) {
    // Check cache first
    const cached = this.getCachedMarkets(location);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      // Search for outdoor/weather-sensitive events in the location
      const searchTerms = [
        location, // Direct location search
        `${location} weather`,
        `${location} sports`,
      ];

      let allMarkets = [];

      for (const term of searchTerms) {
        try {
          const response = await axios.get(`${this.baseURL}/markets`, {
            params: {
              search: term,
              limit: 50,
              active: true
            }
          });

          if (response.data && Array.isArray(response.data)) {
            allMarkets = [...allMarkets, ...response.data];
          }
        } catch (err) {
          // Continue if individual search fails
          console.debug(`Market search for "${term}" failed:`, err.message);
        }
      }

      // Remove duplicates by tokenID
      const uniqueMarkets = Array.from(
        new Map(allMarkets.map(m => [m.tokenID || m.id, m])).values()
      );

      // Filter for weather-sensitive events (outdoor sports, marathons, outdoor events)
      const weatherSensitiveMarkets = uniqueMarkets.filter(market => {
        const title = market.title || market.question || '';
        const tags = market.tags || [];
        const weatherSensitiveKeywords = [
          'weather', 'temperature', 'rain', 'snow', 'wind',
          'outdoor', 'nfl', 'nba', 'golf', 'tennis', 'marathon',
          'cricket', 'baseball', 'football', 'soccer'
        ];

        return weatherSensitiveKeywords.some(
          keyword => title.toLowerCase().includes(keyword) ||
                     tags.some(tag => tag.toLowerCase().includes(keyword))
        );
      });

      const result = {
        markets: weatherSensitiveMarkets.slice(0, 10), // Top 10 relevant markets
        location,
        timestamp: new Date().toISOString(),
        totalFound: weatherSensitiveMarkets.length
      };

      // Cache the results
      this.setCachedMarkets(location, result);

      return result;
    } catch (error) {
      console.error('Error searching markets for location:', error.message);
      return {
        markets: [],
        location,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get detailed market information including current odds
   */
  async getMarketDetails(marketID) {
    try {
      const response = await axios.get(`${this.baseURL}/markets/${marketID}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching market details for ${marketID}:`, error.message);
      return null;
    }
  }

  /**
   * Get the best opportunities - markets with high volume but potentially mispriced
   * This requires comparing AI-assessed probability vs actual odds
   */
  async getWeatherAdjustedOpportunities(weatherData, location) {
    try {
      const markets = await this.searchMarketsByLocation(location);

      if (!markets.markets || markets.markets.length === 0) {
        return {
          opportunities: [],
          message: 'No weather-sensitive markets found for this location'
        };
      }

      // Map markets to opportunities with basic pricing
      const opportunities = markets.markets.map(market => ({
        marketID: market.tokenID || market.id,
        title: market.title || market.question,
        description: market.description,
        tags: market.tags || [],
        currentOdds: {
          yes: market.yesPrice || market.bid,
          no: market.noPrice || market.ask,
        },
        volume24h: market.volume24h,
        liquidityBin: market.liquidity,
        resolution: market.resolutionDate || market.expiresAt,
        weatherRelevance: this.assessWeatherRelevance(market, weatherData)
      }));

      // Sort by volume and weather relevance
      opportunities.sort((a, b) => {
        const volumeDiff = (b.volume24h || 0) - (a.volume24h || 0);
        if (volumeDiff !== 0) return volumeDiff;
        return (b.weatherRelevance.score || 0) - (a.weatherRelevance.score || 0);
      });

      return {
        opportunities: opportunities.slice(0, 10),
        location,
        weatherContext: {
          temp: weatherData.current?.temp_f,
          condition: weatherData.current?.condition?.text,
          wind: weatherData.current?.wind_mph,
          humidity: weatherData.current?.humidity
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting weather-adjusted opportunities:', error.message);
      return {
        opportunities: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Assess how relevant weather is to a given market
   */
  assessWeatherRelevance(market, weatherData) {
    const title = (market.title || market.question || '').toLowerCase();

    const weatherImpactFactors = {
      outdoor: title.includes('outdoor') || title.includes('marathon') ? 2 : 0,
      wind: title.includes('wind') || title.includes('sail') ? 2 : 0,
      precipitation: title.includes('rain') || title.includes('snow') ? 2 : 0,
      temperature: title.includes('temperature') || title.includes('cold') ? 1.5 : 0,
      sports: ['nfl', 'nba', 'golf', 'tennis', 'baseball', 'soccer', 'cricket'].some(
        sport => title.includes(sport)
      ) ? 1 : 0,
      weather_word: title.includes('weather') ? 3 : 0
    };

    const score = Object.values(weatherImpactFactors).reduce((a, b) => a + b, 0);

    return {
      score: Math.min(score, 10),
      factors: weatherImpactFactors,
      isWeatherSensitive: score > 0
    };
  }

  /**
   * Get market price history (if available via API)
   */
  async getMarketHistory(marketID) {
    try {
      const response = await axios.get(`${this.baseURL}/markets/${marketID}/history`, {
        params: { limit: 100 }
      });
      return response.data;
    } catch (error) {
      console.debug('Market history not available:', error.message);
      return null;
    }
  }

  /**
   * Get status of AI service + polymarket data availability
   */
  getStatus() {
    return {
      service: 'Polymarket Data Service',
      available: true,
      cacheSize: this.cache.size,
      cacheDuration: `${this.CACHE_DURATION / (60 * 1000)} minutes`,
      baseURL: this.baseURL
    };
  }
}

// Export singleton instance
export const polymarketService = new PolymarketService();
export default polymarketService;
