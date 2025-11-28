#!/usr/bin/env node

/**
 * Test Turso database connection and schema setup
 * Run: node scripts/test-turso-connection.js
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.TURSO_CONNECTION_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('❌ Missing TURSO_CONNECTION_URL in .env.local');
  process.exit(1);
}

if (!token) {
  console.error('❌ Missing TURSO_AUTH_TOKEN in .env.local');
  console.log('\nTo generate a fresh token with write access, run:');
  console.log('  turso db tokens create fourcast');
  console.log('\nThen update TURSO_AUTH_TOKEN in .env.local');
  process.exit(1);
}

console.log('🔌 Testing Turso connection...');
console.log(`   URL: ${url}`);
console.log(`   Token: ${token.substring(0, 30)}...`);

const db = createClient({ url, authToken: token });

async function test() {
  try {
    // Test connection with simple query
    console.log('\n1️⃣  Testing connection...');
    const result = await db.execute('SELECT 1 as connected');
    console.log('✅ Connection successful');
    console.log('   Response:', result);

    // Create signals table (simpler version)
    console.log('\n2️⃣  Creating signals table...');
    try {
      await db.execute(`
        DROP TABLE IF EXISTS signals
      `);
    } catch (e) {
      // Ignore if table doesn't exist
    }

    await db.execute(`
      CREATE TABLE signals (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        market_title TEXT,
        confidence TEXT,
        timestamp INTEGER NOT NULL
      )
    `);
    console.log('✅ Signals table created');

    // Test insert
    console.log('\n3️⃣  Testing INSERT...');
    const testId = `test-${Date.now()}`;
    const insertResult = await db.execute({
      sql: `INSERT INTO signals (id, event_id, market_title, confidence, timestamp)
            VALUES (?, ?, ?, ?, ?)`,
      args: [testId, 'test-event', 'Test Market', 'HIGH', Math.floor(Date.now() / 1000)]
    });
    console.log('✅ INSERT successful');
    console.log('   Response:', insertResult);

    // Test select
    console.log('\n4️⃣  Testing SELECT...');
    const rows = await db.execute({
      sql: 'SELECT * FROM signals WHERE id = ?',
      args: [testId]
    });
    console.log('✅ SELECT successful');
    console.log('   Response:', rows);

    // Cleanup
    console.log('\n5️⃣  Cleaning up...');
    await db.execute('DROP TABLE signals');
    console.log('✅ Cleanup successful');

    console.log('\n✅ All tests passed! Turso is working correctly.\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed:');
    console.error('   Error:', err.message);
    console.error('   Code:', err.code);
    if (err.cause) {
      console.error('   Cause:', err.cause);
    }
    console.error('\n💡 Debugging tips:');
    console.error('   1. Verify TURSO_CONNECTION_URL is correct');
    console.error('   2. Create a fresh token: turso db tokens create fourcast');
    console.error('   3. Update TURSO_AUTH_TOKEN in .env.local');
    console.error('   4. Check if using a read-only token (need write access)');
    process.exit(1);
  }
}

test();
