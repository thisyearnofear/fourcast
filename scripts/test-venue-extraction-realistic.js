/**
 * Realistic Venue Extraction Testing
 * 
 * Tests on actual market titles from Polymarket API
 * Focuses on what can be extracted from titles/descriptions (no eventType/teams yet)
 */

import axios from 'axios';
import { VenueExtractor } from '../services/venueExtractor.js';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

// Markets we'll manually check extraction against
const EXPECTED_RESULTS = {
  'Will the Seahawks or the Rams win their week 10 NFL matchup?': 'Seattle, WA or Los Angeles, CA',
  'Will the Titans or the Ravens win their January 10th NFL Wild Card matchup?': 'Nashville, TN or Baltimore, MD',
  'Will the Chiefs win Super Bowl LV?': 'Kansas City, MO',
  'Will the Lakers win the 2020 NBA Finals?': 'Los Angeles, CA',
  'Will the Dodgers win the 2024 World Series?': 'Los Angeles, CA',
  'Will Man City win the Premier League title in 2024-25?': 'Manchester, England',
  'Will Barcelona win La Liga in 2024-25?': 'Barcelona, Spain',
};

async function fetchLiveMarkets() {
  try {
    console.log('📊 Fetching live markets from Polymarket...');
    const response = await axios.get(`${POLYMARKET_API}/markets?limit=300`, {
      timeout: 10000
    });
    
    let markets = Array.isArray(response.data) ? response.data : (response.data.data || response.data);
    
    // Filter to markets that look like sports
    markets = markets.filter(m => {
      const q = (m.question || '').toLowerCase();
      return q.match(/(nfl|nba|mlb|nhl|soccer|football|basketball|baseball|cricket|rugby|tennis|golf|f1|formula|championship|league|cup|win|match|game|series)/i);
    });
    
    return markets;
  } catch (error) {
    console.error('Failed to fetch:', error.message);
    return [];
  }
}

function analyzeExtraction(title, venue) {
  // Simple heuristics to gauge if extraction is "reasonable"
  
  if (!venue) {
    return 'FAILED';
  }
  
  const titleLower = title.toLowerCase();
  const venueLower = venue.toLowerCase();
  
  // Filter out obvious junk extractions
  const junkPatterns = ['their', 'the ', 'a ', 'this ', 'that ', 'good '];
  for (const junk of junkPatterns) {
    if (venueLower.startsWith(junk)) {
      return 'FAILED'; // Extracted junk word
    }
  }
  
  // Check if it looks like a real city/state or city/country format
  // Matches: "City, ST" (US) or "City, Country" (International)
  if (!venueLower.match(/[a-z\s]+,\s*[a-z\s]+/i)) {
    // Doesn't look like "City, State/Country" format
    return 'PARTIAL';
  }

  // Check if venue keywords appear in title
  const parts = venueLower.split(',');
  for (const part of parts) {
    const city = part.trim();
    if (city.length < 3) continue;
    if (titleLower.includes(city)) {
      return 'SUCCESS';
    }
  }

  // Check for team names that map to the venue (NFL, NBA, EPL, etc)
  const knownTeams = [
    // NFL
    'chiefs', 'patriots', 'cowboys', 'packers', 'steelers', 
    '49ers', 'niners', 'broncos', 'seahawks', 'lakers', 'celtics',
    'warriors', 'heat', 'bulls', 'yankees', 'red sox', 'dodgers',
    'rams', 'lions', 'bears', 'vikings', 'dolphins', 'bills',
    'titans', 'ravens', 'browns', 'bengals', 'texans',
    'colts', 'jaguars', 'chargers', 'raiders',
    'cardinals', 'buccaneers', 'saints', 'falcons', 'panthers',
    // EPL / Soccer
    'manchester united', 'man united', 'manchester city', 'man city',
    'liverpool', 'chelsea', 'arsenal', 'tottenham', 'spurs',
    'newcastle', 'brighton', 'crystal palace', 'fulham', 'west ham',
    'aston villa', 'everton', 'leicester', 'leeds', 'southampton',
    'nottingham', 'bournemouth', 'wolves', 'wolverhampton', 'brentford',
    'ipswich'
  ];
  
  for (const team of knownTeams) {
    if (titleLower.includes(team)) {
      return 'SUCCESS'; // Extracted via team mapping
    }
  }

  return 'PARTIAL';
}

