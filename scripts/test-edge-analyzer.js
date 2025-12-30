import { WeatherAnalyzer } from '../services/analysis/WeatherAnalyzer.js';

// Mock fetch for the browser/API environment check in EdgeAnalyzer
global.fetch = async (url, options) => {
  console.log(`[MockFetch] Calling ${url}`);
  return {
    json: async () => ({
      digest: "Mocked analysis result from AI",
      confidence: "HIGH",
      oddsEfficiency: "INEFFICIENT"
    })
  };
};

// Mock window to simulate browser environment if needed, 
// but our EdgeAnalyzer checks typeof window. 
// Let's run this as a node script where window is undefined.
// Wait, EdgeAnalyzer implementation has:
/*
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) { ... } else { ... return mocked ... }
*/
// So in Node (this script), it will fall through to the "Server" block which returns a mock.
// We want to test the full flow, so let's mock window to force it into the "Browser" path 
// which uses our mocked fetch, OR we just test the server path.
// Let's test the Server path first as it's the default in Node.

async function testEdgeAnalyzer() {
  console.log('🧪 Testing WeatherAnalyzer...');

  const analyzer = new WeatherAnalyzer();
  
  const mockContext = {
    marketID: 'test-market-123',
    title: 'Will it rain in London tomorrow?',
    location: 'London',
    currentOdds: { yes: 0.3, no: 0.7 },
    eventDate: new Date().toISOString()
  };

  try {
    console.log('📊 Analyzing context:', mockContext.title);
    const signal = await analyzer.analyze(mockContext);
    
    console.log('\n✅ Analysis Complete!');
    console.log('Signal Output:');
    console.log(JSON.stringify(signal, null, 2));

    // Validations
    if (signal.confidence === 'UNKNOWN') console.warn('⚠️ Confidence is UNKNOWN (Expected for server mock without real AI)');
    if (!signal.weatherHash) console.error('❌ Missing weatherHash');
    if (signal.eventId !== mockContext.marketID) console.error('❌ ID Mismatch');

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

testEdgeAnalyzer();
