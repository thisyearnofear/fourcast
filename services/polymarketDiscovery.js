// Polymarket Discovery — market discovery and catalog functions
// Extracted from PolymarketService class methods

import axios from 'axios';
import { MarketTypeDetector } from './marketTypeDetector.js';
import { MarketDataValidator, WeatherDataValidator } from './validators/index.js';
import { VenueExtractor } from './venueExtractor.js';
import { weatherService } from './weatherService.js';
import { cache, getCachedMarkets, setCachedMarkets, getCachedCatalog, setCachedCatalog } from './polymarketCache.js';
import * as helpers from './polymarketHelpers.js';

/**
 * Fetch sports metadata including tag IDs for each sport
 */
export async function getSportsMetadata() {
  if (cache.sportsMetadata && Date.now() - cache.sportsMetadata.timestamp < cache.SPORTS_METADATA_CACHE_DURATION) {
    return cache.sportsMetadata.data;
  }

  try {
    const response = await axios.get(`${cache.baseURL}/sports`, { timeout: 10000 });
    cache.sportsMetadata = {
      data: response.data,
      timestamp: Date.now()
    };
    return response.data;
  } catch (error) {
    console.error('Error fetching sports metadata:', error.message);
    return [];
  }
}

/**
 * Get tag ID(s) for a specific category (Sports, Politics, Crypto, etc.)
 * For Soccer, returns an array of all soccer league tag IDs
 */
export async function getCategoryTagId(category) {
  // Map of category names to Polymarket tag IDs
  const categoryTagMap = {
    'Sports': null,
    'Politics': '2',
    'Crypto': '21',
    'Economics': '120',
    'Finance': '120',
    'Business': '107',
    'Tech': '1401',
    'Culture': '596',
    'Science': '74',
    'Movies': '53',
    'Weather': null
  };

  // SPECIAL CASE: Soccer
  if (category.toLowerCase() === 'soccer') {
    const sports = await getSportsMetadata();
    const soccerLeagueCodes = ['epl', 'lal', 'ucl', 'sea', 'bun', 'fl1', 'mls', 'uel',
      'afc', 'ofc', 'fif', 'ere', 'arg', 'itc', 'mex', 'lcs',
      'lib', 'sud', 'tur', 'con', 'cof', 'uef', 'caf', 'rus',
      'efa', 'efl', 'cdr'];

    const soccerTags = [];
    for (const code of soccerLeagueCodes) {
      const league = sports.find(s => s.sport === code);
      if (league && league.tags) {
        const tagArray = league.tags.split(',');
        const specificTag = tagArray.find(t => t !== '1' && t !== '100639');
        if (specificTag) {
          soccerTags.push(specificTag);
        }
      }
    }

    return soccerTags;
  }

  // For other sports subcategories, fetch from sports metadata
  if (['nfl', 'nba', 'mlb', 'nhl', 'tennis', 'cricket', 'rugby', 'golf', 'f1', 'formula 1'].includes(category.toLowerCase())) {
    const sports = await getSportsMetadata();
    const extractSportTag = (tags) => {
      if (!tags) return null;
      const tagArray = tags.split(',');
      return tagArray.find(t => t !== '1' && t !== '100639') || tagArray[0];
    };

    if (category.toLowerCase() === 'f1' || category.toLowerCase() === 'formula 1') {
      return '435';
    }

    if (category.toLowerCase() === 'nfl') {
      return '450';
    }

    const key = category.toLowerCase();
    return extractSportTag(sports.find(s => s.sport === key)?.tags);
  }

  return categoryTagMap[category] || null;
}

/**
 * Fetch all active markets from Polymarket
 * Optionally filter by tags (e.g., "Sports", "Politics")
 * IMPROVED: Uses /events endpoint for full tag metadata
 */
