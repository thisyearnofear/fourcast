import fs from 'fs';
import path from 'path';

// Manually load environment variables BEFORE imports
try {
  const envConfig = fs.readFileSync(path.resolve('.env.local'), 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });

  // Ensure we have the keys we need
  if (!process.env.NEXT_PUBLIC_WEATHER_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_WEATHER_API_KEY not found in .env.local');
  } else {
    console.log('✅ Loaded Weather API Key');
  }
} catch (e) {
  console.warn('⚠️ Could not load .env.local file', e);
}

async function testLocationVerification() {
  // Dynamic import to ensure env vars are loaded first
  const { analyzeWeatherImpactServer } = await import('./services/aiService.server.js');

  console.log('🧪 Testing Multivariate Location Verification System...\n');

  // Test Case: Neutral Site Game (e.g., NFL International Series)
  // Using a known past or hypothetical matchup that would trigger location correction
  // Example: "Chiefs vs Dolphins" in Frankfurt (from 2023) or a generic one
  // Let's use a current relevant example or a generic one that forces a search.
  // Since we don't know the exact current schedule, let's use a query that implies a location check.

  const testParams = {
    eventType: 'NFL',
    title: 'Kansas City Chiefs vs Buffalo Bills', // Often a big game, might be in Buffalo or KC
    location: 'Nairobi', // Intentionally wrong to trigger correction
    weatherData: null,
    currentOdds: 'YES: 50%, NO: 50%',
    participants: ['Chiefs', 'Bills'],
    marketId: 'test-market-123',
    isFuturesBet: false,
    mode: 'deep' // Enable web search
  };

  console.log(`📝 Input: ${testParams.title} @ ${testParams.location}`);

  try {
    const result = await analyzeWeatherImpactServer(testParams);

    console.log('\n✅ Analysis Result:');
    console.log('-----------------------------------');
    console.log(`📍 Final Location: ${result.weather_conditions?.location}`);
    console.log(`🌡️ Weather: ${result.weather_conditions?.temperature}, ${result.weather_conditions?.condition}`);
    console.log(`🤖 AI Reasoning: ${result.analysis.substring(0, 150)}...`);

    if (result.weather_conditions?.location && result.weather_conditions.location !== 'Nairobi') {
      console.log('\n🎉 SUCCESS: Location was corrected!');
    } else {
      console.log('\n❌ FAILURE: Location was NOT corrected.');
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }
}

testLocationVerification();
