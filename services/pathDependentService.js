/**
 * Path-Dependent Market Analysis
 * Novel use case: "BTC touches $60K before $65K?"
 * 
 * Uses SynthData percentiles to calculate path probabilities
 * based on volatility and price distribution shape
 */

import { synthService } from './synthService.js';

/**
 * Calculate probability of touching priceA before priceB
 * Uses percentile distribution to estimate path likelihood
 * 
 * @param {string} asset - Asset code (BTC, ETH, etc.)
 * @param {number} currentPrice - Current asset price
 * @param {number} priceA - First target price
 * @param {number} priceB - Second target price
 * @param {string} horizon - Time horizon ('24h', '1h')
 * @returns {Object} Path probability analysis
 */
export async function analyzePathDependentMarket(asset, currentPrice, priceA, priceB, horizon = '24h') {
  // Fetch Synth data
  const forecast = await synthService.buildForecast(asset, { horizon });
  if (!forecast) {
    return { error: 'Unable to fetch forecast data' };
  }

  const { percentiles, volatility } = forecast;
  const { p5, p50, p95, raw } = percentiles;

  // Determine direction
  const isALower = priceA < currentPrice;
  const isBLower = priceB < currentPrice;
  
  // Calculate probability mass in each direction
  const percentilesBelow = raw.filter(p => p.price < currentPrice);
  const percentilesAbove = raw.filter(p => p.price > currentPrice);
  
  const downwardProb = percentilesBelow.length / raw.length;
  const upwardProb = percentilesAbove.length / raw.length;

  // Path-dependent logic
  let touchAFirst, touchBFirst;
  
  if (isALower && isBLower) {
    // Both targets below current price
    const distA = Math.abs(currentPrice - priceA);
    const distB = Math.abs(currentPrice - priceB);
    
    // Closer target more likely to hit first
    touchAFirst = distB / (distA + distB);
    touchBFirst = distA / (distA + distB);
    
  } else if (!isALower && !isBLower) {
    // Both targets above current price
    const distA = Math.abs(priceA - currentPrice);
    const distB = Math.abs(priceB - currentPrice);
    
    touchAFirst = distB / (distA + distB);
    touchBFirst = distA / (distA + distB);
    
  } else {
    // Targets on opposite sides
    if (isALower) {
      // A below, B above
      touchAFirst = downwardProb;
      touchBFirst = upwardProb;
    } else {
      // A above, B below
      touchAFirst = upwardProb;
      touchBFirst = downwardProb;
    }
  }

  // Volatility adjustment
  const volRatio = volatility.forecast / volatility.realized;
  let confidence = 'MEDIUM';
  
  if (volRatio > 1.5) {
    // High volatility = more likely to touch both
    confidence = 'LOW';
  } else if (volRatio < 0.8) {
    // Low volatility = more predictable path
    confidence = 'HIGH';
  }

  // Edge magnitude adjustment
  const edgeMagnitude = Math.abs(touchAFirst - touchBFirst);
  if (edgeMagnitude < 0.1) {
    confidence = 'LOW'; // Too close to call
  }

  return {
    asset,
    currentPrice,
    priceA,
    priceB,
    horizon,
    probabilities: {
      touchAFirst: Math.round(touchAFirst * 100),
      touchBFirst: Math.round(touchBFirst * 100),
    },
    confidence,
    reasoning: generateReasoning(asset, currentPrice, priceA, priceB, touchAFirst, touchBFirst, volRatio),
    percentileData: { p5, p50, p95 },
    volatility: {
      forecast: volatility.forecast,
      realized: volatility.realized,
      ratio: volRatio,
    },
    source: 'synthdata',
    timestamp: Date.now(),
  };
}

function generateReasoning(asset, current, priceA, priceB, probA, probB, volRatio) {
  const winner = probA > probB ? 'A' : 'B';
  const winnerPrice = winner === 'A' ? priceA : priceB;
  const loserPrice = winner === 'A' ? priceB : priceA;
  
  const direction = winnerPrice > current ? 'upward' : 'downward';
  const volContext = volRatio > 1.5 
    ? 'High volatility increases path uncertainty' 
    : volRatio < 0.8 
    ? 'Low volatility suggests predictable movement'
    : 'Moderate volatility';
  
  return `${asset} more likely to touch $${winnerPrice.toLocaleString()} before $${loserPrice.toLocaleString()} based on ${direction} probability mass in Synth percentile distribution. ${volContext}.`;
}

/**
 * Detect path-dependent market from title
 * Examples:
 * - "BTC touches 60K before 65K"
 * - "ETH hits $2000 before $2500"
 * - "Will NVDA reach 500 before 450?"
 */
export function detectPathDependentMarket(title) {
  const patterns = [
    /(\w+).*?(\d+[,\d]*\.?\d*)[kK]?\s*before\s*(\d+[,\d]*\.?\d*)[kK]?/i,
    /(\w+).*?touch.*?(\d+[,\d]*\.?\d*)[kK]?\s*before\s*(\d+[,\d]*\.?\d*)[kK]?/i,
    /(\w+).*?hit.*?(\d+[,\d]*\.?\d*)[kK]?\s*before\s*(\d+[,\d]*\.?\d*)[kK]?/i,
    /(\w+).*?reach.*?(\d+[,\d]*\.?\d*)[kK]?\s*before\s*(\d+[,\d]*\.?\d*)[kK]?/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const [, assetHint, priceAStr, priceBStr] = match;
      
      // Parse prices (handle 'k' suffix)
      const priceA = parsePrice(priceAStr);
      const priceB = parsePrice(priceBStr);
      
      // Detect asset
      const asset = synthService.detectAsset(title);
      
      if (asset && priceA && priceB) {
        return { asset, priceA, priceB, detected: true };
      }
    }
  }
  
  return { detected: false };
}

function parsePrice(str) {
  const cleaned = str.replace(/,/g, '');
  const num = parseFloat(cleaned);
  
  // Handle 'k' suffix
  if (str.toLowerCase().includes('k')) {
    return num * 1000;
  }
  
  return num;
}
