#!/usr/bin/env node

/**
 * Test Sports Page Filtering
 * 
 * Simulates the exact flow of the /sports page:
 * 1. Fetch markets from Polymarket
 * 2. Apply filters (NFL, Soccer, confidence, volume)
 * 3. Score by event-weather analysis
 * 4. Display what would show on the page
 */

import { polymarketService } from '../services/polymarketService.js';

async function testSportsPageFiltering() {
  console.log('\n' + '='.repeat(100));
  console.log('🏟️  SPORTS PAGE FILTERING TEST');
  console.log('='.repeat(100) + '\n');

  // Test 1: NFL Markets
  console.log('📊 TEST 1: NFL Markets with event-weather analysis\n');
  console.log('-'.repeat(100));
  
  const nflFilters = {
    weatherData: null,
    location: null,
    eventType: 'NFL',
    confidence: 'MEDIUM',
    limitCount: 12,
    excludeFutures: true,
    searchText: null,
    maxDaysToResolution: 14,
    minVolume: 50000,
    analysisType: 'event-weather'
  };

  console.log('Filters:', JSON.stringify(nflFilters, null, 2));
  console.log('\nFetching markets...\n');

  try {
    const nflResult = await polymarketService.getTopWeatherSensitiveMarkets(12, nflFilters);
    
    console.log(`✅ Result:`, {
      marketsReturned: nflResult.markets?.length || 0,
      totalFound: nflResult.totalFound,
      hasError: !!nflResult.error
    });

    if (nflResult.markets && nflResult.markets.length > 0) {
      console.log(`\n✅ SUCCESSFULLY RETURNED ${nflResult.markets.length} NFL MARKETS\n`);
      console.log('First 5 markets:\n');
      nflResult.markets.slice(0, 5).forEach((m, i) => {
        console.log(`  [${i+1}] ${m.title}`);
        console.log(`      Type: ${m.eventType} | Score: ${m.edgeScore?.toFixed(1) || 0} | Confidence: ${m.confidence || 'UNKNOWN'}`);
        console.log(`      Volume: $${(m.volume24h || 0).toLocaleString()} | Location: ${m.eventLocation || 'NOT EXTRACTED'}\n`);
      });
    } else {
      console.log(`\n❌ FAILED: No NFL markets returned`);
      if (nflResult.message) console.log(`   Reason: ${nflResult.message}`);
      if (nflResult.noEdgesReason) console.log(`   Edge reason: ${nflResult.noEdgesReason}`);
    }
  } catch (err) {
    console.error(`\n❌ Error fetching NFL markets:`, err.message);
  }

  // Test 2: Soccer Markets
  console.log('\n' + '='.repeat(100));
  console.log('📊 TEST 2: Soccer Markets with event-weather analysis\n');
  console.log('-'.repeat(100));
  
  const soccerFilters = {
    weatherData: null,
    location: null,
    eventType: 'Soccer',
    confidence: 'MEDIUM',
    limitCount: 12,
    excludeFutures: true,
    searchText: null,
    maxDaysToResolution: 14,
    minVolume: 50000,
    analysisType: 'event-weather'
  };

  console.log('Filters:', JSON.stringify(soccerFilters, null, 2));
  console.log('\nFetching markets...\n');

  try {
    const soccerResult = await polymarketService.getTopWeatherSensitiveMarkets(12, soccerFilters);
    
    console.log(`✅ Result:`, {
      marketsReturned: soccerResult.markets?.length || 0,
      totalFound: soccerResult.totalFound,
      hasError: !!soccerResult.error
    });

    if (soccerResult.markets && soccerResult.markets.length > 0) {
      console.log(`\n✅ SUCCESSFULLY RETURNED ${soccerResult.markets.length} SOCCER MARKETS\n`);
      console.log('First 5 markets:\n');
      soccerResult.markets.slice(0, 5).forEach((m, i) => {
        console.log(`  [${i+1}] ${m.title}`);
        console.log(`      Type: ${m.eventType} | Score: ${m.edgeScore?.toFixed(1) || 0} | Confidence: ${m.confidence || 'UNKNOWN'}`);
        console.log(`      Volume: $${(m.volume24h || 0).toLocaleString()} | Location: ${m.eventLocation || 'NOT EXTRACTED'}\n`);
      });
    } else {
      console.log(`\n❌ FAILED: No Soccer markets returned`);
      if (soccerResult.message) console.log(`   Reason: ${soccerResult.message}`);
    }
  } catch (err) {
    console.error(`\n❌ Error fetching Soccer markets:`, err.message);
  }

  // Test 3: ALL Sports with event-weather
  console.log('\n' + '='.repeat(100));
  console.log('📊 TEST 3: All Sports with event-weather analysis\n');
  console.log('-'.repeat(100));
  
  const allSportsFilters = {
    weatherData: null,
    location: null,
    eventType: 'all',
    confidence: 'MEDIUM',
    limitCount: 12,
    excludeFutures: true,
    searchText: null,
    maxDaysToResolution: 14,
    minVolume: 50000,
    analysisType: 'event-weather'
  };

  console.log('Filters:', JSON.stringify(allSportsFilters, null, 2));
  console.log('\nFetching markets...\n');

  try {
    const allResult = await polymarketService.getTopWeatherSensitiveMarkets(12, allSportsFilters);
    
    console.log(`✅ Result:`, {
      marketsReturned: allResult.markets?.length || 0,
      totalFound: allResult.totalFound,
      hasError: !!allResult.error
    });

    if (allResult.markets && allResult.markets.length > 0) {
      console.log(`\n✅ SUCCESSFULLY RETURNED ${allResult.markets.length} TOTAL MARKETS\n`);
      
      // Group by type
      const byType = {};
      allResult.markets.forEach(m => {
        const type = m.eventType || 'UNKNOWN';
        if (!byType[type]) byType[type] = [];
        byType[type].push(m);
      });
      
      console.log('Markets by type:\n');
      Object.entries(byType).forEach(([type, markets]) => {
        console.log(`  ${type}: ${markets.length} markets`);
      });
      
      console.log('\nFirst 8 markets:\n');
      allResult.markets.slice(0, 8).forEach((m, i) => {
        console.log(`  [${i+1}] ${m.title.substring(0, 60)}...`);
        console.log(`      Type: ${m.eventType} | Score: ${m.edgeScore?.toFixed(1) || 0} | Confidence: ${m.confidence || 'UNKNOWN'}`);
        console.log(`      Volume: $${(m.volume24h || 0).toLocaleString()}\n`);
      });
    } else {
      console.log(`\n❌ FAILED: No markets returned`);
      if (allResult.message) console.log(`   Reason: ${allResult.message}`);
    }
  } catch (err) {
    console.error(`\n❌ Error fetching all markets:`, err.message);
  }

  // Test 4: Confidence filtering
  console.log('\n' + '='.repeat(100));
  console.log('📊 TEST 4: Confidence Level Impact\n');
  console.log('-'.repeat(100));
  
  const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW', 'all'];
  
  for (const confidence of confidenceLevels) {
    const filters = {
      weatherData: null,
      location: null,
      eventType: 'NFL',
      confidence: confidence,
      limitCount: 20,
      excludeFutures: true,
      analysisType: 'event-weather',
      minVolume: 50000
    };
    
    try {
      const result = await polymarketService.getTopWeatherSensitiveMarkets(20, filters);
      const count = result.markets?.length || 0;
      console.log(`  Confidence: ${confidence.padEnd(8)} → ${count.toString().padEnd(3)} markets`);
      
      if (count > 0) {
        const avgScore = result.markets.reduce((sum, m) => sum + (m.edgeScore || 0), 0) / count;
        const confs = [...new Set(result.markets.map(m => m.confidence))];
        console.log(`    Avg Score: ${avgScore.toFixed(1)} | Confidences: ${confs.join(', ')}`);
      }
    } catch (err) {
      console.log(`  Confidence: ${confidence.padEnd(8)} → ERROR: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

testSportsPageFiltering().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
