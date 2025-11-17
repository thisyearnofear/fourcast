// Polymarket Service for fetching live market data and placing orders
import axios from 'axios';

class PolymarketService {
  constructor() {
    this.baseURL = 'https://gamma-api.polymarket.com';
    this.clobBaseURL = 'https://clob.polymarket.com';
    this.cache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for market data
    this.marketDetailsCache = new Map();
    this.MARKET_DETAILS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for market details
    this.marketCatalogCache = null;
    this.MARKET_CATALOG_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for full catalog
  }

  // Generate cache key for markets (location-based, for backward compatibility)
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

  // Get market catalog from cache
  getCachedCatalog() {
    if (this.marketCatalogCache && Date.now() - this.marketCatalogCache.timestamp < this.MARKET_CATALOG_CACHE_DURATION) {
      return this.marketCatalogCache.data;
    }
    return null;
  }

  // Cache the full market catalog
  setCachedCatalog(markets) {
    this.marketCatalogCache = {
      data: markets,
      timestamp: Date.now()
    };
  }

  /**
   * Fetch all active markets from Polymarket
   * Optionally filter by tags (e.g., "Sports", "Politics")
   * IMPROVED: Uses /events endpoint for full tag metadata
   */
  async getAllMarkets(tags = null) {
    try {
      // Use /events endpoint for full metadata
      const params = {
        limit: 100,
        closed: false
      };

      // If tag filtering requested, use tag_id parameter
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        // tags can be tag IDs or labels - API expects tag_id parameter
        params.tag_id = tagArray[0]; // Use first tag if provided
      }

      const response = await axios.get(`${this.baseURL}/events`, { 
        params,
        timeout: 10000
      });

      // Extract all markets from events
      const events = Array.isArray(response.data) ? response.data : (response.data?.events || []);
      let allMarkets = [];
      
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          allMarkets = allMarkets.concat(
            event.markets.map(m => ({
              ...m,
              eventTags: event.tags || []
            }))
          );
        }
      }

      return allMarkets;
    } catch (error) {
      console.error('Error fetching all markets:', error.message);
      return [];
    }
  }

  /**
   * Search markets by location using optimized /events endpoint
   * IMPROVED: Uses /events endpoint for better structure and performance
   * Returns weather-sensitive markets filtered by volume threshold
   */
  async searchMarketsByLocation(location) {
    // Check cache first
    const cached = this.getCachedMarkets(location);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      // Use /events endpoint for better market structure
      const response = await axios.get(`${this.baseURL}/events`, {
        params: {
          limit: 100,
          closed: false, // Active only
          offset: 0
        },
        timeout: 10000
      });

      let relevantMarkets = [];

      // Handle both array and object response formats
      const events = Array.isArray(response.data) ? response.data : (response.data?.events || []);
      
      if (events && Array.isArray(events)) {
        // Find events matching the location
        for (const event of events) {
          const eventTitle = event.title || '';
          const eventLoc = this.extractLocation(eventTitle);

          // Match location (case-insensitive)
          if (eventLoc && eventLoc.toLowerCase() === location.toLowerCase()) {
            // Add all markets from this event with event tags for metadata
            if (event.markets && Array.isArray(event.markets)) {
              relevantMarkets.push(...event.markets.map(m => ({
                ...m,
                eventTags: event.tags || [] // Include event tags for proper metadata extraction
              })));
            }
          }
        }
      }

      // Filter by minimum volume ($50k) - ROADMAP requirement
      const highVolume = relevantMarkets.filter(m => {
        const vol = parseFloat(m.volume24h || m.volume || 0);
        return vol >= 50000;
      });

      const result = {
        markets: highVolume.slice(0, 20), // Top 20 relevant markets
        location,
        timestamp: new Date().toISOString(),
        totalFound: highVolume.length,
        cached: false,
        source: 'events_endpoint' // Track which method was used
      };

      // Cache the results (6 hours for distant events, handled by caller)
      this.setCachedMarkets(location, result);

      return result;
    } catch (error) {
      console.error('Error searching markets by location:', error.message);
      return {
        markets: [],
        location,
        error: error.message,
        timestamp: new Date().toISOString(),
        cached: false
      };
    }
  }

  /**
   * Get detailed market information including current odds, tick size, negRisk
   * CRITICAL for order placement - needed for validation
   */
  async getMarketDetails(marketID) {
    try {
      // Check cache first
      const cached = this.marketDetailsCache.get(marketID);
      if (cached && Date.now() - cached.timestamp < this.MARKET_DETAILS_CACHE_DURATION) {
        return cached.data;
      }

      const response = await axios.get(`${this.baseURL}/markets/${marketID}`, { timeout: 10000 });
      const marketData = response.data;

      // Enrich with trading metadata needed for orders
      const enrichedData = {
        ...marketData,
        tradingMetadata: {
          tickSize: marketData.tickSize || '0.001',
          negRisk: marketData.negRisk || false,
          chainId: 137 // Polygon
        }
      };

      // Cache it
      this.marketDetailsCache.set(marketID, {
        data: enrichedData,
        timestamp: Date.now()
      });

      return enrichedData;
    } catch (error) {
      console.error(`Error fetching market details for ${marketID}:`, error.message);
      return null;
    }
  }

  /**
   * Phase 1: Build liquidity-first market catalog
   * Fetches all active markets and indexes by:
   * - Market ID, title, description
   * - Extracted location + event metadata
   * - Current odds + volume + liquidity
   * - Temporal metadata (resolution date)
   * ROADMAP: Foundation for Phase 2 & 3 (weather scoring & edge detection)
   * IMPROVED: Now uses /events endpoint to get full tag metadata
   */
  async buildMarketCatalog(minVolume = 50000) {
    // Check cache first
    const cached = this.getCachedCatalog();
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      // Fetch events with full metadata (single page - 100 events should give 200+ markets)
      // Catalog is cached for 30min, so we can be conservative to reduce API load
      let allMarkets = [];
      
      try {
        const response = await axios.get(`${this.baseURL}/events`, {
          params: { limit: 100, offset: 0, closed: false },
          timeout: 10000
        });

        if (response.data && Array.isArray(response.data)) {
          // Extract markets from events (each event can have multiple markets)
          const events = response.data;
          for (const event of events) {
            if (event.markets && Array.isArray(event.markets)) {
              allMarkets = allMarkets.concat(
                event.markets.map(m => ({
                  ...m,
                  eventTags: event.tags || [] // Include event tags for metadata extraction
                }))
              );
            }
          }
        }
      } catch (fetchError) {
        console.warn(`Error fetching events:`, fetchError.message);
        // Continue with empty allMarkets - will be caught in caller
      }

      // Index and enrich with metadata (WITHOUT order book - defer that for final results)
      const baseCatalog = allMarkets
        .filter(m => {
          const vol = parseFloat(m.volume24h || m.volume || 0);
          return vol >= minVolume;
        });

      // First pass: Build catalog with fallback enrichment only (no order book API calls)
      const baseEnrichedMarkets = baseCatalog.map((market) => {
        const title = market.title || market.question || '';
        // Use eventTags (from parent event) for more reliable detection
        const tags = market.eventTags || market.tags || [];
        const metadata = this.extractMarketMetadata(title, tags);

        // Use available data only - no order book API calls yet
        const enrichedData = this.enrichMarketWithAvailableData(market);

        return {
          marketID: market.tokenID || market.id,
          title,
          description: market.description,
          location: metadata.location,
          teams: metadata.teams,
          eventType: metadata.event_type,
          currentOdds: {
            yes: parseFloat(market.outcomePrices?.[0] || enrichedData.orderBook?.bestAsk || 0.5),
            no: parseFloat(market.outcomePrices?.[1] || enrichedData.orderBook?.bestBid || 0.5)
          },
          volume24h: enrichedData.volumeMetrics?.vol24h || parseFloat(market.volume24h || market.volume || 0),
          liquidity: enrichedData.marketEfficiency?.liquidityScore || parseFloat(market.liquidity || 0),
          tags: tags,
          resolutionDate: market.endDate || market.expiresAt,

          // New enriched data for richer UI
          orderBookMetrics: enrichedData.orderBook,
          volumeMetrics: enrichedData.volumeMetrics,
          marketEfficiency: enrichedData.marketEfficiency,
          enrichmentSource: enrichedData.enrichmentSource,
          enriched: enrichedData.enriched,

          // Enhanced odds with spread analysis
          oddsAnalysis: {
            bestBid: enrichedData.orderBook?.bestBid,
            bestAsk: enrichedData.orderBook?.bestAsk,
            spread: enrichedData.orderBook?.spread,
            spreadPercent: enrichedData.orderBook?.spreadPercent,
            midPrice: enrichedData.orderBook?.bestBid && enrichedData.orderBook?.bestAsk ?
              (enrichedData.orderBook.bestBid + enrichedData.orderBook.bestAsk) / 2 : null,
            marketDepth: this.calculateDepthImpact(enrichedData.orderBook)
          },

          rawMarket: market // Keep original for reference
        };
        });

        // Sort by volume (no second pass - let getTopWeatherSensitiveMarkets handle order book enrichment)
        baseEnrichedMarkets.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
        const catalog = baseEnrichedMarkets;

      const result = {
        markets: catalog,
        totalMarkets: catalog.length,
        minVolume,
        timestamp: new Date().toISOString(),
        cached: false
      };

      // Cache the catalog
      this.setCachedCatalog(result);

      return result;
    } catch (error) {
      console.error('Error building market catalog:', error.message);
      return {
        markets: [],
        totalMarkets: 0,
        error: error.message,
        timestamp: new Date().toISOString(),
        cached: false
      };
    }
  }

  /**
   * Phase 2: Assess market weather edge potential
   * Scores markets by 4 relevance factors:
   * 1. weatherDirect: Market explicitly about weather
   * 2. weatherSensitiveEvent: Outdoor events affected by weather (sports, etc)
   * 3. contextualWeatherImpact: Event location weather vs market odds relationship
   * 4. asymmetrySignal: Information asymmetry detection (odds don't reflect weather clarity)
   * ROADMAP: Used by getTopWeatherSensitiveMarkets() for ranking
   */
  assessMarketWeatherEdge(market, weatherData = null) {
    const title = (market.title || '').toLowerCase();
    const description = (market.description || '').toLowerCase();
    const tags = (market.tags || []).map(t => {
      if (typeof t === 'string') return t.toLowerCase();
      if (typeof t === 'object' && t.label) return t.label.toLowerCase();
      return '';
    }).join(' ');

    // Current weather conditions (if available)
    const currentTemp = weatherData?.current?.temp_f;
    const currentCondition = (weatherData?.current?.condition?.text || '').toLowerCase();
    const precipChance = weatherData?.current?.precip_chance || weatherData?.current?.precip_prob || 0;
    const windSpeed = weatherData?.current?.wind_mph;
    const humidity = weatherData?.current?.humidity;

    // Factor 1: Weather-Direct (market explicitly about weather)
    let weatherDirect = 0;
    if (title.includes('weather') || title.includes('temperature') || 
        title.includes('rain') || title.includes('snow') || title.includes('wind')) {
      weatherDirect = 3;
    }

    // Factor 2: Weather-Sensitive Events (outdoor events, sports)
    let weatherSensitiveEvent = 0;
    const sportEvents = ['nfl', 'nba', 'mlb', 'golf', 'tennis', 'cricket', 'soccer', 'rugby'];
    const isSportEvent = sportEvents.some(sport => title.includes(sport) || tags.includes(sport));
    const isOutdoorEvent = title.includes('marathon') || title.includes('race') || isSportEvent;
    
    if (isOutdoorEvent) {
      weatherSensitiveEvent = 2;
    }

    // Factor 3: Contextual Weather Impact
    let contextualWeatherImpact = 0;
    if (isOutdoorEvent && weatherData?.current) {
      // Award points if weather conditions match event keywords
      if ((windSpeed && windSpeed > 15) && (title.includes('wind') || title.includes('sail'))) {
        contextualWeatherImpact += 1.5;
      }
      if ((precipChance && precipChance > 30) && (title.includes('rain') || title.includes('snow'))) {
        contextualWeatherImpact += 1.5;
      }
      if ((currentTemp && (currentTemp < 45 || currentTemp > 85)) && 
          (title.includes('cold') || title.includes('heat') || title.includes('temperature'))) {
        contextualWeatherImpact += 1;
      }
      if ((humidity && humidity > 70) && (title.includes('humidity') || title.includes('moisture'))) {
        contextualWeatherImpact += 0.5;
      }
    }

    // Factor 4: Asymmetry Signal (detect potential market inefficiencies)
    // NEW: Enhanced with order book and volume trend data from enriched markets
    let asymmetrySignal = 0;
    const volume = market.volume24h || market.volumeMetrics?.vol24h || 0;
    const liquidity = market.liquidity || market.marketEfficiency?.liquidityScore || 0;
    const volumeTrend = market.volumeMetrics?.volumeTrend || 0;
    const spreadPercent = market.oddsAnalysis?.spreadPercent || market.orderBookMetrics?.spreadPercent || 0;

    // Volume to liquidity ratio (higher = more potential inefficiency)
    if (volume > 0 && liquidity > 0) {
      const volumeLiquidityRatio = volume / liquidity;
      if (volumeLiquidityRatio > 2) asymmetrySignal += 1;
      if (volumeLiquidityRatio > 5) asymmetrySignal += 0.5; // Bonus for very high ratio
    }

    // Sudden volume increase (potential information asymmetry)
    if (volumeTrend > 50) { // Volume 50% above weekly average
      asymmetrySignal += 1.5;
    } else if (volumeTrend > 25) {
      asymmetrySignal += 1;
    }

    // Wide spreads indicate low efficiency
    if (spreadPercent > 2) { // Spread > 2%
      asymmetrySignal += 0.5;
    } else if (spreadPercent > 5) {
      asymmetrySignal += 1;
    }

    // Large price movements without volume (potential manipulation or news)
    const volatilityScore = market.marketEfficiency?.volatilityScore || 0;
    if (volatilityScore > 0.1 && volumeTrend < 10) { // High volatility, low volume change
      asymmetrySignal += 0.5;
    }

    let totalScore = weatherDirect + weatherSensitiveEvent + contextualWeatherImpact;
    if (totalScore > 0) {
      // Only apply asymmetry signal if the market is already weather-sensitive
      totalScore += asymmetrySignal;
    }

    return {
      totalScore: Math.min(totalScore, 10),
      factors: {
        weatherDirect,
        weatherSensitiveEvent,
        contextualWeatherImpact,
        asymmetrySignal
      },
      isWeatherSensitive: totalScore > 0,
      confidence: totalScore > 6 ? 'HIGH' : totalScore > 3 ? 'MEDIUM' : 'LOW',
      weatherContext: {
        temp: currentTemp,
        condition: currentCondition,
        precipChance,
        windSpeed,
        humidity,
        hasData: !!(weatherData?.current)
      }
    };
  }

  /**
   * Phase 3: Get top weather-sensitive markets
   * Replaces location-based discovery with edge-ranked results
   * Returns markets sorted by weather edge potential, not geolocation
   * ROADMAP: Primary method for market discovery in new architecture
   */
  async getTopWeatherSensitiveMarkets(limit = 10, filters = {}) {
    try {
      // Get full catalog (without order book enrichment to avoid rate limits)
      const catalogResult = await this.buildMarketCatalog(filters.minVolume || 50000);
      
      if (!catalogResult.markets || catalogResult.markets.length === 0) {
        return {
          markets: [],
          totalFound: 0,
          message: 'No weather-sensitive markets found',
          timestamp: new Date().toISOString()
        };
      }

      // Score each market for weather edge potential
      const scoredMarkets = catalogResult.markets.map(market => {
        const edgeAssessment = this.assessMarketWeatherEdge(market, filters.weatherData);
        return {
          ...market,
          edgeScore: edgeAssessment.totalScore,
          edgeFactors: edgeAssessment.factors,
          confidence: edgeAssessment.confidence,
          weatherContext: edgeAssessment.weatherContext,
          isWeatherSensitive: edgeAssessment.isWeatherSensitive
        };
      });

      // FILTER 1: Only markets with actual weather edge (score > 0)
      let filtered = scoredMarkets.filter(m => m.edgeScore > 0);

      // FILTER 2: Event type if specified (only show markets that match the type)
      if (filters.eventType && filters.eventType !== 'all') {
        filtered = filtered.filter(m => {
          if (filters.eventType === 'Sports') {
            // Handle generic "Sports" category by checking if eventType is any sport
            const sportTypes = ['NFL', 'NBA', 'MLB', 'NHL', 'Golf', 'Tennis', 'Soccer', 'Cricket', 'Rugby', 'Marathon'];
            const matches = sportTypes.includes(m.eventType);
            if (!matches) {
              console.debug(`Filtering out: "${m.title.substring(0, 50)}" (eventType: ${m.eventType} vs filter: Sports)`);
            }
            return matches;
          } else {
            const matches = m.eventType === filters.eventType;
            if (!matches) {
              console.debug(`Filtering out: "${m.title.substring(0, 50)}" (eventType: ${m.eventType} vs filter: ${filters.eventType})`);
            }
            return matches;
          }
        });
        console.log(`Filter by eventType '${filters.eventType}': ${filtered.length} of ${scoredMarkets.length} markets remain`);
      }

      // FILTER 3: Confidence level if specified
      if (filters.confidence && filters.confidence !== 'all') {
        filtered = filtered.filter(m => m.confidence === filters.confidence);
      }

      // FILTER 4: Location if user provided (optional, for personalization)
      if (filters.location) {
        filtered = filtered.filter(m => 
          m.location && m.location.toLowerCase() === filters.location.toLowerCase()
        );
      }

      // Sort by edge score (descending), then by volume (for tiebreaker)
      filtered.sort((a, b) => {
        const scoreDiff = (b.edgeScore || 0) - (a.edgeScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.volume24h || 0) - (a.volume24h || 0);
      });

      // Add variety to results by diversifying across market types and scores
      // This helps users see different opportunities over time
      const VARIETY_THRESHOLD = 0.5; // Markets within this score range can be shuffled

      // First, sort by edge score as before
      filtered.sort((a, b) => {
        const scoreDiff = (b.edgeScore || 0) - (a.edgeScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.volume24h || 0) - (a.volume24h || 0);
      });

      // Add time-based rotation factor to further diversify results
      // Different hours of the day will tend to show different markets with similar scores
      const hourFactor = new Date().getHours(); // 0-23

      // Group markets by similar edge scores to apply variety within score ranges
      const scoreGroups = [];
      if (filtered.length > 0) {
        let currentScore = filtered[0].edgeScore || 0;
        let currentGroup = [filtered[0]];

        for (let i = 1; i < filtered.length; i++) {
          const market = filtered[i];
          const score = market.edgeScore || 0;

          if (Math.abs(score - currentScore) <= VARIETY_THRESHOLD) {
            // Add to current group if scores are similar
            currentGroup.push(market);
          } else {
            // Process the current group
            scoreGroups.push([...currentGroup]);
            currentGroup = [market];
            currentScore = score;
          }
        }
        scoreGroups.push([...currentGroup]); // Add the last group
      }

      // Function to diversify within a group by spreading out market types and using time-based rotation
      const diversifyGroup = (group) => {
        if (group.length <= 3) return group; // No need to diversify small groups

        // Group by event type to ensure variety
        const typeGroups = {};
        for (const market of group) {
          const type = market.eventType || 'Other';
          if (!typeGroups[type]) {
            typeGroups[type] = [];
          }
          typeGroups[type].push(market);
        }

        // Apply time-based rotation within each type group to vary which markets appear
        const rotatedTypeGroups = {};
        for (const [type, markets] of Object.entries(typeGroups)) {
          // Use hour factor to determine starting point for this type
          const offset = hourFactor % Math.max(1, markets.length);
          rotatedTypeGroups[type] = [...markets.slice(offset), ...markets.slice(0, offset)];
        }

        // Create diversified result by taking turns from each type group
        const result = [];
        const typeKeys = Object.keys(rotatedTypeGroups);
        let maxGroupSize = Math.max(...Object.values(rotatedTypeGroups).map(g => g.length));

        for (let i = 0; i < maxGroupSize; i++) {
          for (const type of typeKeys) {
            if (i < rotatedTypeGroups[type].length) {
              result.push(rotatedTypeGroups[type][i]);
            }
          }
        }

        return result;
      };

      // Apply diversification to each score group
      const diversifiedGroups = scoreGroups.map(group => diversifyGroup(group));

      // Flatten the diversified groups back together
      let diversifiedMarkets = [];
      for (const group of diversifiedGroups) {
        diversifiedMarkets.push(...group);
      }

      // Take the top N markets after diversification
      let finalMarkets = diversifiedMarkets.slice(0, limit);
      const enrichedFinal = await Promise.all(
        finalMarkets.map(async (market) => {
          try {
            const orderBookData = await this.enrichMarketWithOrderBook(market.rawMarket);
            return {
              ...market,
              orderBookMetrics: orderBookData.orderBook,
              volumeMetrics: orderBookData.volumeMetrics,
              marketEfficiency: orderBookData.marketEfficiency,
              enrichmentSource: orderBookData.enrichmentSource,
              enriched: orderBookData.enriched,
              oddsAnalysis: {
                bestBid: orderBookData.orderBook?.bestBid,
                bestAsk: orderBookData.orderBook?.bestAsk,
                spread: orderBookData.orderBook?.spread,
                spreadPercent: orderBookData.orderBook?.spreadPercent,
                midPrice: orderBookData.orderBook?.bestBid && orderBookData.orderBook?.bestAsk ?
                  (orderBookData.orderBook.bestBid + orderBookData.orderBook.bestAsk) / 2 : null,
                marketDepth: this.calculateDepthImpact(orderBookData.orderBook)
              }
            };
          } catch (enrichError) {
            console.debug(`Order book enrichment failed for ${market.title}, using fallback:`, enrichError.message);
            return market; // Keep fallback enrichment if order book fails
          }
        })
      );

      return {
        markets: enrichedFinal,
        totalFound: filtered.length,
        timestamp: new Date().toISOString(),
        cached: catalogResult.cached || false
      };
    } catch (error) {
      console.error('Error getting top weather-sensitive markets:', error.message);
      return {
        markets: [],
        totalFound: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
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
   * Extract location information from market title
   */
  extractLocation(marketTitle) {
    if (!marketTitle) return null;

    // Common city names and locations (deduplicated)
    const cityNames = [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 
      'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 
      'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 
      'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Nashville', 
      'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville', 
      'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 
      'Mesa', 'Kansas City', 'Atlanta', 'Long Beach', 'Colorado Springs', 
      'Raleigh', 'Miami', 'Virginia Beach', 'Omaha', 'Oakland', 'Minneapolis', 
      'Tulsa', 'Arlington', 'Tampa', 'New Orleans', 'Wichita', 'Cleveland', 
      'Bakersfield', 'Aurora', 'Anaheim', 'Honolulu', 'Santa Ana', 'Riverside', 
      'Corpus Christi', 'Lexington', 'Stockton', 'St. Louis', 'Saint Paul', 
      'Henderson', 'Pittsburgh', 'Cincinnati', 'Anchorage', 'Greensboro', 
      'Plano', 'Newark', 'Lincoln', 'Orlando', 'Irvine', 'Toledo', 'Jersey City', 
      'Chula Vista', 'Durham', 'Fort Wayne', 'St. Petersburg', 'Laredo', 
      'Buffalo', 'Madison', 'Lubbock', 'Chandler', 'Scottsdale', 'Reno', 
      'Glendale', 'Gilbert', 'Winston-Salem', 'North Las Vegas', 'Norfolk', 
      'Chesapeake', 'Garland', 'Irving', 'Hialeah', 'Fremont', 'Boise', 
      'Richmond', 'Baton Rouge', 'Des Moines', 'Spokane', 'Modesto', 'Fayetteville', 
      'Tacoma', 'Oxnard', 'Fontana', 'Montgomery', 'Moreno Valley', 
      'Shreveport', 'Yonkers', 'Akron', 'Huntington Beach', 'Little Rock', 
      'Augusta', 'Amarillo', 'Mobile', 'Grand Rapids', 'Salt Lake City', 
      'Tallahassee', 'Huntsville', 'Grand Prairie', 'Knoxville', 'Worcester', 
      'Newport News', 'Brownsville', 'Overland Park', 'Santa Clarita', 'Providence', 
      'Garden Grove', 'Chattanooga', 'Oceanside', 'Jackson', 'Fort Lauderdale', 
      'Santa Rosa', 'Port St. Lucie', 'Ontario', 'Vancouver', 'Tempe', 'Springfield', 
      'Lancaster', 'Eugene', 'Pembroke Pines', 'Salem', 'Cape Coral', 'Peoria', 
      'Sioux Falls', 'Elk Grove', 'Rockford', 'Palmdale', 'Corona', 
      'Salinas', 'Pomona', 'Pasadena', 'Joliet', 'Paterson', 
      'Torrance', 'Syracuse', 'Bridgeport', 'Hayward', 'Fort Collins', 'Escondido', 
      'Lakewood', 'Naperville', 'Dayton', 'Hollywood', 'Sunnyvale', 'Alexandria', 
      'Mesquite', 'Hampton', 'Orange', 'Savannah', 'Cary', 'Fullerton', 
      'Warren', 'Clarksville', 'McKinney', 'McAllen', 'New Haven', 'Sterling Heights', 
      'West Valley City', 'Columbia', 'Killeen', 'Topeka', 'Thousand Oaks', 
      'Cedar Rapids', 'Olathe', 'Elizabeth', 'Waco', 'Hartford', 'Visalia', 
      'Gainesville', 'Simi Valley', 'Stamford', 'Bellevue', 'Concord', 'Miramar', 
      'Coral Springs', 'Lafayette', 'Charleston', 'Carrollton', 'Roseville', 
      'Thornton', 'Beaumont', 'Allentown', 'Surprise', 'Evansville', 'Abilene', 
      'Frisco', 'Independence', 'Santa Clara', 'Vallejo', 'Victorville', 
      'Athens', 'Lansing', 'Ann Arbor', 'El Monte', 'Denton', 'Berkeley', 
      'Provo', 'Downey', 'Midland', 'Norman', 'Waterbury', 'Costa Mesa', 'Inglewood', 
      'Manchester', 'Murfreesboro', 'Elgin', 'Clearwater', 'Miami Gardens', 
      'Rochester', 'Pueblo', 'Lowell', 'Wilmington', 'Arvada', 'San Buenaventura', 
      'Westminster', 'West Covina', 'Gresham', 'Fargo', 'Norwalk', 'Carlsbad', 
      'Fairfield', 'Cambridge', 'Wichita Falls', 'High Point', 'Billings', 
      'Green Bay', 'Tyler', 'San Mateo', 'Lewisville', 'Davie', 'League City', 
      'Rialto', 'Yakima', 'Broken Arrow', 'Round Rock', 'West Palm Beach', 
      'Burbank', 'Arden-Arcade', 'Allen', 'El Cajon', 'Las Cruces', 
      'Renton', 'Daly City', 'Sparks', 'Nampa', 'South Bend', 
      'Dearborn', 'Livonia', 'Tuscaloosa', 'Vacaville', 'Brockton', 
      'Roswell', 'Beaverton', 'Quincy', 'Lawrence', 'Clovis', 
      'Macon', 'Santa Maria', 'Kenosha', 'Bellingham', 'Sandy Springs', 
      'Gary', 'Bend', 'Meridian', 'Mission Viejo', 'Longmont', 
      'Farmington Hills', 'Boulder', 'San Luis Obispo', 'Schaumburg', 'Kingsport', 
      'Lynn', 'Redding', 'New Bedford', 'Chico', 'Camden', 'South Gate', 
      'San Angelo', 'Portsmouth', 'Temecula', 'Carmel', 'Bloomington', 
      'Warner Robins', 'Somerville', 'Janesville', 'Champaign', 
      'Alhambra', 'Chino', 'Davis', 'Redwood City', 'Nashua', 'Bethlehem', 
      'Lakeland', 'Reading', 'Antioch', 'Hawthorne', 
      'Whittier', 'Greeley', 'Citrus Heights', 'Petaluma', 
      'Flint', 'Waukegan', 'Merced', 
      'Kalamazoo', 'Cranston', 'Parma', 
      'Gilroy', 'Pasco', 'Pompano Beach', 
      'St. Clair Shores', 'Rockville', 'Trenton', 'Compton', 'Bossier City', 
      'Dearborn Heights', 'Lawton', 'Vineland', 'Suffolk', 'Waukesha', 
      'Mount Pleasant', 'Berwyn', 'Bowie', 'Evanston', 'Cypress', 
      'Coeur d\'Alene', 'Seaside', 'Hillsboro', 'North Lauderdale', 'Mishawaka', 
      'Silver Spring', 'Dale City', 'Sherman', 'Kendall', 'Orem', 
      'Boca Raton', 'Lynnwood', 'Southfield', 'New Britain', 
      'Chino Hills', 'Redlands', 
      'Decatur', 'Hammond', 'Haverhill', 'Plantation', 'San Leandro', 'Rocky Mount', 
      'Wheaton', 'Glen Burnie', 'Fort Smith', 'Bayonne', 'Kokomo', 
      'Lees Summit', 'Harlingen', 'Dubuque', 'Casper', 'Scranton', 'Pine Hills', 
      'Livermore', 'Plymouth', 'Riverton', 'Kirkland', 'Owensboro', 
      'Johns Creek', 'Beloit', 
      'Union City', 'Annandale', 
      'Ellicott City', 'Apple Valley', 'Largo', 'Wyoming', 'Redmond', 'Yuba City', 
      'Baldwin Park', 'West Des Moines', 'Greenwood', 'Gastonia', 'San Ramon', 
      'Cheyenne', 'New Braunfels', 'Medford', 'Port Arthur', 
      'St. Charles', 'Rancho Cordova', 'St. Cloud', 'Carson', 
      'Yorba Linda', 'Palm Bay', 'Cupertino', 'Cathedral City', 
      'Bentonville', 'Albany', 'Sammamish', 'Pleasanton', 'Benton Harbor', 
      'Florence', 'Fall River', 'Cicero', 'Palm Coast', 'Avondale', 
      'Glenview', 'Marietta', 'Homestead', 'Troy', 'Farmers Branch', 
      'Spring Hill', 'Casas Adobes', 'Temple', 'Keller', 'Grand Junction', 
      'West Allis', 'Waltham', 'Pawtucket', 'Pico Rivera', 
      'West Sacramento', 'North Charleston', 'Bismarck', 'Blaine', 
      'Longview', 'Caldwell', 'Cedar Park', 'Corvallis', 
      'The Woodlands', 'League City', 
      'Buena Park', 'Mission', 'Prescott Valley', 'Terre Haute', 
      'Hoboken', 'Palm Beach Gardens', 
      'Brooklyn Park', 'Richland', 
      'Fishers', 
      'Manteca', 'Bolingbrook', 'Lehi', 'Beavercreek', 'El Dorado Hills', 
      'Pearland', 'Lynwood', 'Mountain View', 
      'Norwalk', 'Rancho Cucamonga', 'St. Peters', 'Milpitas', 
      'Franklin', 'Kennewick', 'Biloxi', 'Newton', 
      'San Bruno', 'Greenville', 'Wausau', 'Westfield', 
      'Hendersonville', 'Perris', 'Rocklin', 'Goodyear', 'Doral', 
      'Brentwood', 
      'Watsonville', 'Palm Desert', 'West Haven', 
      'Lawrence', 'Edinburg', 
      'Minnetonka', 
      'Flagstaff', 'Euless', 'North Miami', 'Eden Prairie', 'Grand Forks', 
      'Sandusky', 'Fond du Lac', 'Colonial Heights', 'Everett', 
      'East Lansing', 'Bristol', 
      'Hazleton', 'East Providence', 
      'Manhattan', 
      'Miami Beach', 'Coon Rapids', 
      'Lakeville', 'Bowling Green', 
      'Rapid City', 
      'Buffalo Grove', 
      'Winter Haven', 'Middletown', 
      'Weymouth', 
      'Grand Island', 
      'Carbondale', 
      'Cleveland Heights', 
      'Stillwater'
    ];

    // Check for city names in the market title
    for (const city of cityNames) {
      if (marketTitle.toLowerCase().includes(city.toLowerCase())) {
        return city;
      }
    }

    // Check for state names as fallback
    const stateNames = [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 
      'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 
      'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 
      'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 
      'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 
      'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
      'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 
      'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 
      'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
    ];

    for (const state of stateNames) {
      if (marketTitle.toLowerCase().includes(state.toLowerCase())) {
        return state;
      }
    }

    return null;
  }

  /**
   * Extract detailed metadata from market title including teams and venues
   */
  extractMarketMetadata(marketTitle, tags = []) {
    if (!marketTitle) return {};

    const metadata = {
      location: this.extractLocation(marketTitle),
      teams: [],
      event_type: null,
      venue: null
    };
    
    // Check tags first (more reliable) - handle both string and object tags
    const tagLabels = (tags || []).map(t => {
      if (typeof t === 'string') return t.toLowerCase();
      if (typeof t === 'object' && t.label) return t.label.toLowerCase();
      return '';
    }).join(' ');

    // Only use tag-based detection if it's clearly a sports/weather tag that's not generic
    // Avoid using generic tags that might be misleading
    if (tagLabels.includes('nfl') && marketTitle.toLowerCase().includes('nfl')) {
      metadata.event_type = 'NFL';
    } else if (tagLabels.includes('nba') && marketTitle.toLowerCase().includes('nba')) {
      metadata.event_type = 'NBA';
    } else if (tagLabels.includes('mlb') && marketTitle.toLowerCase().includes('mlb')) {
      metadata.event_type = 'MLB';
    } else if (tagLabels.includes('nhl') && marketTitle.toLowerCase().includes('nhl')) {
      metadata.event_type = 'NHL';
    } else if (tagLabels.includes('weather')) {
      metadata.event_type = 'Weather';
    }

    // Common sports teams
    const teamPatterns = [
      // NFL Teams
      { pattern: /bills|buffalo bills/i, team: 'Buffalo Bills', sport: 'NFL' },
      { pattern: /dolphins|miami dolphins/i, team: 'Miami Dolphins', sport: 'NFL' },
      { pattern: /patriots|new england patriots/i, team: 'New England Patriots', sport: 'NFL' },
      { pattern: /jets|new york jets/i, team: 'New York Jets', sport: 'NFL' },
      { pattern: /ravens|baltimore ravens/i, team: 'Baltimore Ravens', sport: 'NFL' },
      { pattern: /bengals|cincinnati bengals/i, team: 'Cincinnati Bengals', sport: 'NFL' },
      { pattern: /browns|cleveland browns/i, team: 'Cleveland Browns', sport: 'NFL' },
      { pattern: /steelers|pittsburgh steelers/i, team: 'Pittsburgh Steelers', sport: 'NFL' },
      { pattern: /texans|houston texans/i, team: 'Houston Texans', sport: 'NFL' },
      { pattern: /colts|indianapolis colts/i, team: 'Indianapolis Colts', sport: 'NFL' },
      { pattern: /jaguars|jacksonville jaguars/i, team: 'Jacksonville Jaguars', sport: 'NFL' },
      { pattern: /titans|tennessee titans/i, team: 'Tennessee Titans', sport: 'NFL' },
      { pattern: /broncos|denver broncos/i, team: 'Denver Broncos', sport: 'NFL' },
      { pattern: /chiefs|kansas city chiefs/i, team: 'Kansas City Chiefs', sport: 'NFL' },
      { pattern: /raiders|las vegas raiders/i, team: 'Las Vegas Raiders', sport: 'NFL' },
      { pattern: /chargers|los angeles chargers/i, team: 'Los Angeles Chargers', sport: 'NFL' },
      { pattern: /cowboys|dallas cowboys/i, team: 'Dallas Cowboys', sport: 'NFL' },
      { pattern: /giants|new york giants/i, team: 'New York Giants', sport: 'NFL' },
      { pattern: /eagles|philadelphia eagles/i, team: 'Philadelphia Eagles', sport: 'NFL' },
      { pattern: /washington|washington commanders/i, team: 'Washington Commanders', sport: 'NFL' },
      { pattern: /bears|chicago bears/i, team: 'Chicago Bears', sport: 'NFL' },
      { pattern: /lions|detroit lions/i, team: 'Detroit Lions', sport: 'NFL' },
      { pattern: /packers|green bay packers/i, team: 'Green Bay Packers', sport: 'NFL' },
      { pattern: /vikings|minnesota vikings/i, team: 'Minnesota Vikings', sport: 'NFL' },
      { pattern: /falcons|atlanta falcons/i, team: 'Atlanta Falcons', sport: 'NFL' },
      { pattern: /panthers|carolina panthers/i, team: 'Carolina Panthers', sport: 'NFL' },
      { pattern: /saints|new orleans saints/i, team: 'New Orleans Saints', sport: 'NFL' },
      { pattern: /buccaneers|tampa bay buccaneers/i, team: 'Tampa Bay Buccaneers', sport: 'NFL' },
      { pattern: /cardinals|arizona cardinals/i, team: 'Arizona Cardinals', sport: 'NFL' },
      { pattern: /rams|los angeles rams/i, team: 'Los Angeles Rams', sport: 'NFL' },
      { pattern: /49ers|san francisco 49ers/i, team: 'San Francisco 49ers', sport: 'NFL' },
      { pattern: /seahawks|seattle seahawks/i, team: 'Seattle Seahawks', sport: 'NFL' },

      // NBA Teams
      { pattern: /celtics|boston celtics/i, team: 'Boston Celtics', sport: 'NBA' },
      { pattern: /nets|brooklyn nets/i, team: 'Brooklyn Nets', sport: 'NBA' },
      { pattern: /knicks|new york knicks/i, team: 'New York Knicks', sport: 'NBA' },
      { pattern: /76ers|philadelphia 76ers/i, team: 'Philadelphia 76ers', sport: 'NBA' },
      { pattern: /raptors|toronto raptors/i, team: 'Toronto Raptors', sport: 'NBA' },
      { pattern: /bulls|chicago bulls/i, team: 'Chicago Bulls', sport: 'NBA' },
      { pattern: /cavaliers|cleveland cavaliers/i, team: 'Cleveland Cavaliers', sport: 'NBA' },
      { pattern: /pistons|detroit pistons/i, team: 'Detroit Pistons', sport: 'NBA' },
      { pattern: /pacers|indiana pacers/i, team: 'Indiana Pacers', sport: 'NBA' },
      { pattern: /bucks|milwaukee bucks/i, team: 'Milwaukee Bucks', sport: 'NBA' },
      { pattern: /hawks|atlanta hawks/i, team: 'Atlanta Hawks', sport: 'NBA' },
      { pattern: /hornets|charlotte hornets/i, team: 'Charlotte Hornets', sport: 'NBA' },
      { pattern: /heat|miami heat/i, team: 'Miami Heat', sport: 'NBA' },
      { pattern: /magic|orlando magic/i, team: 'Orlando Magic', sport: 'NBA' },
      { pattern: /wizards|washington wizards/i, team: 'Washington Wizards', sport: 'NBA' },
      { pattern: /nuggets|denver nuggets/i, team: 'Denver Nuggets', sport: 'NBA' },
      { pattern: /timberwolves|minnesota timberwolves/i, team: 'Minnesota Timberwolves', sport: 'NBA' },
      { pattern: /thunder|oklahoma city thunder/i, team: 'Oklahoma City Thunder', sport: 'NBA' },
      { pattern: /blazers|portland trail blazers/i, team: 'Portland Trail Blazers', sport: 'NBA' },
      { pattern: /jazz|utah jazz/i, team: 'Utah Jazz', sport: 'NBA' },
      { pattern: /warriors|golden state warriors/i, team: 'Golden State Warriors', sport: 'NBA' },
      { pattern: /clippers|los angeles clippers/i, team: 'Los Angeles Clippers', sport: 'NBA' },
      { pattern: /lakers|los angeles lakers/i, team: 'Los Angeles Lakers', sport: 'NBA' },
      { pattern: /suns|phoenix suns/i, team: 'Phoenix Suns', sport: 'NBA' },
      { pattern: /kings|sacramento kings/i, team: 'Sacramento Kings', sport: 'NBA' },
      { pattern: /mavericks|dallas mavericks/i, team: 'Dallas Mavericks', sport: 'NBA' },
      { pattern: /rockets|houston rockets/i, team: 'Houston Rockets', sport: 'NBA' },
      { pattern: /grizzlies|memphis grizzlies/i, team: 'Memphis Grizzlies', sport: 'NBA' },
      { pattern: /pelicans|new orleans pelicans/i, team: 'New Orleans Pelicans', sport: 'NBA' },
      { pattern: /spurs|san antonio spurs/i, team: 'San Antonio Spurs', sport: 'NBA' },

      // MLB Teams
      { pattern: /diamondbacks|arizona diamondbacks/i, team: 'Arizona Diamondbacks', sport: 'MLB' },
      { pattern: /braves|atlanta braves/i, team: 'Atlanta Braves', sport: 'MLB' },
      { pattern: /orioles|baltimore orioles/i, team: 'Baltimore Orioles', sport: 'MLB' },
      { pattern: /red sox|boston red sox/i, team: 'Boston Red Sox', sport: 'MLB' },
      { pattern: /cubs|chicago cubs/i, team: 'Chicago Cubs', sport: 'MLB' },
      { pattern: /white sox|chicago white sox/i, team: 'Chicago White Sox', sport: 'MLB' },
      { pattern: /reds|cincinnati reds/i, team: 'Cincinnati Reds', sport: 'MLB' },
      { pattern: /indians|cleveland indians|guardians|cleveland guardians/i, team: 'Cleveland Guardians', sport: 'MLB' },
      { pattern: /rockies|colorado rockies/i, team: 'Colorado Rockies', sport: 'MLB' },
      { pattern: /tigers|detroit tigers/i, team: 'Detroit Tigers', sport: 'MLB' },
      { pattern: /astros|houston astros/i, team: 'Houston Astros', sport: 'MLB' },
      { pattern: /royals|kansas city royals/i, team: 'Kansas City Royals', sport: 'MLB' },
      { pattern: /angels|los angeles angels/i, team: 'Los Angeles Angels', sport: 'MLB' },
      { pattern: /dodgers|los angeles dodgers/i, team: 'Los Angeles Dodgers', sport: 'MLB' },
      { pattern: /marlins|miami marlins/i, team: 'Miami Marlins', sport: 'MLB' },
      { pattern: /brewers|milwaukee brewers/i, team: 'Milwaukee Brewers', sport: 'MLB' },
      { pattern: /twins|minnesota twins/i, team: 'Minnesota Twins', sport: 'MLB' },
      { pattern: /mets|new york mets/i, team: 'New York Mets', sport: 'MLB' },
      { pattern: /yankees|new york yankees/i, team: 'New York Yankees', sport: 'MLB' },
      { pattern: /athletics|oakland athletics/i, team: 'Oakland Athletics', sport: 'MLB' },
      { pattern: /phillies|philadelphia phillies/i, team: 'Philadelphia Phillies', sport: 'MLB' },
      { pattern: /pirates|pittsburgh pirates/i, team: 'Pittsburgh Pirates', sport: 'MLB' },
      { pattern: /padres|san diego padres/i, team: 'San Diego Padres', sport: 'MLB' },
      { pattern: /giants|san francisco giants/i, team: 'San Francisco Giants', sport: 'MLB' },
      { pattern: /mariners|seattle mariners/i, team: 'Seattle Mariners', sport: 'MLB' },
      { pattern: /cardinals|st louis cardinals/i, team: 'St. Louis Cardinals', sport: 'MLB' },
      { pattern: /rays|tampa bay rays/i, team: 'Tampa Bay Rays', sport: 'MLB' },
      { pattern: /rangers|texas rangers/i, team: 'Texas Rangers', sport: 'MLB' },
      { pattern: /blue jays|toronto blue jays/i, team: 'Toronto Blue Jays', sport: 'MLB' },
      { pattern: /nationals|washington nationals/i, team: 'Washington Nationals', sport: 'MLB' }
    ];

    // Extract teams
    for (const { pattern, team, sport } of teamPatterns) {
      if (pattern.test(marketTitle)) {
        metadata.teams.push({ name: team, sport });
      }
    }

    // Determine event type based on teams or keywords
    if (metadata.teams.length > 0) {
      metadata.event_type = metadata.teams[0].sport;
    } else if (/\bnfl\b|football(?!\s*market|\s*stock|\s*coin|\s*currency)/i.test(marketTitle)) {
      metadata.event_type = 'NFL';
    } else if (/\bnba\b|basketball(?!\s*coin|\s*market)/i.test(marketTitle)) {
      metadata.event_type = 'NBA';
    } else if (/\bmlb\b|baseball(?!\s*coin|\s*market)/i.test(marketTitle)) {
      metadata.event_type = 'MLB';
    } else if (/\bnhl\b|hockey(?!\s*coin|\s*market)/i.test(marketTitle)) {
      metadata.event_type = 'NHL';
    } else if (/marathon|race(?!\s*car|\s*horse)/i.test(marketTitle)) {
      metadata.event_type = 'Marathon';
    } else if (/golf|pga/i.test(marketTitle)) {
      metadata.event_type = 'Golf';
    } else if (/(tennis|wimbledon|\bopen\b)/i.test(marketTitle) &&
               /(tournament|championship|atp|wta|grand slam|us open|french open|wimbledon|australian open)/i.test(marketTitle)) {
      metadata.event_type = 'Tennis';
    } else if (/(soccer|football)/i.test(marketTitle) &&
               !(marketTitle.toLowerCase().includes('american football'))) {
      metadata.event_type = 'Soccer';
    }

    return metadata;
  }

  /**
   * Assess how relevant weather is to a given market
   * IMPROVED: Now uses actual weather conditions from weatherData parameter
   * Returns both relevance score and weather context for analysis
   */
  assessWeatherRelevance(market, weatherData) {
    const title = (market.title || market.question || '').toLowerCase();
    const description = (market.description || '').toLowerCase();

    // Extract actual weather conditions if available
    const currentTemp = weatherData?.current?.temp_f;
    const currentCondition = (weatherData?.current?.condition?.text || '').toLowerCase();
    const precipChance = weatherData?.current?.precip_chance || weatherData?.current?.precip_prob || 0;
    const windSpeed = weatherData?.current?.wind_mph;
    const humidity = weatherData?.current?.humidity;

    // Score based on both market keywords AND actual weather conditions
    const weatherImpactFactors = {
      outdoor: (title.includes('outdoor') || title.includes('marathon')) ? 2 : 0,
      wind: (
        title.includes('wind') || 
        title.includes('sail') || 
        (windSpeed && windSpeed > 15)
      ) ? 2 : 0,
      precipitation: (
        title.includes('rain') || 
        title.includes('snow') || 
        (precipChance && precipChance > 30) ||
        currentCondition.includes('rain') ||
        currentCondition.includes('snow')
      ) ? 2 : 0,
      temperature: (
        title.includes('temperature') || 
        title.includes('cold') || 
        title.includes('heat') ||
        (currentTemp && (currentTemp < 45 || currentTemp > 85))
      ) ? 1.5 : 0,
      sports: ['nfl', 'nba', 'golf', 'tennis', 'baseball', 'soccer', 'cricket'].some(
        sport => title.includes(sport)
      ) ? 1 : 0,
      weather_word: title.includes('weather') ? 3 : 0,
      // New: Factor for when weather conditions match market keywords
      condition_match: (
        (precipChance && precipChance > 30) && (title.includes('rain') || title.includes('snow')) ? 1 : 0
      )
    };

    const score = Object.values(weatherImpactFactors).reduce((a, b) => a + b, 0);

    return {
      score: Math.min(score, 10),
      factors: weatherImpactFactors,
      isWeatherSensitive: score > 0,
      // Include weather context for AI analysis (new in roadmap Phase 2)
      weatherContext: {
        temp: currentTemp,
        condition: currentCondition,
        precipChance: precipChance,
        windSpeed: windSpeed,
        humidity: humidity,
        hasData: !!(weatherData?.current)
      }
    };
  }

  normalizeTags(tags) {
    const arr = Array.isArray(tags) ? tags : [];
    return arr.map(t => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t === 'object' && t.label) return String(t.label).toLowerCase();
      return '';
    }).filter(Boolean);
  }

  filterByWeatherTheme(markets, theme) {
    const th = (theme || 'all').toLowerCase();
    if (th === 'all') return markets;
    const sportKeywords = ['nfl','nba','mlb','soccer','tennis','golf','cricket','rugby','marathon','race'];
    const outdoorKeywords = ['marathon','race','festival','concert','outdoor'];
    const aviationKeywords = ['flight','airport','delay','storm','airline'];
    const energyKeywords = ['grid','power','electricity','oil','gas','energy','utility'];
    const agricultureKeywords = ['harvest','crop','yield','agriculture','wheat','corn','soy'];
    const weatherKeywords = ['weather','rain','snow','wind','temperature','heat','cold','humidity','storm'];
    const matchAny = (text, words) => words.some(w => text.includes(w));
    return (markets || []).filter(m => {
      const title = (m.title || m.question || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      const tags = this.normalizeTags(m.tags);
      const text = `${title} ${desc} ${tags.join(' ')}`;
      if (th === 'sports') return matchAny(text, sportKeywords);
      if (th === 'outdoor') return matchAny(text, outdoorKeywords) || matchAny(text, sportKeywords);
      if (th === 'aviation') return matchAny(text, aviationKeywords);
      if (th === 'energy') return matchAny(text, energyKeywords);
      if (th === 'agriculture') return matchAny(text, agricultureKeywords);
      if (th === 'weather_explicit') return matchAny(text, weatherKeywords);
      return true;
    });
  }

  /**
   * Phase 1: Enrich market with order book and depth analytics
   * Fetches order book data and calculates rich metrics for edge detection
   * Uses clobTokenIds from market data (array of outcome token IDs)
   */
  async enrichMarketWithOrderBook(marketData) {
    try {
      // Extract token IDs - market data provides clobTokenIds as JSON string or array
      let tokenIds = marketData?.clobTokenIds;
      
      // Parse if it's a string
      if (typeof tokenIds === 'string') {
        try {
          tokenIds = JSON.parse(tokenIds);
        } catch (e) {
          console.debug('Failed to parse clobTokenIds for market', marketData?.id, ':', e.message);
          return this.enrichMarketWithAvailableData(marketData);
        }
      }
      
      if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
        console.debug('No clobTokenIds available for market:', marketData?.id, 'using fallback');
        return this.enrichMarketWithAvailableData(marketData);
      }

      // Fetch order book for first outcome (YES token)
      // The clobTokenIds array typically has [YES_token_id, NO_token_id]
      const yesTokenId = tokenIds[0];
      if (!yesTokenId) {
        console.debug('Token ID is empty for market:', marketData?.id);
        return this.enrichMarketWithAvailableData(marketData);
      }
      
      let orderBook;
      try {
        const orderBookResponse = await axios.get(`${this.clobBaseURL}/book`, {
          params: { token_id: yesTokenId },
          timeout: 5000,
          // Add retry-after handling for rate limits
          headers: {
            'User-Agent': 'weather-edge-bot/1.0'
          }
        });
        orderBook = orderBookResponse.data;
      } catch (bookError) {
        // If rate limited, wait a bit and try once more (but short timeout)
        if (bookError.response?.status === 429) {
          console.debug('Rate limited on order book fetch, will use fallback');
          return this.enrichMarketWithAvailableData(marketData);
        }
        throw bookError;
      }

      // Extract best bids and asks from order book
      const bestBid = orderBook?.bids?.length > 0 ? Math.max(...orderBook.bids.map(b => parseFloat(b.price))) : null;
      const bestAsk = orderBook?.asks?.length > 0 ? Math.min(...orderBook.asks.map(a => parseFloat(a.price))) : null;

      // Calculate spread and depth metrics
      const spread = bestBid && bestAsk ? bestAsk - bestBid : (marketData.spread || 0);
      const spreadPercent = spread ? (spread / ((bestBid + bestAsk) / 2)) * 100 : 0;

      // Calculate order book depth (total size at best levels)
      const bidDepth = orderBook?.bids?.reduce((sum, bid) => sum + parseFloat(bid.size), 0) || 0;
      const askDepth = orderBook?.asks?.reduce((sum, ask) => sum + parseFloat(ask.size), 0) || 0;

      // Volume trend analysis (24h vs 1wk average)
      const vol24h = parseFloat(marketData.volume24hr || marketData.volume24h || 0);
      const vol1wk = parseFloat(marketData.volume1wk || 0);
      const avgDailyVol = vol1wk / 7;
      const volumeTrend = avgDailyVol > 0 ? ((vol24h - avgDailyVol) / avgDailyVol) * 100 : 0;

      // Market efficiency score (volatility vs volume)
      const priceChanges = [
        parseFloat(marketData.oneDayPriceChange || 0),
        parseFloat(marketData.oneWeekPriceChange || 0),
        parseFloat(marketData.oneMonthPriceChange || 0)
      ].filter(pc => !isNaN(pc));

      const avgPriceChange = priceChanges.length > 0 ?
        priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length : 0;

      const efficiencyRatio = vol24h > 0 ? Math.abs(avgPriceChange * 100) / vol24h : 0;

      return {
        ...marketData,
        orderBook: {
          bestBid,
          bestAsk,
          spread,
          spreadPercent,
          bidDepth,
          askDepth,
          totalDepth: bidDepth + askDepth
        },
        volumeMetrics: {
          vol24h,
          vol1wk,
          vol1mo: parseFloat(marketData.volume1mo || 0),
          vol1yr: parseFloat(marketData.volume1yr || 0),
          volumeTrend, // % change from weekly average
          volumeTrendDirection: volumeTrend > 10 ? 'increasing' :
                                volumeTrend < -10 ? 'decreasing' : 'stable'
        },
        marketEfficiency: {
          efficiencyRatio,
          volatilityScore: Math.abs(avgPriceChange),
          liquidityScore: parseFloat(marketData.liquidity || 0)
        },
        enriched: true,
        enrichmentSource: 'order_book_api'
      };

    } catch (orderBookError) {
      console.debug('Order book fetch failed, falling back to available data:', orderBookError.message);
      return this.enrichMarketWithAvailableData(marketData);
    }
  }

  /**
    * Fallback enrichment when order book API is unavailable
    * Uses available market fields to calculate similar metrics
    * Prefers outcomePrices from /events endpoint
    */
   enrichMarketWithAvailableData(marketData) {
      // Use outcomePrices if available (from /events endpoint - more reliable)
      let bestBid = null;
      let bestAsk = null;
      let outcomePrices = marketData.outcomePrices;
      
      // Parse if outcomePrices is a JSON string
      if (typeof outcomePrices === 'string') {
        try {
          outcomePrices = JSON.parse(outcomePrices);
        } catch (e) {
          outcomePrices = null;
        }
      }
      
      if (outcomePrices && Array.isArray(outcomePrices) && outcomePrices.length >= 2) {
        // outcomePrices[0] = YES outcome, outcomePrices[1] = NO outcome
        const parsed0 = parseFloat(outcomePrices[0]);
        const parsed1 = parseFloat(outcomePrices[1]);
        if (!isNaN(parsed0) && parsed0 > 0) bestAsk = parsed0;
        if (!isNaN(parsed1) && parsed1 > 0) bestBid = parsed1;
      }
      
      // Fallback to bestBid/bestAsk fields if available and haven't been set
      if (bestBid === null) {
        const parsedBid = parseFloat(marketData.bestBid);
        if (!isNaN(parsedBid) && parsedBid > 0) bestBid = parsedBid;
      }
      if (bestAsk === null) {
        const parsedAsk = parseFloat(marketData.bestAsk);
        if (!isNaN(parsedAsk) && parsedAsk > 0) bestAsk = parsedAsk;
      }
      
      // Try price/volume fields common in some APIs
      if (bestBid === null && marketData.price !== undefined) {
        const parsedPrice = parseFloat(marketData.price);
        if (!isNaN(parsedPrice) && parsedPrice > 0) bestBid = parsedPrice;
      }
      if (bestAsk === null && marketData.price !== undefined) {
        const parsedPrice = parseFloat(marketData.price);
        if (!isNaN(parsedPrice) && parsedPrice > 0) bestAsk = parsedPrice;
      }
      
      // If still no prices, try lastTradePrice
      if (bestBid === null || bestAsk === null) {
        const lastTradePrice = parseFloat(marketData.lastTradePrice || 0);
        if (!isNaN(lastTradePrice) && lastTradePrice > 0) {
          if (bestAsk === null) bestAsk = lastTradePrice;
          if (bestBid === null) bestBid = Math.max(0.001, lastTradePrice - 0.01);
        }
      }
      
      // Final safety: use 0.5 (50/50 odds) if no prices available at all
      if (bestBid === null) bestBid = 0.5;
      if (bestAsk === null) bestAsk = 0.5;
      
      // Debug log for problematic markets
      if (bestBid === 0.5 && bestAsk === 0.5) {
        console.debug(`Market ${marketData.id} using default 50/50 odds. Available fields:`, {
          outcomePrices: marketData.outcomePrices,
          bestBid: marketData.bestBid,
          bestAsk: marketData.bestAsk,
          price: marketData.price,
          lastTradePrice: marketData.lastTradePrice
        });
      }
     
     // Calculate spread from available data
     const spread = parseFloat(marketData.spread || 0);
     const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0.5;
     const spreadPercent = (spread > 0 && midPrice > 0) ? (spread / midPrice) * 100 : 0;

    // Volume trend analysis using available fields
    const vol24h = parseFloat(marketData.volume24hr || marketData.volume24h || 0);
    const vol1wk = parseFloat(marketData.volume1wk || 0);
    const avgDailyVol = vol1wk / 7;
    const volumeTrend = avgDailyVol > 0 ? ((vol24h - avgDailyVol) / avgDailyVol) * 100 : 0;

    return {
      ...marketData,
      orderBook: {
        bestBid: bestBid || null,
        bestAsk: bestAsk || null,
        spread,
        spreadPercent: spreadPercent || 0,
        bidDepth: parseFloat(marketData.liquidity || 0) * 0.5, // Estimate
        askDepth: parseFloat(marketData.liquidity || 0) * 0.5, // Estimate
        totalDepth: parseFloat(marketData.liquidity || 0)
      },
      volumeMetrics: {
        vol24h,
        vol1wk,
        vol1mo: parseFloat(marketData.volume1mo || 0),
        vol1yr: parseFloat(marketData.volume1yr || 0),
        volumeTrend,
        volumeTrendDirection: volumeTrend > 10 ? 'increasing' :
                             volumeTrend < -10 ? 'decreasing' : 'stable'
      },
      marketEfficiency: {
        efficiencyRatio: 0, // Can't calculate without order book
        volatilityScore: Math.abs(parseFloat(marketData.oneDayPriceChange || 0)),
        liquidityScore: parseFloat(marketData.liquidity || 0)
      },
      enriched: true,
      enrichmentSource: 'fallback_api_data'
    };
  }

  /**
   * Get enriched market details with full analytics for edge detection
   * Combines base market data with order book analytics
   */
  async getEnrichedMarketDetails(marketID) {
    try {
      // Get base market details
      const baseMarketData = await this.getMarketDetails(marketID);
      if (!baseMarketData) return null;

      // Enrich with order book and analytics
      const enrichedData = await this.enrichMarketWithOrderBook(baseMarketData);

      return enrichedData;
    } catch (error) {
      console.error(`Error enriching market details for ${marketID}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate capital required to move market odds significantly
   * Useful for assessing market depth and edge potential
   */
  calculateDepthImpact(orderBook, targetMovement = 0.05) {
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      return {
        capitalToMove5Percent: 'N/A',
        marketDepth: 'shallow',
        liquidityRating: 'low'
      };
    }

    const bids = orderBook.bids
      .map(b => ({ price: parseFloat(b.price), size: parseFloat(b.size) }))
      .sort((a, b) => b.price - a.price); // Sort bids high to low

    const asks = orderBook.asks
      .map(a => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
      .sort((a, b) => a.price - b.price); // Sort asks low to high

    const midPrice = (bids[0]?.price + asks[0]?.price) / 2;
    const targetPrice = midPrice * (1 + targetMovement);

    let capitalRequired = 0;
    let totalSizeRemoved = 0;

    // Calculate capital needed to move price up by targetMovement %
    for (const ask of asks) {
      if (ask.price <= targetPrice) {
        capitalRequired += ask.price * ask.size;
        totalSizeRemoved += ask.size;
      } else {
        // Partial fill of last level
        const remainingMovement = targetPrice - (midPrice + (totalSizeRemoved * midPrice * 0.001));
        if (remainingMovement > 0) {
          const partialSize = remainingMovement / (ask.price - midPrice);
          capitalRequired += ask.price * partialSize;
        }
        break;
      }
    }

    // Rate market depth
    let depthRating, liquidityRating;
    const totalDepth = orderBook.bids.reduce((sum, b) => sum + b.size, 0) +
                      orderBook.asks.reduce((sum, a) => sum + a.size, 0);

    if (totalDepth > 1000) {
      depthRating = 'deep';
      liquidityRating = 'high';
    } else if (totalDepth > 100) {
      depthRating = 'moderate';
      liquidityRating = 'medium';
    } else {
      depthRating = 'shallow';
      liquidityRating = 'low';
    }

    return {
      capitalToMove5Percent: capitalRequired.toFixed(2),
      marketDepth: depthRating,
      liquidityRating,
      totalOrderBookSize: totalDepth.toFixed(2)
    };
  }

  /**
   * Get market price history (if available via API)
   */
  async getMarketHistory(marketID) {
    try {
      const response = await axios.get(`${this.baseURL}/markets/${marketID}/history`, {
        params: { limit: 100 },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.debug('Market history not available:', error.message);
      return null;
    }
  }

  /**
   * Build order object for CLOB client
   * Validates all required fields before sending to blockchain
   */
  buildOrderObject(marketData, price, side, size, feeRateBps = 0) {
    try {
      if (!marketData?.id && !marketData?.tokenID) {
        throw new Error('Market ID is required');
      }

      const tokenID = marketData.id || marketData.tokenID;
      const tradingMetadata = marketData.tradingMetadata || {
        tickSize: '0.001',
        negRisk: false,
        chainId: 137
      };

      // Validate price is within tick size precision
      const tickSize = parseFloat(tradingMetadata.tickSize);
      if (price % tickSize !== 0) {
        console.warn(`Price ${price} not aligned with tick size ${tickSize}`);
      }

      return {
        tokenID,
        price: parseFloat(price),
        side: side.toUpperCase(),
        size: parseFloat(size),
        feeRateBps: parseInt(feeRateBps),
        metadata: {
          tickSize: tradingMetadata.tickSize,
          negRisk: tradingMetadata.negRisk
        }
      };
    } catch (error) {
      console.error('Order building error:', error.message);
      throw error;
    }
  }

  /**
   * Validate order before submission
   * Checks market exists, price in valid range, sufficient size
   */
  async validateOrder(orderData) {
    try {
      const { marketID, price, side, size } = orderData;

      if (!marketID || price === undefined || !side || !size) {
        throw new Error('Missing required order fields');
      }

      if (price < 0 || price > 1) {
        throw new Error('Price must be between 0 and 1');
      }

      if (size <= 0) {
        throw new Error('Size must be greater than 0');
      }

      // Fetch market details to verify it exists
      const marketData = await this.getMarketDetails(marketID);
      if (!marketData) {
        throw new Error(`Market ${marketID} not found`);
      }

      return {
        valid: true,
        marketData
      };
    } catch (error) {
      console.error('Order validation error:', error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate order cost (price * size) + fees
   * Useful for UX: show "You will spend X USDC"
   */
  calculateOrderCost(price, size, feeRateBps = 0) {
    const baseCost = price * size;
    const fee = baseCost * (feeRateBps / 10000);
    return {
      baseCost: baseCost.toFixed(2),
      fee: fee.toFixed(2),
      total: (baseCost + fee).toFixed(2)
    };
  }

  /**
   * Get order metadata for display
   */
  getOrderMetadata(order, marketData) {
    return {
      market: marketData?.title || 'Unknown Market',
      side: order.side,
      size: order.size,
      price: order.price,
      cost: this.calculateOrderCost(order.price, order.size, order.feeRateBps),
      tokenID: order.tokenID,
      tradingMetadata: marketData?.tradingMetadata
    };
  }

  /**
   * Get status of Polymarket service
   */
  getStatus() {
    return {
      service: 'Polymarket Data & Trading Service',
      available: true,
      markets: {
        cache: this.cache.size,
        duration: `${this.CACHE_DURATION / (60 * 1000)} minutes`
      },
      marketDetails: {
        cache: this.marketDetailsCache.size,
        duration: `${this.MARKET_DETAILS_CACHE_DURATION / (60 * 1000)} minutes`
      },
      baseURL: this.baseURL,
      clobBaseURL: this.clobBaseURL
    };
  }
}

// Export singleton instance
export const polymarketService = new PolymarketService();
export default polymarketService;
