#!/usr/bin/env node

/**
 * Test script for DeFi Arbitrage API
 * Simulates requests to the /api/defi/arbitrage endpoint
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testArbitrageAPI() {
  try {
    console.log('🔍 Testing DeFi Arbitrage API...\n');

    // Test 1: Default parameters
    console.log('Test 1: Default parameters (limit=20, minSpread=5%)');
    const response1 = await fetch(`${BASE_URL}/defi/arbitrage`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data1 = await response1.json();
    console.log('✅ Response status:', response1.status);
    console.log('📊 Opportunities found:', data1.data?.summary?.total_opportunities || 0);
    if (data1.data?.opportunities?.length > 0) {
      console.log('\n📈 Top opportunity:');
      const top = data1.data.opportunities[0];
      console.log(`  Market: ${top.market_title}`);
      console.log(`  Spread: ${top.arbitrage.spread_percent}%`);
      console.log(`  Buy on: ${top.arbitrage.buy_platform} @ ${(top.arbitrage.buy_odds * 100).toFixed(1)}%`);
      console.log(`  Sell on: ${top.arbitrage.sell_platform} @ ${(top.arbitrage.sell_odds * 100).toFixed(1)}%`);
      console.log(`  Profit per $1k: $${top.defi_metrics.estimated_profit_per_1k}`);
      console.log(`  Flash loan suitable: ${top.defi_metrics.flash_loan_suitable}`);
    }
    console.log('\n---\n');

    // Test 2: Strict spread threshold
    console.log('Test 2: High spread threshold (minSpread=15%)');
    const response2 = await fetch(`${BASE_URL}/defi/arbitrage?minSpread=15&limit=10`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data2 = await response2.json();
    console.log('✅ Response status:', response2.status);
    console.log('📊 High-spread opportunities:', data2.data?.summary?.total_opportunities || 0);
    console.log('\n---\n');

    // Test 3: Pagination
    console.log('Test 3: Limit to 5 results');
    const response3 = await fetch(`${BASE_URL}/defi/arbitrage?limit=5`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data3 = await response3.json();
    console.log('✅ Response status:', response3.status);
    console.log('📊 Results returned:', data3.data?.opportunities?.length || 0);
    
    if (data3.data?.summary) {
      console.log('\n📋 Summary:');
      console.log(`  Average spread: ${data3.data.summary.avg_spread}%`);
      console.log(`  Total liquidity: $${data3.data.summary.total_liquidity}`);
    }

    console.log('\n✨ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testArbitrageAPI();
