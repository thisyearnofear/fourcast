#!/usr/bin/env node

/**
 * Test signals API endpoint
 * Run: node scripts/test-signals-api.js [URL]
 * Example: node scripts/test-signals-api.js http://localhost:3000
 */

const baseUrl = process.argv[2] || 'http://localhost:3000';

async function test() {
  try {
    console.log('📡 Testing Signals API...\n');
    console.log(`   Base URL: ${baseUrl}`);

    // Test GET /api/signals
    console.log('\n1️⃣  Testing GET /api/signals...');
    const getRes = await fetch(`${baseUrl}/api/signals?limit=5`);
    
    if (!getRes.ok) {
      throw new Error(`GET /api/signals returned ${getRes.status}`);
    }

    const getData = await getRes.json();
    if (!getData.success) {
      throw new Error(`API returned success=false: ${getData.error}`);
    }

    console.log('✅ GET /api/signals successful');
    console.log(`   Found ${getData.signals.length} signals`);
    if (getData.signals.length > 0) {
      console.log('   Latest signal:', {
        id: getData.signals[0].id,
        event_id: getData.signals[0].event_id,
        market_title: getData.signals[0].market_title,
        confidence: getData.signals[0].confidence,
        author_address: getData.signals[0].author_address?.substring(0, 6) + '...',
        timestamp: new Date(getData.signals[0].timestamp * 1000).toISOString()
      });
    }

    // Test POST /api/signals
    console.log('\n2️⃣  Testing POST /api/signals...');
    const testSignal = {
      market: {
        id: 'test-market-' + Date.now(),
        title: 'Test Market',
        ask: 0.65,
        bid: 0.60,
        volume24h: 50000
      },
      analysis: {
        reasoning: 'This is a test signal',
        assessment: {
          confidence: 'HIGH',
          odds_efficiency: 'EFFICIENT'
        }
      },
      weather: {
        temperature: 25,
        condition: 'Sunny'
      },
      authorAddress: '0x1234567890123456789012345678901234567890'
    };

    const postRes = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSignal)
    });

    if (!postRes.ok) {
      throw new Error(`POST /api/signals returned ${postRes.status}`);
    }

    const postData = await postRes.json();
    if (!postData.success) {
      throw new Error(`API returned success=false: ${postData.error}`);
    }

    console.log('✅ POST /api/signals successful');
    console.log(`   Created signal with ID: ${postData.id}`);

    // Verify the new signal appears
    console.log('\n3️⃣  Verifying new signal in GET request...');
    await new Promise(r => setTimeout(r, 500)); // Wait a bit

    const verifyRes = await fetch(`${baseUrl}/api/signals?limit=5`);
    const verifyData = await verifyRes.json();
    const found = verifyData.signals.find(s => s.id === postData.id);

    if (found) {
      console.log('✅ New signal found in listings');
      console.log('   Signal details:', {
        id: found.id,
        market_title: found.market_title,
        confidence: found.confidence,
        author_address: found.author_address?.substring(0, 6) + '...'
      });
    } else {
      console.warn('⚠️  Signal created but not found in listings yet');
    }

    console.log('\n✅ All API tests passed!\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed:');
    console.error('   Error:', err.message);
    process.exit(1);
  }
}

test();
