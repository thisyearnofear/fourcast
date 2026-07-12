// Polymarket Helpers — shared utility functions
// Extracted from PolymarketService class methods

import axios from 'axios';
import { cache } from './polymarketCache.js';

/**
 * Phase 2: Assess market weather edge potential
 * Scores markets by 4 relevance factors:
 * 1. weatherDirect: Market explicitly about weather
 * 2. weatherSensitiveEvent: Outdoor events affected by weather (sports, etc)
 * 3. contextualWeatherImpact: Event location weather vs market odds relationship
 * 4. asymmetrySignal: Information asymmetry detection (odds don't reflect weather clarity)
 * ROADMAP: Used by getTopWeatherSensitiveMarkets() for ranking
 */
export function assessMarketWeatherEdge(market, weatherData = null) {
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
  const sportEvents = ['nfl', 'nba', 'mlb', 'golf', 'tennis', 'cricket', 'soccer', 'rugby', 'f1', 'formula 1'];
  const type = String(market.eventType || market.event_type || '').toLowerCase();
  const teams = Array.isArray(market.teams) ? market.teams : [];
  const isSportByType = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'golf', 'tennis', 'f1', 'formula 1', 'cricket', 'rugby', 'marathon'].includes(type);
  const isSportByTeams = teams.length > 0;
  const isSportEvent = isSportByType || isSportByTeams || sportEvents.some(sport => title.includes(sport) || tags.includes(sport));
  const isOutdoorEvent = title.includes('marathon') || title.includes('race') || isSportEvent;

  if (isOutdoorEvent) {
    weatherSensitiveEvent = 2;
  }

  // Factor 3: Contextual Weather Impact
  let contextualWeatherImpact = 0;
  if (isOutdoorEvent && weatherData?.current) {
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
  let asymmetrySignal = 0;
  const volume = market.volume24h || market.volumeMetrics?.vol24h || 0;
  const liquidity = market.liquidity || market.marketEfficiency?.liquidityScore || 0;
  const volumeTrend = market.volumeMetrics?.volumeTrend || 0;
  const spreadPercent = market.oddsAnalysis?.spreadPercent || market.orderBookMetrics?.spreadPercent || 0;

  if (volume > 0 && liquidity > 0) {
    const volumeLiquidityRatio = volume / liquidity;
    if (volumeLiquidityRatio > 2) asymmetrySignal += 1;
    if (volumeLiquidityRatio > 5) asymmetrySignal += 0.5;
  }

  if (volumeTrend > 50) {
    asymmetrySignal += 1.5;
  } else if (volumeTrend > 25) {
    asymmetrySignal += 1;
  }

  if (spreadPercent > 2) {
    asymmetrySignal += 0.5;
  } else if (spreadPercent > 5) {
    asymmetrySignal += 1;
  }

  const volatilityScore = market.marketEfficiency?.volatilityScore || 0;
  if (volatilityScore > 0.1 && volumeTrend < 10) {
    asymmetrySignal += 0.5;
  }

  let totalScore = weatherDirect + weatherSensitiveEvent + contextualWeatherImpact;
  if (totalScore > 0) {
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
 * Assessment for discovery mode: Score markets by efficiency, not weather
 * Used by /discovery page to rank markets regardless of location
 */
export function assessMarketEfficiency(market) {
  let totalScore = 0;
  const factors = {};

  // Factor 1: Volume (higher volume = more liquid, more tradeable)
  const volume = market.volume24h || 0;
  let volumeScore = 0;
  if (volume > 500000) volumeScore = 3;
  else if (volume > 100000) volumeScore = 2;
  else if (volume > 50000) volumeScore = 1;
  factors.volumeScore = volumeScore;
  totalScore += volumeScore;

  // Factor 2: Liquidity (depth of order book)
  const liquidity = market.liquidity || 0;
  let liquidityScore = 0;
  if (liquidity > 100000) liquidityScore = 2;
  else if (liquidity > 50000) liquidityScore = 1;
  factors.liquidityScore = liquidityScore;
  totalScore += liquidityScore;

  // Factor 3: Volatility/Trend (markets with movement are more interesting)
  const volumeTrend = market.volumeMetrics?.volumeTrend || 0;
  let volatilityScore = 0;
  if (Math.abs(volumeTrend) > 50) volatilityScore = 2;
  else if (Math.abs(volumeTrend) > 25) volatilityScore = 1;
  factors.volatilityScore = volatilityScore;
  totalScore += volatilityScore;

  // Factor 4: Spread (tight spreads = more efficient market)
  const spreadPercent = market.oddsAnalysis?.spreadPercent || market.orderBookMetrics?.spreadPercent || 5;
  let spreadScore = 0;
  if (spreadPercent < 1) spreadScore = 2;
  else if (spreadPercent < 2) spreadScore = 1;
  factors.spreadScore = spreadScore;
  totalScore += spreadScore;

  // Confidence: Based on market depth and liquidity
  let confidence = 'LOW';
  if (liquidity > 50000 && volume > 100000) confidence = 'HIGH';
  else if (liquidity > 20000 || volume > 50000) confidence = 'MEDIUM';

  return {
    totalScore: Math.min(totalScore, 10),
    factors,
    isWeatherSensitive: false,
    confidence
  };
}

/**
 * Assess how relevant weather is to a given market
 * IMPROVED: Now uses actual weather conditions from weatherData parameter
 * Returns both relevance score and weather context for analysis
 */
export function assessWeatherRelevance(market, weatherData) {
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
    condition_match: (
      (precipChance && precipChance > 30) && (title.includes('rain') || title.includes('snow')) ? 1 : 0
    )
  };

  const score = Object.values(weatherImpactFactors).reduce((a, b) => a + b, 0);

  return {
    score: Math.min(score, 10),
    factors: weatherImpactFactors,
    isWeatherSensitive: score > 0,
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

export function normalizeTags(tags) {
  const arr = Array.isArray(tags) ? tags : [];
  return arr.map(t => {
    if (typeof t === 'string') return t.toLowerCase();
    if (t && typeof t === 'object' && t.label) return String(t.label).toLowerCase();
    return '';
  }).filter(Boolean);
}

export function filterByWeatherTheme(markets, theme) {
  const th = (theme || 'all').toLowerCase();
  if (th === 'all') return markets;
  const sportKeywords = ['nfl', 'nba', 'mlb', 'soccer', 'tennis', 'golf', 'cricket', 'rugby', 'marathon', 'race'];
  const outdoorKeywords = ['marathon', 'race', 'festival', 'concert', 'outdoor'];
  const aviationKeywords = ['flight', 'airport', 'delay', 'storm', 'airline'];
  const energyKeywords = ['grid', 'power', 'electricity', 'oil', 'gas', 'energy', 'utility'];
  const agricultureKeywords = ['harvest', 'crop', 'yield', 'agriculture', 'wheat', 'corn', 'soy'];
  const weatherKeywords = ['weather', 'rain', 'snow', 'wind', 'temperature', 'heat', 'cold', 'humidity', 'storm'];
  const matchAny = (text, words) => words.some(w => text.includes(w));
  return (markets || []).filter(m => {
    const title = (m.title || m.question || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();
    const tags = normalizeTags(m.tags);
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
 * Calculate order cost (price * size) + fees
 * Useful for UX: show "You will spend X USDC"
 */
export function calculateOrderCost(price, size, feeRateBps = 0) {
  const baseCost = price * size;
  const fee = baseCost * (feeRateBps / 10000);
  return {
    baseCost: baseCost.toFixed(2),
    fee: fee.toFixed(2),
    total: (baseCost + fee).toFixed(2)
  };
}

/**
 * Calculate capital required to move market odds significantly
 * Useful for assessing market depth and edge potential
 */
export function calculateDepthImpact(orderBook, targetMovement = 0.05) {
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
 * Fallback enrichment when order book API is unavailable
 * Uses available market fields to calculate similar metrics
 * Prefers outcomePrices from /events endpoint
 */
export function enrichMarketWithAvailableData(marketData) {
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
 * Phase 1: Enrich market with order book and depth analytics
 * Fetches order book data and calculates rich metrics for edge detection
 * Uses clobTokenIds from market data (array of outcome token IDs)
 */
export async function enrichMarketWithOrderBook(marketData) {
  try {
    // Extract token IDs - market data provides clobTokenIds as JSON string or array
    let tokenIds = marketData?.clobTokenIds;

    // Parse if it's a string
    if (typeof tokenIds === 'string') {
      try {
        tokenIds = JSON.parse(tokenIds);
      } catch (e) {
        console.debug('Failed to parse clobTokenIds for market', marketData?.id, ':', e.message);
        return enrichMarketWithAvailableData(marketData);
      }
    }

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      console.debug('No clobTokenIds available for market:', marketData?.id, 'using fallback');
      return enrichMarketWithAvailableData(marketData);
    }

    // Fetch order book for first outcome (YES token)
    const yesTokenId = tokenIds[0];
    if (!yesTokenId) {
      console.debug('Token ID is empty for market:', marketData?.id);
      return enrichMarketWithAvailableData(marketData);
    }

    let orderBook;
    try {
      const orderBookResponse = await axios.get(`${cache.clobBaseURL}/book`, {
        params: { token_id: yesTokenId },
        timeout: 5000,
        headers: {
          'User-Agent': 'weather-edge-bot/1.0'
        }
      });
      orderBook = orderBookResponse.data;
    } catch (bookError) {
      if (bookError.response?.status === 429) {
        console.debug('Rate limited on order book fetch, will use fallback');
        return enrichMarketWithAvailableData(marketData);
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
        volumeTrend,
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
    return enrichMarketWithAvailableData(marketData);
  }
}

/**
 * Extract location information from market title
 */
export function extractLocation(marketTitle) {
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
export function extractMarketMetadata(marketTitle, tags = []) {
  if (!marketTitle) return {};

  const metadata = {
    location: extractLocation(marketTitle),
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

  // Map common tag labels to event types
  const tagToEventType = {
    'nfl': 'NFL', 'nba': 'NBA', 'mlb': 'MLB', 'nhl': 'NHL',
    'golf': 'Golf', 'tennis': 'Tennis', 'soccer': 'Soccer',
    'football': 'Soccer', 'cricket': 'Cricket', 'rugby': 'Rugby',
    'f1': 'F1', 'formula 1': 'F1', 'weather': 'Weather', 'sports': 'Sports'
  };

  for (const [tag, eventType] of Object.entries(tagToEventType)) {
    if (tagLabels.includes(tag)) {
      metadata.event_type = eventType;
      break;
    }
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
    { pattern: /pistons|detroit pistons/i, team: 'Detroit Pistons', sport: 'NBA' },
    { pattern: /cavaliers|cleveland cavaliers/i, team: 'Cleveland Cavaliers', sport: 'NBA' },
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
