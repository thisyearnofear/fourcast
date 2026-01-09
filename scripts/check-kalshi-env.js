/**
 * Check Kalshi Environment Variables
 * Run with: node scripts/check-kalshi-env.js
 */

import fs from 'fs';
import path from 'path';

function checkEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');

    if (!fs.existsSync(envPath)) {
        console.warn('⚠️ .env.local file not found');
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');

    // Check for Kalshi URL
    const hasKalshiUrl = envContent.includes('KALSHI_BASE_URL');

    console.log('\n🔍 Kalshi Integration Check:\n');

    if (hasKalshiUrl) {
        const match = envContent.match(/KALSHI_BASE_URL=(.*)/);
        console.log('✅ KALSHI_BASE_URL is set:', match[1]);
    } else {
        console.log('❌ KALSHI_BASE_URL is missing');
        console.log('   Add to .env.local:');
        console.log('   KALSHI_BASE_URL=https://trading-api.kalshi.com/v2');
    }

    console.log('\n💡 Tip: For testing, you can use the sandbox URL:');
    console.log('   KALSHI_BASE_URL=https://demo-api.kalshi.co/trade-api/v2\n');
}

checkEnv();
