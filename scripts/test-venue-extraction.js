/**
 * Venue Extraction Testing Script
 * 
 * Tests the VenueExtractor service on real Polymarket data
 * Pulls live market data and validates venue extraction accuracy
 */

import axios from 'axios';
import { VenueExtractor } from '../services/venueExtractor.js';

// Sample of markets to test (variety of sports and types)
const TEST_LIMIT = 100;
const POLYMARKET_API = 'https://gamma-api.polymarket.com';

async function fetchMarkets() {
  try {
    console.log(`\n📊 Fetching ${TEST_LIMIT} markets from Polymarket...`);
    const response = await axios.get(`${POLYMARKET_API}/markets`, {
      params: {
        limit: TEST_LIMIT
      },
      timeout: 10000
    });
    
    // API returns array directly
    let markets = Array.isArray(response.data) ? response.data : (response.data.data || response.data);
    
    // Filter to only active markets with volume (more likely to have event data)
    markets = markets.filter(m => 
      m.active !== false && 
      (m.volume24hr > 0 || m.volume > 0) &&
      (m.category !== 'politics' || !m.question.includes('Biden')) // Skip old archived markets
    );
    
    return markets;
  } catch (error) {
    console.error('Failed to fetch markets:', error.message);
    return [];
  }
}

function categorizeResult(market, venue) {
  if (!venue) {
    return 'FAILED';
  }
  
  const title = (market.title || '').toLowerCase();
  const description = (market.description || '').toLowerCase();
  const combined = `${title} ${description}`.toLowerCase();
  
  // Check if extracted venue appears in market data
  const venueLower = venue.toLowerCase();
  if (combined.includes(venueLower.split(',')[0])) {
    return 'SUCCESS';
  }
  
  return 'PARTIAL'; // Extracted something, unclear if correct
}