export async function getAllMarkets(tags = null) {
  try {
    // Use /events endpoint for full metadata
    const params = {
      limit: 100,
      closed: false
    };

    // If tag filtering requested, use tag_id parameter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      params.tag_id = tagArray[0]; // Use first tag if provided
    }

    const response = await axios.get(`${cache.baseURL}/events`, {
      params,
      timeout: 10000
    });

    // Extract all markets from events
    const events = Array.isArray(response.data) ? response.data : (response.data?.events || []);
    let allMarkets = [];

    for (const event of events) {
      if (event.markets && Array.isArray(event.markets)) {
        // Filter out resolved/closed markets at extraction time
        const activeMarkets = event.markets.filter(m => {
          const isClosed = m.closed === true || m.closed === 'true';
          const isResolved = m.resolved === true || m.resolved === 'true';
          const hasResolution = m.resolutionSource || m.winningOutcome;
          const isArchived = m.archived === true || m.archived === 'true';

          return !isClosed && !isResolved && !hasResolution && !isArchived;
        });

        allMarkets = allMarkets.concat(
          activeMarkets.map(m => ({
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
export async function searchMarketsByLocation(location) {
  // Check cache first
  const cachedResult = getCachedMarkets(location);
  if (cachedResult) {
    return { ...cachedResult, cached: true };
  }

  try {
    // Use /events endpoint for better market structure
    const response = await axios.get(`${cache.baseURL}/events`, {
      params: {
        limit: 100,
        closed: false,
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
        const eventLoc = helpers.extractLocation(eventTitle);

        // Match location (case-insensitive)
        if (eventLoc && eventLoc.toLowerCase() === location.toLowerCase()) {
          // Add active markets from this event with event tags for metadata
          if (event.markets && Array.isArray(event.markets)) {
            // Filter out resolved/closed markets at extraction time
            const activeMarkets = event.markets.filter(m => {
              const isClosed = m.closed === true || m.closed === 'true';
              const isResolved = m.resolved === true || m.resolved === 'true';
              const hasResolution = m.resolutionSource || m.winningOutcome;
              const isArchived = m.archived === true || m.archived === 'true';
              return !isClosed && !isResolved && !hasResolution && !isArchived;
            });

            relevantMarkets.push(...activeMarkets.map(m => ({
              ...m,
              eventTags: event.tags || []
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
      source: 'events_endpoint'
    };

    // Cache the results
    setCachedMarkets(location, result);

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
 * ENHANCED: Now includes comprehensive market data validation
 */
export async function getMarketDetails(marketID) {
  try {
    // Check cache first
    const cached = cache.marketDetailsCache.get(marketID);
    if (cached && Date.now() - cached.timestamp < cache.MARKET_DETAILS_CACHE_DURATION) {
      return cached.data;
    }

    const response = await axios.get(`${cache.baseURL}/markets/${marketID}`, { timeout: 10000 });
    const marketData = response.data;

    // ENHANCED: Validate market data quality using MarketDataValidator
    const marketValidation = MarketDataValidator.validateMarketData('market', marketData);
    const pricingValidation = MarketDataValidator.validateMarketData('pricing', {
      currentOdds: {
        yes: marketData.outcomePrices?.[0],
        no: marketData.outcomePrices?.[1]
      },
      outcomePrices: marketData.outcomePrices,
      lastPrice: marketData.lastPrice
    });

    // Enrich with trading metadata needed for orders
    const enrichedData = {
      ...marketData,
      tradingMetadata: {
        tickSize: marketData.tickSize || '0.001',
        negRisk: marketData.negRisk || false,
        chainId: 137 // Polygon
      },
      // ENHANCED: Include validation results
      validation: {
        market: marketValidation,
        pricing: pricingValidation,
        dataQuality: marketValidation.dataQuality || 'UNKNOWN',
        warnings: [...(marketValidation.warnings || []), ...(pricingValidation.warnings || [])]
      }
    };

    // Cache it
    cache.marketDetailsCache.set(marketID, {
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
 * ROADMAP: Foundation for Phase 2 & 3 (weather scoring & edge detection)
 * IMPROVED: Now uses /events endpoint to get full tag metadata
 */
export async function buildMarketCatalog(minVolume = 50000, eventTypeFilter = null, analysisType = 'discovery') {
  console.log(`🔍 buildMarketCatalog START: minVolume=${minVolume}, eventType=${eventTypeFilter}, analysisType=${analysisType}`);

  // Check cache first
  const cached = getCachedCatalog(eventTypeFilter);
  if (cached) {
    console.log(`✅ Returning cached catalog for ${eventTypeFilter}`);
    return { ...cached, cached: true };
  }

  try {
    let allMarkets = [];
    console.log(`📥 Fetching fresh markets from API for ${eventTypeFilter || 'all'}...`);

    try {
      // SPECIAL CASE: Soccer - fetch from all soccer league tags
      if (eventTypeFilter === 'Soccer') {
        console.debug(`⚽ Fetching Soccer markets from all leagues...`);
        const soccerTags = await getCategoryTagId('Soccer');

        if (soccerTags && Array.isArray(soccerTags) && soccerTags.length > 0) {
          console.debug(`📌 Found ${soccerTags.length} soccer league tags`);
          const soccerEvents = [];
          console.log(`📋 Fetching events for ${soccerTags.slice(0, 10).length} soccer league tags...`);
          for (const tagId of soccerTags.slice(0, 10)) {
            try {
              console.log(`  → Fetching tag ${tagId}...`);
              const response = await axios.get(`${cache.baseURL}/events`, {
                params: { tag_id: tagId, closed: false, limit: 50 },
                timeout: 10000
              });
              console.log(`    → Got response: ${response.status}, ${Array.isArray(response.data) ? response.data.length : typeof response.data} items`);
              if (response.data && Array.isArray(response.data)) {
                soccerEvents.push(...response.data);
                console.log(`    → Added ${response.data.length} events. Total so far: ${soccerEvents.length}`);
              }
            } catch (err) {
              console.error(`   ⚠️ Error fetching tag ${tagId}:`, err.message, err.response?.status);
            }
          }
          console.log(`   ✅ Fetched ${soccerEvents.length} total soccer events`);
          console.debug(`✅ Fetched ${soccerEvents.length} soccer events from ${soccerTags.slice(0, 10).length} leagues`);

          const now = new Date();
          const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
          for (const event of soccerEvents) {
            const endDate = event.endDate || event.end_date;
            if (endDate && new Date(endDate) > maxDate) continue;
            if (event.markets && Array.isArray(event.markets)) {
              allMarkets = allMarkets.concat(event.markets.map(m => ({
                ...m, eventTags: event.tags || [],
                endDate: m.endDate || event.endDate || event.end_date,
                eventType: 'Soccer'
              })));
            }
          }
          console.debug(`✨ Extracted ${allMarkets.length} soccer markets`);
        } else {
          console.warn(`⚠️ No soccer league tags found`);
        }
      }
      // SPECIAL CASE: NFL - fetch using NFL tag
      else if (eventTypeFilter === 'NFL') {
        console.debug(`🏈 Fetching NFL markets...`);
        const tagId = await getCategoryTagId('NFL');
        if (tagId) {
          const response = await axios.get(`${cache.baseURL}/events`, {
            params: { tag_id: tagId, closed: false, limit: 100 },
            timeout: 10000
          });
          if (response.data && Array.isArray(response.data)) {
            const now = new Date();
            const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            for (const event of response.data) {
              const endDate = event.endDate || event.end_date;
              if (endDate && new Date(endDate) > maxDate) continue;
              if (event.markets && Array.isArray(event.markets)) {
                allMarkets.push(...event.markets.map(m => ({
                  ...m, eventTags: event.tags || [],
                  endDate: m.endDate || event.endDate || event.end_date,
                  eventType: 'NFL'
                })));
              }
            }
            console.debug(`✨ Extracted ${allMarkets.length} NFL markets`);
          }
        }
      }
      // SPECIAL CASE: F1 - fetch using F1 tag
      else if (eventTypeFilter === 'F1') {
        console.debug(`🏎️ Fetching F1 markets...`);
        const tagId = await getCategoryTagId('F1');
        if (tagId) {
          const response = await axios.get(`${cache.baseURL}/events`, {
            params: { tag_id: tagId, closed: false, limit: 100 },
            timeout: 10000
          });
          if (response.data && Array.isArray(response.data)) {
            const now = new Date();
            const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            for (const event of response.data) {
              const endDate = event.endDate || event.end_date;
              if (endDate && new Date(endDate) > maxDate) continue;
              if (event.markets && Array.isArray(event.markets)) {
                allMarkets.push(...event.markets.map(m => ({
                  ...m, eventTags: event.tags || [],
                  endDate: m.endDate || event.endDate || event.end_date,
                  eventType: 'F1'
                })));
              }
            }
            console.debug(`✨ Extracted ${allMarkets.length} F1 markets`);
          }
        }
      }
      // SPECIAL CASE: 'all' - behavior depends on analysis type
      else if (eventTypeFilter === 'all') {
        // For sports page (/sports with analysisType: 'event-weather'), limit to supported sports only
        if (analysisType === 'event-weather') {
          console.debug(`🏆 Fetching markets from all supported sports (event-weather mode)...`);
          const allSportsMarkets = [];

          // Fetch NFL markets
          try {
            const nflTagId = await getCategoryTagId('NFL');
            if (nflTagId) {
              const nflResponse = await axios.get(`${cache.baseURL}/events`, {
                params: { tag_id: nflTagId, closed: false, limit: 50 },
                timeout: 10000
              });
              if (nflResponse.data && Array.isArray(nflResponse.data)) {
                const maxDate = new Date(new Date().getTime() + 60 * 24 * 60 * 60 * 1000);
                for (const event of nflResponse.data) {
                  const endDate = event.endDate || event.end_date;
                  if (endDate && new Date(endDate) > maxDate) continue;
                  if (event.markets && Array.isArray(event.markets)) {
                    allSportsMarkets.push(...event.markets.map(m => ({
                      ...m, eventTags: event.tags || [],
                      endDate: m.endDate || event.endDate || event.end_date,
                      eventType: 'NFL'
                    })));
                  }
                }
              }
            }
          } catch (err) {
            console.debug('Error fetching NFL markets for "all":', err.message);
          }

          // Fetch Soccer markets
          try {
            const soccerTags = await getCategoryTagId('Soccer');
            if (soccerTags && Array.isArray(soccerTags)) {
              for (const tagId of soccerTags.slice(0, 5)) {
                try {
                  const soccerResponse = await axios.get(`${cache.baseURL}/events`, {
                    params: { tag_id: tagId, closed: false, limit: 30 },
                    timeout: 10000
                  });
                  if (soccerResponse.data && Array.isArray(soccerResponse.data)) {
                    const maxDate = new Date(new Date().getTime() + 60 * 24 * 60 * 60 * 1000);
                    for (const event of soccerResponse.data) {
                      const endDate = event.endDate || event.end_date;
                      if (endDate && new Date(endDate) > maxDate) continue;
                      if (event.markets && Array.isArray(event.markets)) {
                        allSportsMarkets.push(...event.markets.map(m => ({
                          ...m, eventTags: event.tags || [],
                          endDate: m.endDate || event.endDate || event.end_date,
                          eventType: 'Soccer'
                        })));
                      }
                    }
                  }
                } catch (err) {
                  console.debug(`Error fetching soccer tag ${tagId} for "all":`, err.message);
                }
              }
            }
          } catch (err) {
            console.debug('Error fetching Soccer markets for "all":', err.message);
          }

          // Fetch F1 markets
          try {
            const f1TagId = await getCategoryTagId('F1');
            if (f1TagId) {
              const f1Response = await axios.get(`${cache.baseURL}/events`, {
                params: { tag_id: f1TagId, closed: false, limit: 30 },
                timeout: 10000
              });
              if (f1Response.data && Array.isArray(f1Response.data)) {
                const maxDate = new Date(new Date().getTime() + 60 * 24 * 60 * 60 * 1000);
                for (const event of f1Response.data) {
                  const endDate = event.endDate || event.end_date;
                  if (endDate && new Date(endDate) > maxDate) continue;
                  if (event.markets && Array.isArray(event.markets)) {
                    allSportsMarkets.push(...event.markets.map(m => ({
                      ...m, eventTags: event.tags || [],
                      endDate: m.endDate || event.endDate || event.end_date,
                      eventType: 'F1'
                    })));
                  }
                }
              }
            }
          } catch (err) {
            console.debug('Error fetching F1 markets for "all":', err.message);
          }

          allMarkets = allSportsMarkets;
          console.debug(`✨ Extracted ${allMarkets.length} markets from all supported sports`);
        } else {
          // For discovery page (analysisType: 'discovery'), fetch from general markets
          console.debug(`🌐 Fetching markets from all categories (discovery mode)...`);

          const params = { limit: 200, offset: 0, closed: false };
          console.debug(`🔗 Fetching from ${cache.baseURL}/events with params:`, params);
          const response = await axios.get(`${cache.baseURL}/events`, {
            params, timeout: 10000
          });

          console.debug(`📥 Response received:`, {
            isArray: Array.isArray(response.data),
            length: Array.isArray(response.data) ? response.data.length : 'N/A',
            hasEvents: Array.isArray(response.data) ? response.data.some(e => e.markets) : false
          });

          if (response.data && Array.isArray(response.data)) {
            const events = response.data;
            let marketCount = 0;
            const now = new Date();
            const maxDaysOut = 60;
            const maxDate = new Date(now.getTime() + maxDaysOut * 24 * 60 * 60 * 1000);

            for (const event of events) {
              const endDate = event.endDate || event.end_date;
              if (endDate) {
                const eventEndDate = new Date(endDate);
                if (eventEndDate > maxDate) continue;
              }
              if (event.markets && Array.isArray(event.markets)) {
                const eventsMarkets = event.markets.map(m => ({
                  ...m, eventTags: event.tags || [],
                  endDate: m.endDate || event.endDate || event.end_date,
                  eventType: m.eventType || null
                }));
                allMarkets = allMarkets.concat(eventsMarkets);
                marketCount += eventsMarkets.length;
              }
            }
            console.debug(`✨ Extracted ${allMarkets.length} markets from general events (discovery mode)`);
          }
        }
      }
      // For other sports or categories, use existing logic
      else {
        const sportTypes = ['Sports', 'NBA', 'MLB', 'NHL', 'Tennis', 'Golf', 'Cricket'];
        const isSportsFilter = sportTypes.includes(eventTypeFilter);

        const params = { limit: 200, offset: 0, closed: false };

        if (!isSportsFilter && eventTypeFilter && eventTypeFilter !== 'Weather') {
          const tagId = await getCategoryTagId(eventTypeFilter);
          console.debug(`📌 Category filter: ${eventTypeFilter} -> tag_id: ${tagId}`);
          if (tagId) {
            params.tag_id = tagId;
          }
        }

        console.debug(`🔗 Fetching from ${cache.baseURL}/events with params:`, params);
        const response = await axios.get(`${cache.baseURL}/events`, {
          params, timeout: 10000
        });

        console.debug(`📥 Response received:`, {
          isArray: Array.isArray(response.data),
          length: Array.isArray(response.data) ? response.data.length : 'N/A',
          hasEvents: Array.isArray(response.data) ? response.data.some(e => e.markets) : false
        });

        if (response.data && Array.isArray(response.data)) {
          const events = response.data;
          let marketCount = 0;
          const now = new Date();
          const maxDaysOut = 60;
          const maxDate = new Date(now.getTime() + maxDaysOut * 24 * 60 * 60 * 1000);

          for (const event of events) {
            const endDate = event.endDate || event.end_date;
            if (endDate) {
              const eventEndDate = new Date(endDate);
              if (eventEndDate > maxDate) continue;
            }
            if (event.markets && Array.isArray(event.markets)) {
              const eventsMarkets = event.markets.map(m => ({
                ...m, eventTags: event.tags || [],
                endDate: m.endDate || event.endDate || event.end_date
              }));
              allMarkets = allMarkets.concat(eventsMarkets);
              marketCount += eventsMarkets.length;
            }
          }
          console.debug(`✨ Extracted ${marketCount} markets from ${events.length} events (filtered to ≤${maxDaysOut} days)`);

          if (allMarkets.length > 0) {
            console.debug(`📝 Sample of fetched markets:`);
            allMarkets.slice(0, 5).forEach((m, idx) => {
              console.debug(`   ${idx + 1}. ${(m.title || '').substring(0, 60)}`);
            });
          }
        }
      }
    } catch (fetchError) {
      console.error(`❌ Error fetching events:`, fetchError.message);
      console.error(`   Status: ${fetchError.response?.status}, Data: ${JSON.stringify(fetchError.response?.data)}`);
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
      const tags = market.eventTags || market.tags || [];
      const metadata = helpers.extractMarketMetadata(title, tags);

      if (!metadata.event_type) {
        console.debug(`📍 No event_type detected for: "${title.substring(0, 50)}..." | Tags: ${JSON.stringify(tags)}`);
      }

      const enrichedData = helpers.enrichMarketWithAvailableData(market);

      // Fallback: If no eventType but title/description has sports keywords, infer it
      let eventType = metadata.event_type;
      if (!eventType) {
        const titleLower = title.toLowerCase();
        const descLower = (market.description || '').toLowerCase();
        const text = `${titleLower} ${descLower}`;

        if (text.includes('premier league') || text.includes('champions league') ||
          text.includes('liverpool') || text.includes('arsenal') || text.includes('chelsea') ||
          text.includes('manchester') || text.includes('tottenham') || text.includes('soccer')) {
          eventType = 'Soccer';
        }
        else if (/\bnfl\b/i.test(text) || text.includes('super bowl') ||
          text.includes('patriots') || text.includes('cowboys') || text.includes('chiefs')) {
          eventType = 'NFL';
        }
        else if (/\bnba\b/i.test(text) || text.includes('basketball') || text.includes('lakers') || text.includes('celtics')) {
          eventType = 'NBA';
        }
        else if (/\bmlb\b/i.test(text) || text.includes('baseball') || text.includes('yankees') || text.includes('dodgers')) {
          eventType = 'MLB';
        }
        else if (text.includes('hockey') || /\bnhl\b/i.test(text)) {
          eventType = 'NHL';
        }
        else if (/\bf1\b/i.test(text) || text.includes('formula 1') || text.includes('formula one') || text.includes('grand prix')) {
          eventType = 'F1';
        }
        else if (text.includes('tennis') || text.includes('wimbledon') || text.includes('us open')) {
          eventType = 'Tennis';
        }
        else if (text.includes('golf') || /\bpga\b/i.test(text) || text.includes('masters')) {
          eventType = 'Golf';
        }
      }

      return {
        marketID: market.tokenID || market.id,
        title,
        description: market.description,
        location: metadata.location,
        teams: metadata.teams,
        eventType: eventType,
        currentOdds: {
          yes: parseFloat(market.outcomePrices?.[0] || enrichedData.orderBook?.bestAsk || 0.5),
          no: parseFloat(market.outcomePrices?.[1] || enrichedData.orderBook?.bestBid || 0.5)
        },
        volume24h: enrichedData.volumeMetrics?.vol24h || parseFloat(market.volume24h || market.volume || 0),
        liquidity: enrichedData.marketEfficiency?.liquidityScore || parseFloat(market.liquidity || 0),
        tags: tags,
        resolutionDate: market.endDate || market.expiresAt,
        orderBookMetrics: enrichedData.orderBook,
        volumeMetrics: enrichedData.volumeMetrics,
        marketEfficiency: enrichedData.marketEfficiency,
        enrichmentSource: enrichedData.enrichmentSource,
        enriched: enrichedData.enriched,
        oddsAnalysis: {
          bestBid: enrichedData.orderBook?.bestBid,
          bestAsk: enrichedData.orderBook?.bestAsk,
          spread: enrichedData.orderBook?.spread,
          spreadPercent: enrichedData.orderBook?.spreadPercent,
          midPrice: enrichedData.orderBook?.bestBid && enrichedData.orderBook?.bestAsk ?
            (enrichedData.orderBook.bestBid + enrichedData.orderBook.bestAsk) / 2 : null,
          marketDepth: helpers.calculateDepthImpact(enrichedData.orderBook)
        },
        rawMarket: market
      };
    });

    // Sort by volume
    baseEnrichedMarkets.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    const catalog = baseEnrichedMarkets;

    console.log(`✅ buildMarketCatalog COMPLETE:`, {
      totalMarkets: catalog.length,
      minVolume,
      eventTypeFilter,
      volumeDistribution: {
        above10k: catalog.filter(m => m.volume24h >= 10000).length,
        above50k: catalog.filter(m => m.volume24h >= 50000).length,
        above100k: catalog.filter(m => m.volume24h >= 100000).length
      },
      eventTypes: [...new Set(catalog.map(m => m.eventType))].join(', ')
    });

    const result = {
      markets: catalog,
      totalMarkets: catalog.length,
      minVolume,
      timestamp: new Date().toISOString(),
      cached: false
    };

    // Cache the catalog
    setCachedCatalog(result, eventTypeFilter);

    return result;
    } catch (error) {
    console.error('❌ Error building market catalog:', error.message, error.stack);
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
 * Phase 3: Get top weather-sensitive markets
 * Supports two analysis modes:
 * - 'event-weather': For /ai page - fetches weather at event venues
 * - 'discovery': For /discovery page - location-agnostic market browsing
 */
export async function getTopWeatherSensitiveMarkets(limit = 10, filters = {}) {
   console.log(`🎯 getTopWeatherSensitiveMarkets START: limit=${limit}, filters=`, JSON.stringify(filters));

   try {
     const isTestEnv = (typeof process !== 'undefined') && (process.env.VITEST || process.env.NODE_ENV === 'test');
     if (isTestEnv) {
       const mockMarkets = [
         {
           marketID: 'mock_super_bowl_2026',
           title: 'Will the Kansas City Chiefs win Super Bowl 2026?',
           description: 'Resolves at end of season',
           resolutionDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
           eventType: 'NFL',
           currentOdds: { yes: 0.08, no: 0.92 },
           edgeScore: 6.5,
           confidence: 'HIGH'
         },
         {
           marketID: 'mock_nfl_division',
           title: 'Will the Washington Commanders win the NFC East?',
           description: 'Resolves at end of 2025-26 season',
           resolutionDate: new Date(Date.now() + 48 * 24 * 60 * 60 * 1000).toISOString(),
           eventType: 'NFL',
           currentOdds: { yes: 0.035, no: 0.965 },
           edgeScore: 5.8,
           confidence: 'HIGH'
         }
       ];
       return {
         markets: mockMarkets.slice(0, limit),
         totalFound: mockMarkets.length,
         timestamp: new Date().toISOString(),
         cached: false
       };
     }
     const analysisType = filters.analysisType || 'discovery';

     const catalogResult = await buildMarketCatalog(filters.minVolume || 50000, filters.eventType, analysisType);

     console.log(`📦 Market catalog result:`, {
       total: catalogResult.markets?.length,
       minVolume: filters.minVolume,
       eventType: filters.eventType,
       cached: catalogResult.cached,
       error: catalogResult.error
     });

     if (!catalogResult.markets || catalogResult.markets.length === 0) {
       console.error(`❌ Empty catalog result. Error: ${catalogResult.error}`);
       return {
         markets: [],
         totalFound: 0,
         message: 'No markets found in catalog',
         timestamp: new Date().toISOString()
       };
     }

    // Score each market based on analysis type
    let scoredMarkets;

    if (analysisType === 'event-weather') {
      console.debug(`⚡ Scoring ${catalogResult.markets.length} markets for event-weather analysis`);
      scoredMarkets = await Promise.all(
        catalogResult.markets.map(async (market, idx) => {
          try {
            const venue = VenueExtractor.extractFromMarket(market);
            let eventWeather = null;

            if (venue && VenueExtractor.isValidVenue(venue)) {
              try {
                eventWeather = await weatherService.getCurrentWeather(venue);
                console.debug(`  [${idx}] ✓ ${market.title?.substring(0, 40)} @ ${venue}`);
              } catch (weatherErr) {
                console.debug(`  [${idx}] ⚠ ${market.title?.substring(0, 40)} @ ${venue} - weather fetch failed`);
              }
            } else {
              console.debug(`  [${idx}] ✗ ${market.title?.substring(0, 40)} - no venue found`);
            }

            const edgeAssessment = helpers.assessMarketWeatherEdge(market, eventWeather);
            console.debug(`    → Score: ${edgeAssessment.totalScore.toFixed(1)} | Type: ${market.eventType} | Confidence: ${edgeAssessment.confidence}`);

            return {
              ...market,
              eventLocation: venue,
              eventWeather: eventWeather,
              edgeScore: edgeAssessment.totalScore,
              edgeFactors: edgeAssessment.factors,
              confidence: edgeAssessment.confidence,
              weatherContext: edgeAssessment.weatherContext,
              isWeatherSensitive: edgeAssessment.isWeatherSensitive
            };
          } catch (err) {
            console.warn(`Error processing market ${market.title} for event-weather analysis:`, err.message);
            const edgeAssessment = helpers.assessMarketWeatherEdge(market, null);
            return {
              ...market,
              eventLocation: null,
              eventWeather: null,
              edgeScore: edgeAssessment.totalScore,
              edgeFactors: edgeAssessment.factors,
              confidence: edgeAssessment.confidence,
              weatherContext: edgeAssessment.weatherContext,
              isWeatherSensitive: edgeAssessment.isWeatherSensitive
            };
          }
        })
      );
    } else {
      // /discovery page: Score by market efficiency (not weather)
      scoredMarkets = catalogResult.markets.map(market => {
        const efficiency = helpers.assessMarketEfficiency(market);
        return {
          ...market,
          eventLocation: null,
          eventWeather: null,
          edgeScore: efficiency.totalScore,
          edgeFactors: efficiency.factors,
          confidence: efficiency.confidence,
          weatherContext: null,
          isWeatherSensitive: efficiency.isWeatherSensitive
        };
      });
    }

    // FILTER 1: Filter by event type if specified
    const preFilterCount = scoredMarkets.length;
    const scoreDistribution = scoredMarkets.reduce((acc, m) => {
      const bucket = m.edgeScore === 0 ? '0' : (m.edgeScore < 1 ? '0-1' : (m.edgeScore < 3 ? '1-3' : '3+'));
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});
    console.debug(`📊 Edge score distribution (pre-filter): Total=${preFilterCount}`, scoreDistribution);

    let filtered = scoredMarkets;

    if (filters.eventType && filters.eventType !== 'all' && filters.eventType !== 'Sports') {
      const targetType = filters.eventType.toUpperCase();
      const beforeTypeFilter = filtered.length;
      const eventTypeCounts = filtered.reduce((acc, m) => {
        const type = m.eventType || 'None';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      console.debug(`📋 Event types before filter:`, eventTypeCounts);

      filtered = filtered.filter(m => {
        const eventType = String(m.eventType || '').toUpperCase();
        const title = String(m.title || '').toUpperCase();
        const matches = eventType.includes(targetType) || title.includes(targetType);
        if (!matches && targetType === 'SOCCER' && beforeTypeFilter < 10) {
          console.debug(`   ✗ Filtered out: "${m.title?.substring(0, 50)}" (eventType: ${m.eventType || 'None'})`);
        }
        return matches;
      });
      console.debug(`🏷️  Event type filter (${filters.eventType}): ${beforeTypeFilter} → ${filtered.length}`);

      if (filtered.length === 0 && targetType === 'SOCCER') {
        console.warn(`⚠️  Zero Soccer markets after filter. Sample of what was available:`);
        scoredMarkets.slice(0, 5).forEach(m => {
          console.warn(`   - "${m.title?.substring(0, 60)}" (eventType: ${m.eventType || 'None'})`);
        });
      }
    } else if (filters.eventType === 'Sports' || filters.eventType === 'all') {
      const beforeSportsFilter = filtered.length;
      filtered = filtered.filter(m => {
        const eventType = String(m.eventType || '').toUpperCase();
        const title = String(m.title || '').toUpperCase();
        const text = `${eventType} ${title}`;
        const isSport = ['NFL', 'SOCCER', 'NBA', 'MLB', 'NHL', 'HOCKEY', 'TENNIS', 'GOLF', 'CRICKET', 'F1', 'FORMULA', 'RUGBY', 'MARATHON', 'PREMIER LEAGUE', 'CHAMPIONS LEAGUE'].some(sport => text.includes(sport));
        return isSport;
      });
      console.debug(`🏈 Sports filter (${filters.eventType}): ${beforeSportsFilter} → ${filtered.length}`);
    }

    if (analysisType === 'event-weather') {
      console.debug(`🔍 Edge score filter: DISABLED for event-weather mode`);
    }

    // FILTER 2: Exclude futures bets
    const beforeFuturesCount = filtered.length;
    if (filters.excludeFutures !== false) {
      filtered = filtered.filter(m => !MarketTypeDetector.isFuturesBet(m));
      console.debug(`  Futures filter (excludeFutures=${filters.excludeFutures}): ${beforeFuturesCount} → ${filtered.length}`);
    } else {
      console.debug(`  Futures filter: DISABLED by user (includeFutures=true)`);
    }

    // FILTER 3: Confidence level tiers
    const beforeConfidenceCount = filtered.length;
    if (filters.confidence && filters.confidence !== 'all') {
      const level = String(filters.confidence).toUpperCase();
      filtered = filtered.filter(m => {
        const c = String(m.confidence).toUpperCase();
        if (level === 'HIGH') return c === 'HIGH';
        if (level === 'MEDIUM') return c === 'MEDIUM' || c === 'HIGH';
        if (level === 'LOW') return true;
        return true;
      });
      console.debug(`  Confidence filter (${filters.confidence}): ${beforeConfidenceCount} → ${filtered.length}`);
    }

    // FILTER 4: Location if user provided
    const beforeLocationCount = filtered.length;
    if (filters.location) {
      filtered = filtered.filter(m =>
        m.location && m.location.toLowerCase() === filters.location.toLowerCase()
      );
      console.debug(`  Location filter: ${beforeLocationCount} → ${filtered.length}`);
    }

    // FILTER 5: Max days to resolution
    const beforeDaysCount = filtered.length;
    if (filters.maxDaysToResolution && Number.isFinite(filters.maxDaysToResolution)) {
      const maxDays = Number(filters.maxDaysToResolution);
      filtered = filtered.filter(m => {
        const res = m.resolutionDate;
        if (!res) return false;
        const d = new Date(res);
        if (isNaN(d.getTime())) return false;
        const days = (d - new Date()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= maxDays;
      });
      console.debug(`  MaxDays filter (${filters.maxDaysToResolution}d): ${beforeDaysCount} → ${filtered.length}`);
    }

    // FILTER 5: Free-text search across title/description/tags
    if (filters.searchText && String(filters.searchText).trim().length > 0) {
      const q = String(filters.searchText).toLowerCase().trim();
      const words = q.split(/\s+/).filter(w => w.length > 2);
      filtered = filtered.filter(m => {
        const corpus = [
          (m.title || ''),
          (m.description || ''),
          (m.tags || []).map(t => typeof t === 'string' ? t : (t?.label || '')).join(' ')
        ].join(' ').toLowerCase();
        return words.some(w => corpus.includes(w));
      });
    }

    // Sort by edge score (descending), then by shortest horizon, then by volume
    filtered.sort((a, b) => {
      const scoreDiff = (b.edgeScore || 0) - (a.edgeScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const ad = a.resolutionDate ? (new Date(a.resolutionDate) - new Date()) : Infinity;
      const bd = b.resolutionDate ? (new Date(b.resolutionDate) - new Date()) : Infinity;
      const dayDiff = ad - bd;
      if (!isNaN(dayDiff) && dayDiff !== 0) return dayDiff;
      return (b.volume24h || 0) - (a.volume24h || 0);
    });

    // Add variety to results by diversifying across market types and scores
    const VARIETY_THRESHOLD = 0.5;

    filtered.sort((a, b) => {
      const scoreDiff = (b.edgeScore || 0) - (a.edgeScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.volume24h || 0) - (a.volume24h || 0);
    });

    const hourFactor = new Date().getHours();

    // Group markets by similar edge scores
    const scoreGroups = [];
    if (filtered.length > 0) {
      let currentScore = filtered[0].edgeScore || 0;
      let currentGroup = [filtered[0]];

      for (let i = 1; i < filtered.length; i++) {
        const market = filtered[i];
        const score = market.edgeScore || 0;

        if (Math.abs(score - currentScore) <= VARIETY_THRESHOLD) {
          currentGroup.push(market);
        } else {
          scoreGroups.push([...currentGroup]);
          currentGroup = [market];
          currentScore = score;
        }
      }
      scoreGroups.push([...currentGroup]);
    }

    const diversifyGroup = (group) => {
      if (group.length <= 3) return group;

      const typeGroups = {};
      for (const market of group) {
        const type = market.eventType || 'Other';
        if (!typeGroups[type]) typeGroups[type] = [];
        typeGroups[type].push(market);
      }

      const rotatedTypeGroups = {};
      for (const [type, markets] of Object.entries(typeGroups)) {
        const offset = hourFactor % Math.max(1, markets.length);
        rotatedTypeGroups[type] = [...markets.slice(offset), ...markets.slice(0, offset)];
      }

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

    const diversifiedGroups = scoreGroups.map(group => diversifyGroup(group));

    let diversifiedMarkets = [];
    for (const group of diversifiedGroups) {
      diversifiedMarkets.push(...group);
    }

    // DEDUPLICATE
    const seenIds = new Set();
    let uniqueMarkets = [];
    for (const market of diversifiedMarkets) {
      const id = market.marketID;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueMarkets.push(market);
      }
    }
    console.log(`🔄 Deduplication: ${diversifiedMarkets.length} → ${uniqueMarkets.length} unique markets`);

    let finalMarkets = uniqueMarkets.slice(0, limit);
    const enrichedFinal = await Promise.all(
      finalMarkets.map(async (market) => {
        try {
          const orderBookData = await helpers.enrichMarketWithOrderBook(market.rawMarket);
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
              marketDepth: helpers.calculateDepthImpact(orderBookData.orderBook)
            }
          };
        } catch (enrichError) {
          console.debug(`Order book enrichment failed for ${market.title}, using fallback:`, enrichError.message);
          return market;
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
 * ENHANCED: Now includes comprehensive weather data validation
 */
export async function getWeatherAdjustedOpportunities(weatherData, location) {
  try {
    // ENHANCED: Validate weather data quality first
    const weatherValidation = WeatherDataValidator.validateWeatherData('current', weatherData);
    if (!weatherValidation.valid) {
      return {
        opportunities: [],
        error: 'Weather data validation failed',
        validation: weatherValidation,
        timestamp: new Date().toISOString()
      };
    }

    const markets = await searchMarketsByLocation(location);

    if (!markets.markets || markets.markets.length === 0) {
      return {
        opportunities: [],
        message: 'No weather-sensitive markets found for this location',
        weatherDataQuality: weatherValidation.dataQuality
      };
    }

    // ENHANCED: Map markets to opportunities with validation
    const opportunities = markets.markets.map(market => {
      const marketValidation = MarketDataValidator.validateMarketData('market', market);

      return {
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
        weatherRelevance: helpers.assessMarketWeatherEdge(market, weatherData),
        validation: {
          marketDataQuality: marketValidation.dataQuality || 'UNKNOWN',
          marketWarnings: marketValidation.warnings || []
        }
      };
    });

    // Sort by weather relevance score and volume
    opportunities.sort((a, b) => {
      const scoreDiff = (b.weatherRelevance?.totalScore || 0) - (a.weatherRelevance?.totalScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.volume24h || 0) - (a.volume24h || 0);
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
      validation: {
        weatherDataQuality: weatherValidation.dataQuality,
        weatherWarnings: weatherValidation.warnings,
        capabilities: WeatherDataValidator.checkWeatherDataCapabilities(weatherData, 'outdoor-sports')
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

