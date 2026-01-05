import { WeatherAnalyzer, MobilityAnalyzer, SentimentAnalyzer, OnChainAnalyzer } from '../services/analysis/index.js';

// Mock context for testing
const mockMarkets = {
  weather: {
    title: 'Will it rain in London tomorrow?',
    location: 'London, UK',
    marketID: '0x123_weather',
    currentOdds: { yes: 0.3, no: 0.7 }
  },
  mobility: {
    title: 'High turnout at Wembley Stadium?',
    venue: 'Wembley Stadium',
    marketID: '0x123_mobility',
    currentOdds: { yes: 0.6, no: 0.4 }
  },
  sentiment: {
    title: 'Will Bitcoin hit $100k?',
    tags: ['bitcoin', 'crypto'],
    marketID: '0x123_sentiment',
    currentOdds: { yes: 0.5, no: 0.5 }
  },
  onchain: {
    title: 'Gas price > 200 gwei?',
    marketID: '0x123_onchain',
    currentOdds: { yes: 0.1, no: 0.9 }
  }
};

async function testAnalyzers() {
  console.log('🧪 Testing Multi-Domain Analyzers...\n');

  // 1. Weather (Existing)
  try {
    console.log('--- Testing WeatherAnalyzer ---');
    const weather = new WeatherAnalyzer();
    // Mock weather service call if needed, or rely on service resilience
    // For this test we assume weatherService might fail without network/keys, 
    // so we wrap strictly.
    // actually WeatherAnalyzer calls weatherService.getCurrentWeather
    console.log('✅ Instantiated WeatherAnalyzer');
  } catch (e) {
    console.error('❌ WeatherAnalyzer failed:', e.message);
  }

  // 2. Mobility (New)
  try {
    console.log('\n--- Testing MobilityAnalyzer ---');
    const mobility = new MobilityAnalyzer();
    const context = await mobility.enrichContext(mockMarkets.mobility);
    console.log('✅ Enriched Context:', context.mobilityData);
    const prompt = mobility.constructPrompt(context);
    console.log('✅ Prompt Constructed (Length):', prompt.length);
  } catch (e) {
    console.error('❌ MobilityAnalyzer failed:', e.message);
  }

  // 3. Sentiment (New)
  try {
    console.log('\n--- Testing SentimentAnalyzer ---');
    const sentiment = new SentimentAnalyzer();
    // This will try to hit Neynar API. If no key, it might fail or return empty if mocked.
    // We'll see if searchCasts handles the missing key gracefully or if we need to mock it here.
    const context = await sentiment.enrichContext(mockMarkets.sentiment);
    console.log('✅ Enriched Context:', context.sentimentData.summary);
    const prompt = sentiment.constructPrompt(context);
    console.log('✅ Prompt Constructed (Length):', prompt.length);
  } catch (e) {
    console.error('❌ SentimentAnalyzer failed (Expected if no API Key):', e.message);
  }

  // 4. OnChain (New)
  try {
    console.log('\n--- Testing OnChainAnalyzer ---');
    const onchain = new OnChainAnalyzer();
    const context = await onchain.enrichContext(mockMarkets.onchain);
    console.log('✅ Enriched Context:', context.chainStats);
    const prompt = onchain.constructPrompt(context);
    console.log('✅ Prompt Constructed (Length):', prompt.length);
  } catch (e) {
    console.error('❌ OnChainAnalyzer failed:', e.message);
  }
}

testAnalyzers();