async function runTests() {
  console.log('🏟️  Venue Extraction Accuracy Test\n');
  console.log('='.repeat(80));
  
  const markets = await fetchMarkets();
  
  if (markets.length === 0) {
    console.log('❌ No markets fetched. Cannot run tests.');
    process.exit(1);
  }
  
  console.log(`✅ Fetched ${markets.length} live markets\n`);
  
  // Track results
  const results = {
    SUCCESS: [],
    PARTIAL: [],
    FAILED: []
  };
  
  let processed = 0;
  
  console.log('Processing markets...\n');
  
  for (const market of markets) {
    processed++;
    const venue = VenueExtractor.extractFromMarket(market);
    const category = categorizeResult(market, venue);
    
    results[category].push({
      title: market.title || market.question || 'Unknown',
      venue: venue || 'N/A',
      eventType: market.eventType || 'Unknown',
      teams: market.teams || [],
      market
    });
    
    if (processed % 10 === 0) {
      process.stdout.write(`  Processed: ${processed}/${markets.length}\r`);
    }
  }
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📈 RESULTS SUMMARY\n');
  
  const successRate = ((results.SUCCESS.length / markets.length) * 100).toFixed(1);
  const partialRate = ((results.PARTIAL.length / markets.length) * 100).toFixed(1);
  const failRate = ((results.FAILED.length / markets.length) * 100).toFixed(1);
  
  console.log(`Total Markets Tested: ${markets.length}`);
  console.log(`✅ SUCCESS (clear venue):    ${results.SUCCESS.length} (${successRate}%)`);
  console.log(`⚠️  PARTIAL (extracted):      ${results.PARTIAL.length} (${partialRate}%)`);
  console.log(`❌ FAILED (no venue found):   ${results.FAILED.length} (${failRate}%)`);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('🎯 SUCCESS CASES (Sample of 5)\n');
  results.SUCCESS.slice(0, 5).forEach((item, idx) => {
    console.log(`${idx + 1}. "${item.title.substring(0, 60)}..."`);
    console.log(`   📍 Extracted: ${item.venue}`);
    if (item.eventType) console.log(`   🏆 Event Type: ${item.eventType}`);
    if (item.teams.length > 0) console.log(`   👥 Teams: ${item.teams.join(', ')}`);
    console.log();
  });
  
  console.log(`${'='.repeat(80)}`);
  console.log('⚠️  PARTIAL CASES (Sample of 5)\n');
  results.PARTIAL.slice(0, 5).forEach((item, idx) => {
    console.log(`${idx + 1}. "${item.title.substring(0, 60)}..."`);
    console.log(`   📍 Extracted: ${item.venue}`);
    if (item.eventType) console.log(`   🏆 Event Type: ${item.eventType}`);
    if (item.teams.length > 0) console.log(`   👥 Teams: ${item.teams.join(', ')}`);
    console.log();
  });
  
  console.log(`${'='.repeat(80)}`);
  console.log('❌ FAILED CASES (Sample of 5)\n');
  results.FAILED.slice(0, 5).forEach((item, idx) => {
    console.log(`${idx + 1}. "${item.title.substring(0, 70)}"`);
    if (item.eventType) console.log(`   🏆 Event Type: ${item.eventType}`);
    if (item.teams.length > 0) console.log(`   👥 Teams: ${item.teams.join(', ')}`);
    console.log(`   💡 Suggestion: ${generateSuggestion(item)}`);
    console.log();
  });
  
  // Analytics by event type
  console.log(`${'='.repeat(80)}`);
  console.log('📊 BREAKDOWN BY EVENT TYPE\n');
  
  const byType = {};
  markets.forEach(market => {
    const type = market.eventType || 'Unknown';
    if (!byType[type]) byType[type] = { total: 0, success: 0 };
    byType[type].total++;
  });
  
  results.SUCCESS.forEach(item => {
    const type = item.eventType || 'Unknown';
    if (byType[type]) byType[type].success++;
  });
  
  Object.entries(byType)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([type, stats]) => {
      const rate = ((stats.success / stats.total) * 100).toFixed(0);
      const bar = '█'.repeat(Math.round(rate / 5)) + '░'.repeat(20 - Math.round(rate / 5));
      console.log(`${type.padEnd(20)} [${bar}] ${rate}% (${stats.success}/${stats.total})`);
    });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('💡 RECOMMENDATIONS\n');
  
  if (successRate < 60) {
    console.log('⚠️  Low success rate detected. Recommendations:');
    console.log('   1. Expand team-to-city mapping for international teams');
    console.log('   2. Improve regex patterns for venue extraction from titles');
    console.log('   3. Pre-populate market.eventLocation during catalog build');
    console.log('   4. Consider using market.group or market.category hints');
  } else if (successRate < 80) {
    console.log('✓ Reasonable success rate. Can improve with:');
    console.log('   1. Add more international team mappings');
    console.log('   2. Enhance description parsing for venue keywords');
    console.log('   3. Monitor failed cases for patterns');
  } else {
    console.log('✅ Strong venue extraction accuracy! Consider:');
    console.log('   1. Pre-computing venues during catalog build for speed');
    console.log('   2. Caching venue-weather pairs');
    console.log('   3. Adding venue metadata to market cards');
  }
  
  // Data quality insights
  const withTeams = markets.filter(m => m.teams && m.teams.length > 0).length;
  const withEventType = markets.filter(m => m.eventType).length;
  const withDescription = markets.filter(m => m.description).length;
  
  console.log(`\n📋 Data Quality Insights\n`);
  console.log(`Markets with teams data:      ${withTeams}/${markets.length} (${((withTeams/markets.length)*100).toFixed(0)}%)`);
  console.log(`Markets with eventType:       ${withEventType}/${markets.length} (${((withEventType/markets.length)*100).toFixed(0)}%)`);
  console.log(`Markets with description:     ${withDescription}/${markets.length} (${((withDescription/markets.length)*100).toFixed(0)}%)`);
  
  console.log(`\n${'='.repeat(80)}\n`);
}

function generateSuggestion(item) {
  if (!item.title || item.title.length === 0) {
    return 'Title is empty or missing';
  }
  
  const title = item.title.toLowerCase();
  
  if (title.includes('will') || title.includes('can') || title.includes('able')) {
    return 'Market is outcome-focused (not location-specific)';
  }
  
  if (title.includes('crypto') || title.includes('btc') || title.includes('eth')) {
    return 'Cryptocurrency market (no venue location)';
  }
  
  if (title.includes('election') || title.includes('vote') || title.includes('president')) {
    return 'Political market (no venue location)';
  }
  
  if (title.includes('weather') && !title.includes('game')) {
    return 'Pure weather market (not event-specific)';
  }
  
  return 'Consider adding venue hints to market metadata';
}

runTests().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
