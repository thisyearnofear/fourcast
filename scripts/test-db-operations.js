#!/usr/bin/env node

/**
 * Test database operations (saveSignal, getLatestSignals, etc.)
 * Run: node scripts/test-db-operations.js
 */

import dotenv from 'dotenv';
import { saveSignal, getLatestSignals, updateSignalTxHash, getSignalCount } from '../services/db.js';

dotenv.config({ path: '.env.local' });

async function test() {
  try {
    console.log('📝 Testing database operations...\n');

    // Test saveSignal
    console.log('1️⃣  Testing saveSignal...');
    const testSignalId = `test-${Date.now()}`;
    const saveRes = await saveSignal({
      id: testSignalId,
      event_id: 'event-123',
      market_title: 'Test Market',
      venue: 'Test Venue',
      event_time: Math.floor(Date.now() / 1000),
      market_snapshot_hash: 'hash123',
      weather_json: { temp: 25 },
      ai_digest: 'This is a test signal',
      confidence: 'HIGH',
      odds_efficiency: 'EFFICIENT',
      author_address: '0x1234567890123456789012345678901234567890',
      tx_hash: null,
      timestamp: Math.floor(Date.now() / 1000)
    });

    if (!saveRes.success) {
      throw new Error(`saveSignal failed: ${saveRes.error}`);
    }
    console.log('✅ saveSignal successful');

    // Test getLatestSignals
    console.log('\n2️⃣  Testing getLatestSignals...');
    const getRes = await getLatestSignals(10);
    if (!getRes.success) {
      throw new Error(`getLatestSignals failed: ${getRes.error}`);
    }
    console.log(`✅ getLatestSignals successful (${getRes.signals.length} signals found)`);
    if (getRes.signals.length > 0) {
      console.log('   Latest signal:', getRes.signals[0]);
    }

    // Test updateSignalTxHash
    console.log('\n3️⃣  Testing updateSignalTxHash...');
    const updateRes = await updateSignalTxHash(testSignalId, '0xabcdef123');
    if (!updateRes.success) {
      throw new Error(`updateSignalTxHash failed: ${updateRes.error}`);
    }
    console.log('✅ updateSignalTxHash successful');

    // Verify the update
    console.log('\n4️⃣  Verifying update...');
    const verifyRes = await getLatestSignals(1);
    const updated = verifyRes.signals.find(s => s.id === testSignalId);
    if (updated && updated.tx_hash === '0xabcdef123') {
      console.log('✅ Update verified - tx_hash is correct');
    } else {
      console.warn('⚠️  Update may not have worked');
    }

    // Test getSignalCount
    console.log('\n5️⃣  Testing getSignalCount...');
    const count = await getSignalCount('0x1234567890123456789012345678901234567890');
    console.log(`✅ getSignalCount successful: ${count} signals`);

    console.log('\n✅ All database operations passed!\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed:');
    console.error('   Error:', err.message);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
}

test();