async function runRealisticTest() {
  console.log('\n🏟️  Realistic Venue Extraction Test\n');
  console.log('='.repeat(80));
  
  const markets = await fetchLiveMarkets();
  
  if (markets.length === 0) {
    console.log('⚠️  No sports markets found in live API');
    console.log('Will test with sample titles instead...\n');
    await testWithSampleTitles();
    return;
  }
  
  console.log(`✅ Found ${markets.length} sports-related markets\n`);
  
  const results = {
    SUCCESS: [],
    PARTIAL: [],
    FAILED: []
  };
  
  console.log('Processing markets...\n');
  
  for (const market of markets) {
    const title = market.question || market.title || '';
    const venue = VenueExtractor.extractFromMarket(market);
    const status = analyzeExtraction(title, venue);
    
    results[status].push({
      title,
      venue: venue || 'N/A',
      market
    });
  }
  
  // Show results
  const total = markets.length;
  console.log(`\n${'='.repeat(80)}\n`);
  console.log('📊 RESULTS\n');
  console.log(`Total Markets Tested: ${total}`);
  console.log(`✅ SUCCESS:  ${results.SUCCESS.length} (${((results.SUCCESS.length/total)*100).toFixed(1)}%)`);
  console.log(`⚠️  PARTIAL:   ${results.PARTIAL.length} (${((results.PARTIAL.length/total)*100).toFixed(1)}%)`);
  console.log(`❌ FAILED:    ${results.FAILED.length} (${((results.FAILED.length/total)*100).toFixed(1)}%)`);
  
  console.log(`\n${'='.repeat(80)}\n`);
  console.log('✅ SUCCESS CASES (First 10)\n');
  
  results.SUCCESS.slice(0, 10).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title.substring(0, 70)}`);
    console.log(`   📍 ${item.venue}\n`);
  });
  
  console.log(`${'='.repeat(80)}\n`);
  console.log('⚠️  PARTIAL CASES (First 10)\n');
  
  results.PARTIAL.slice(0, 10).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title.substring(0, 70)}`);
    console.log(`   📍 ${item.venue}\n`);
  });
  
  console.log(`${'='.repeat(80)}\n`);
  console.log('❌ FAILED CASES (First 10)\n');
  
  results.FAILED.slice(0, 10).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title.substring(0, 70)}`);
    console.log(`   💡 Could not extract venue - title may be too generic\n`);
  });
  
  console.log(`${'='.repeat(80)}\n`);
  console.log('💡 ANALYSIS\n');
  
  const successRate = (results.SUCCESS.length / total) * 100;
  
  if (successRate >= 70) {
    console.log(`✅ Strong extraction accuracy (${successRate.toFixed(0)}%)`);
    console.log('Venue extraction is ready for /ai page with this coverage.');
  } else if (successRate >= 50) {
    console.log(`⚠️  Moderate extraction accuracy (${successRate.toFixed(0)}%)`);
    console.log('Recommend improving team-to-city mapping before production deployment.');
  } else {
    console.log(`❌ Low extraction accuracy (${successRate.toFixed(0)}%)`);
    console.log('Need significant improvements before using in /ai page.');
  }
  
  console.log('\n');
}

async function testWithSampleTitles() {
  console.log('Testing with sample market titles...\n');
  console.log('='.repeat(80) + '\n');
  
  const results = {
    SUCCESS: [],
    PARTIAL: [],
    FAILED: []
  };
  
  for (const [title, expected] of Object.entries(EXPECTED_RESULTS)) {
    const venue = VenueExtractor.extractFromMarket({
      title,
      question: title,
      description: `Market on: ${title}`
    });
    
    let status = 'FAILED';
    if (venue) {
      if (expected.includes(venue.split(',')[0])) {
        status = 'SUCCESS';
      } else {
        status = 'PARTIAL';
      }
    }
    
    results[status].push({
      title,
      expected,
      extracted: venue || 'N/A'
    });
  }
  
  console.log('Sample Test Results:\n');
  console.log(`✅ SUCCESS:  ${results.SUCCESS.length}`);
  console.log(`⚠️  PARTIAL:   ${results.PARTIAL.length}`);
  console.log(`❌ FAILED:    ${results.FAILED.length}\n`);
  
  if (results.SUCCESS.length > 0) {
    console.log('✅ Successful Extractions:\n');
    results.SUCCESS.forEach(item => {
      console.log(`  • "${item.title}"`);
      console.log(`    Expected: ${item.expected}`);
      console.log(`    Extracted: ${item.extracted}\n`);
    });
  }
  
  if (results.FAILED.length > 0) {
    console.log('❌ Failed Extractions:\n');
    results.FAILED.forEach(item => {
      console.log(`  • "${item.title}"`);
      console.log(`    Expected: ${item.expected}`);
      console.log(`    Extracted: ${item.extracted}\n`);
    });
  }
  
  console.log(`${'='.repeat(80)}\n`);
}

runRealisticTest().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
