// Simulate a 3rd party developer using the SDK
// In a real app, this would be: import { SignalPublisher } from '@fourcast/signal-sdk';
const { SignalPublisher } = require('../sdk/dist/index.js');

async function testSDK() {
  console.log('📦 Testing @fourcast/signal-sdk...');

  const config = {
    moduleAddress: '0x123...mock...address',
    network: 'testnet' // or just pass string if TS enum issues arise in JS
  };

  const publisher = new SignalPublisher(config);
  console.log('✅ SDK Instantiated');

  const mockSignal = {
    eventId: 'test-event-1',
    marketTitle: 'Test Market',
    venue: 'New York',
    eventTime: Math.floor(Date.now() / 1000),
    marketSnapshotHash: '0x123',
    weatherHash: '0x456',
    aiDigest: 'Bullish on rain',
    confidence: 'HIGH',
    oddsEfficiency: 'EFFICIENT'
  };

  const payload = publisher.preparePublishPayload(mockSignal);
  console.log('📝 Payload Generated:', payload.function);
  
  if (payload.functionArguments.length !== 9) {
    throw new Error('❌ Incorrect argument count in payload');
  }

  console.log('✅ SDK Test Passed!');
}

testSDK().catch(console.error);
