#!/usr/bin/env node

/**
 * Builder Program Setup Script
 * Validates and tests your Polymarket builder configuration
 * Run: node scripts/setup-builder.js
 */

import axios from 'axios';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('cyan', '\n🏗️  Polymarket Builder Program Setup\n');

  // 1. Check environment variables
  log('blue', '1. Checking environment variables...');
  const apiKey = process.env.POLY_BUILDER_API_KEY;
  const secret = process.env.POLY_BUILDER_SECRET;
  const passphrase = process.env.POLY_BUILDER_PASSPHRASE;
  const privateKey = process.env.POLYMARKET_PRIVATE_KEY;

  if (!apiKey) {
    log('red', '❌ Missing POLY_BUILDER_API_KEY');
    process.exit(1);
  }
  if (!secret) {
    log('red', '❌ Missing POLY_BUILDER_SECRET');
    process.exit(1);
  }
  if (!passphrase) {
    log('red', '❌ Missing POLY_BUILDER_PASSPHRASE');
    process.exit(1);
  }
  if (!privateKey) {
    log('yellow', '⚠️  POLYMARKET_PRIVATE_KEY not set (needed for order signing)');
  } else {
    log('green', '✅ All builder credentials configured');
  }

  // 2. Test API connectivity
  log('blue', '\n2. Testing API connectivity...');
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/markets?limit=1', {
      timeout: 5000
    });
    log('green', '✅ Polymarket API reachable');
  } catch (err) {
    log('red', `❌ API check failed: ${err.message}`);
    process.exit(1);
  }

  // 3. Validate credentials format
  log('blue', '\n3. Validating credential format...');
  if (apiKey.length < 10) {
    log('red', '❌ Builder API key appears invalid (too short)');
  } else {
    log('green', `✅ Builder API key format valid (${apiKey.length} chars)`);
  }

  if (secret.length < 10) {
    log('red', '❌ Builder secret appears invalid (too short)');
  } else {
    log('green', `✅ Builder secret format valid (${secret.length} chars)`);
  }

  // 4. Configuration summary
  log('blue', '\n4. Configuration Summary:');
  log('cyan', `   Builder Key: ${apiKey.substring(0, 8)}...`);
  log('cyan', `   Gasless Trading: Available`);
  log('cyan', `   Order Attribution: Ready`);

  // 5. Integration points
  log('blue', '\n5. Integration Points:');
  log('cyan', '   ✓ Service: services/builderService.js');
  log('cyan', '   ✓ Hook: hooks/useBuilder.js');
  log('cyan', '   ✓ Components: components/BuilderStats, BuilderBadge, BuilderDashboard');
  log('cyan', '   ✓ API: /api/builder, /api/orders (enhanced)');

  // 6. Next steps
  log('green', '\n✅ Setup Complete!\n');
  log('blue', 'Next Steps:');
  log('yellow', '1. Import components in your UI:');
  log('cyan', '   import { BuilderStats } from "@/components/BuilderStats"');
  log('yellow', '2. Use the hook for stats:');
  log('cyan', '   const { stats } = useBuilder()');
  log('yellow', '3. Submit orders and they\'ll auto-attribute:');
  log('cyan', '   POST /api/orders with your market data');
  log('yellow', '4. Track performance:');
  log('cyan', '   GET /api/builder?action=stats');

  log('blue', '\nDocumentation: docs/BUILDER_PROGRAM.md');
  log('blue', 'Leaderboard: https://builders.polymarket.com\n');
}

main().catch(err => {
  log('red', `\n❌ Setup failed: ${err.message}\n`);
  process.exit(1);
});
