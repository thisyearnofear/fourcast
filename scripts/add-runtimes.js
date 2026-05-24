#!/usr/bin/env node
/**
 * Add runtime declarations to API routes
 * 
 * Categorizes routes and adds appropriate runtime declarations.
 */

import fs from 'fs';
import path from 'path';

// Edge routes - read-only, lightweight I/O
const EDGE_ROUTES = [
  'app/api/weather/route.js',
  'app/api/leaderboard/route.js',
  'app/api/markets/route.js',
  'app/api/markets/counts/route.js',
  'app/api/validate/location/route.js',
  'app/api/validate/market-compatibility/route.js',
  'app/api/validate/order/route.js',
  'app/api/validate/weather/route.js',
  'app/api/stats/route.js',
  'app/api/defi/arbitrage/route.js',
  'app/api/synth/warm-cache/route.js',
  'app/api/predictions/health/route.js',
];

// Node.js routes - DB writes, large SDKs, on-chain operations
const NODE_ROUTES = [
  'app/api/og/route.js',                    // @vercel/og
  'app/api/positions/route.js',              // DB
  'app/api/agent/executions/route.js',       // DB
  'app/api/agent/backtest/route.js',         // DB
  'app/api/agent/resolve/route.js',          // DB
  'app/api/agent/route.js',                  // DB
  'app/api/agent/track-record/route.js',     // DB
  'app/api/analyze/route.js',                // AI
  'app/api/analyze/stream/route.js',         // AI, streaming
  'app/api/bot/telegram/route.js',          // bot
  'app/api/builder/route.js',                // DB
  'app/api/cctp/transfer/route.js',          // on-chain
  'app/api/debug/route.js',                  // debug
  'app/api/farcaster/webhook/route.js',      // webhook
  'app/api/kalshi/balance/route.js',         // external API
  'app/api/kalshi/login/route.js',           // external API
  'app/api/kalshi/orders/route.js',          // external API
  'app/api/orders/route.js',                 // DB
  'app/api/predictions/route.js',            // DB
  'app/api/profile/route.js',                // DB
  'app/api/signals/resolve/route.js',        // on-chain
  'app/api/signals/route.js',                // on-chain
  'app/api/wallet/route.js',                 // wallet
];

function addRuntimeDeclaration(filepath, runtime) {
  const content = fs.readFileSync(filepath, 'utf-8');
  
  // Skip if already has runtime declaration
  if (content.includes('export const runtime')) {
    console.log(`⏭️  Skipping ${filepath} (already has runtime)`);
    return;
  }
  
  // Find the best place to insert (after imports, before first export/function)
  const lines = content.split('\n');
  const insertIndex = lines.findIndex(line => 
    line.startsWith('export') || 
    line.startsWith('async function') ||
    line.startsWith('function') ||
    line.match(/^(const|let|var)\s+\w+\s*=/)
  );
  
  if (insertIndex === -1) {
    console.log(`⚠️  Could not find insertion point in ${filepath}`);
    return;
  }
  
  lines.splice(insertIndex, 0, `export const runtime = '${runtime}';`, '');
  fs.writeFileSync(filepath, lines.join('\n'));
  console.log(`✅ Added ${runtime} to ${filepath}`);
}

console.log('Adding runtime declarations...\n');

// Process Edge routes
console.log('Edge routes:');
for (const route of EDGE_ROUTES) {
  addRuntimeDeclaration(route, 'edge');
}

// Process Node.js routes
console.log('\nNode.js routes:');
for (const route of NODE_ROUTES) {
  addRuntimeDeclaration(route, 'nodejs');
}

console.log('\n✅ Done!');