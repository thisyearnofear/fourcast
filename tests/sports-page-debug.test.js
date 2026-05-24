import { describe, it, expect } from 'vitest';
import { polymarketService } from '../services/polymarketService.js';

// Debug/exploratory tests that make live Polymarket API calls.
// These are useful for manual debugging but shouldn't run in CI.
const runLiveTests = process.env.RUN_LIVE_API_TESTS === 'true';

describe('Sports Page Market Fetching - Debug', () => {
  (runLiveTests ? it : it.skip)('should demonstrate the market catalog building process', async () => {
    console.log('\n🔍 Starting market catalog build for NFL...\n');
    
    const catalogResult = await polymarketService.buildMarketCatalog(50000, 'NFL');
    
    console.log(`\n📊 Catalog Result:`, {
      totalMarkets: catalogResult.markets?.length || 0,
      error: catalogResult.error,
      cached: catalogResult.cached,
      timestamp: catalogResult.timestamp
    });
    
    if (catalogResult.markets && catalogResult.markets.length > 0) {
      console.log(`\n📋 Sample markets (first 3):`);
      catalogResult.markets.slice(0, 3).forEach((m, i) => {
        console.log(`\n  [${i}] "${m.title}"`);
        console.log(`      Type: ${m.eventType || 'UNKNOWN'}`);
        console.log(`      Location: ${m.location || 'UNKNOWN'}`);
        console.log(`      Volume: $${m.volume24h || 0}`);
        console.log(`      Tags: ${JSON.stringify(m.tags)}`);
      });
    } else {
      console.log('\n❌ NO MARKETS RETURNED FROM CATALOG');
    }
    
    expect(catalogResult).toBeDefined();
  });

  it('should score markets and filter by event-weather criteria', async () => {
    console.log('\n⚡ Testing event-weather analysis scoring...\n');
    
    // Create a mock NFL market
    const nflMarket = {
      marketID: 'test-1',
      title: 'Will Kansas City Chiefs beat Denver Broncos?',
      description: 'NFL game',
      tags: ['NFL'],
      eventType: 'NFL',
      volume24h: 150000,
      liquidity: 50000,
      resolutionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    // Score it with no weather data (simulating venue extraction failure)
    const score = polymarketService.assessMarketWeatherEdge(nflMarket, null);
    
    console.log(`\n📈 Edge Assessment (NFL market, no weather):`, {
      totalScore: score.totalScore,
      confidence: score.confidence,
      factors: score.factors,
      isWeatherSensitive: score.isWeatherSensitive
    });
    
    expect(score).toBeDefined();
    expect(score.factors).toBeDefined();
    console.log(`\n✓ Scoring works for NFL markets`);
  });

  it('should demonstrate the filter logic for /sports page', () => {
    console.log('\n🎯 Testing market filtering logic for /sports page...\n');
    
    // Simulate scored markets from different categories
    const scoredMarkets = [
      { title: 'NFL Game', eventType: 'NFL', edgeScore: 0, confidence: 'MEDIUM', volume24h: 100000 },
      { title: 'Soccer Match', eventType: 'Soccer', edgeScore: 0.5, confidence: 'HIGH', volume24h: 80000 },
      { title: 'Tennis Tournament', eventType: 'Tennis', edgeScore: 0, confidence: 'LOW', volume24h: 50000 },
      { title: 'Weather Market', eventType: null, edgeScore: 2, confidence: 'HIGH', volume24h: 200000 },
      { title: 'Crypto Market', eventType: null, edgeScore: 0, confidence: 'LOW', volume24h: 500000 },
    ];
    
    const analysisType = 'event-weather';
    
    const filtered = scoredMarkets.filter(m => {
      // Same logic from polymarketService.js
      if (analysisType === 'event-weather') {
        const eventType = String(m.eventType || '').toUpperCase();
        const isSupported = ['NFL', 'SOCCER', 'NBA', 'MLB', 'HOCKEY', 'TENNIS', 'GOLF', 'CRICKET', 'F1'].some(sport => eventType.includes(sport));
        return m.edgeScore > 0 || isSupported;
      }
      return m.edgeScore > 0;
    });
    
    console.log(`\n📊 Filter Results:`);
    console.log(`   Input: ${scoredMarkets.length} markets`);
    console.log(`   Output: ${filtered.length} markets`);
    console.log(`\n   Included:`);
    filtered.forEach(m => {
      console.log(`     ✓ ${m.title} (type: ${m.eventType}, score: ${m.edgeScore})`);
    });
    
    console.log(`\n   Excluded:`);
    scoredMarkets.filter(m => !filtered.includes(m)).forEach(m => {
      console.log(`     ✗ ${m.title} (type: ${m.eventType}, score: ${m.edgeScore})`);
    });
    
    // For /sports page with event-weather, we should get 3 sports + 1 high-score weather = 4 markets
    expect(filtered.length).toBe(4);
    expect(filtered.some(m => m.title === 'NFL Game')).toBe(true);
    expect(filtered.some(m => m.title === 'Crypto Market')).toBe(false);
  });

  it('should show what metadata extraction detects for market titles', () => {
    console.log('\n🏷️  Testing metadata extraction...\n');
    
    const testMarkets = [
      'Will Kansas City Chiefs beat Denver Broncos?',
      'Liverpool FC vs Manchester United - who wins?',
      'NFL game at Arrowhead Stadium: Chiefs vs Broncos',
      'Premier League: Liverpool to score first',
      'Bitcoin to hit $100k in 2025'
    ];
    
    testMarkets.forEach(title => {
      const metadata = polymarketService.extractMarketMetadata(title, []);
      console.log(`\n📍 "${title}"`);
      console.log(`   → Location: ${metadata.location || 'NOT FOUND'}`);
      console.log(`   → Event Type: ${metadata.event_type || 'NOT DETECTED'}`);
      console.log(`   → Teams: ${metadata.teams.length > 0 ? metadata.teams.join(', ') : 'NONE'}`);
    });
  });
});
