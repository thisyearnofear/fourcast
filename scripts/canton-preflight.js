/**
 * Canton Preflight Script
 * 
 * Pre-seeds a demo market with positions for multiple parties on Canton Devnet.
 * Run before demo/submission so judges land on a live state.
 * 
 * Usage:
 *   node --env-file=.env.local scripts/canton-preflight.js
 * 
 * Creates:
 *   - 1 prediction market (BTC price prediction)
 *   - 2 YES positions (one for each holder party)
 *   - 2 NO positions (one for each holder party)
 *   - Outputs contract IDs for reference
 */

import { createMarket, createPosition, getOpenMarkets, getOpenPositions } from '../services/cantonLedgerClient.js';

const DEMO_MARKET = {
  marketId: 'demo-btc-150k',
  question: 'Will Bitcoin exceed $150,000 by December 31, 2026?',
  settlementAsset: 'CBTC',
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
};

// Get party IDs from env vars
const OPERATOR_PARTY_ID = process.env.CANTON_OPERATOR_PARTY_ID || '';
const ALICE_PARTY_ID = process.env.CANTON_ALICE_PARTY_ID || '';
const BOB_PARTY_ID = process.env.CANTON_BOB_PARTY_ID || '';

async function runPreflight() {
  console.log('Canton Devnet Preflight');
  console.log('Operator:', OPERATOR_PARTY_ID || '(not set)');
  console.log('Alice:', ALICE_PARTY_ID || '(not set)');
  console.log('Bob:', BOB_PARTY_ID || '(not set)');
  console.log('Package:', process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '(not set)');
  console.log('');

  if (!ALICE_PARTY_ID || !BOB_PARTY_ID) {
    console.error('Error: CANTON_ALICE_PARTY_ID and CANTON_BOB_PARTY_ID must be set in .env.local');
    console.error('Get these party IDs from the NODERS team first.');
    process.exit(1);
  }

  try {
    // Step 1: Create market
    console.log('1. Creating market...');
    const marketResult = await createMarket(DEMO_MARKET);
    console.log('   Market created. Offset:', marketResult.completionOffset);

    // Step 2: Query to get the contract ID
    const { getOpenMarkets } = await import('../services/cantonLedgerClient.js');
    const markets = await getOpenMarkets();
    const market = markets.find(m => m.payload?.marketId === 'demo-btc-150k');
    if (!market) throw new Error('Market not found after creation');
    console.log('   Contract ID:', market.contractId);
    console.log('   Question:', market.payload.question);
    console.log('');

    // Step 3: Create YES position for Alice
    console.log('2. Creating YES position for Alice (500 cBTC)...');
    await createPosition({
      event_id: 'demo-btc-150k',
      recommended_action: 'YES',
      stake: '500',
      settlement_asset: 'CBTC',
    }, ALICE_PARTY_ID);
    console.log('   Alice YES position created.');

    // Step 4: Create NO position for Alice
    console.log('3. Creating NO position for Alice (300 cBTC)...');
    await createPosition({
      event_id: 'demo-btc-150k',
      recommended_action: 'NO',
      stake: '300',
      settlement_asset: 'CBTC',
    }, ALICE_PARTY_ID);
    console.log('   Alice NO position created.');

    // Step 5: Create YES position for Bob
    console.log('4. Creating YES position for Bob (400 cBTC)...');
    await createPosition({
      event_id: 'demo-btc-150k',
      recommended_action: 'YES',
      stake: '400',
      settlement_asset: 'CBTC',
    }, BOB_PARTY_ID);
    console.log('   Bob YES position created.');

    // Step 6: Create NO position for Bob
    console.log('5. Creating NO position for Bob (200 cBTC)...');
    await createPosition({
      event_id: 'demo-btc-150k',
      recommended_action: 'NO',
      stake: '200',
      settlement_asset: 'CBTC',
    }, BOB_PARTY_ID);
    console.log('   Bob NO position created.');

    // Step 7: Verify state
    console.log('');
    console.log('6. Verifying state...');
    const { getOpenPositions } = await import('../services/cantonLedgerClient.js');
    
    // Query as operator (sees all)
    const operatorPositions = await getOpenPositions(OPERATOR_PARTY_ID);
    console.log('   Operator view: ', operatorPositions.length, 'positions (all)');
    
    // Query as Alice (sees only her positions)
    const alicePositions = await getOpenPositions(ALICE_PARTY_ID);
    console.log('   Alice view:    ', alicePositions.length, 'positions (her own)');
    
    // Query as Bob (sees only his positions)
    const bobPositions = await getOpenPositions(BOB_PARTY_ID);
    console.log('   Bob view:      ', bobPositions.length, 'positions (his own)');
    
    // Verify privacy
    if (alicePositions.length !== bobPositions.length) {
      console.log('   Privacy verified: Alice and Bob see different position sets');
    }
    console.log('');

    // Get contract IDs for reference
    console.log('Contract IDs (save for demo):');
    console.log('  Market:', market.contractId);
    console.log('');
    console.log('Alice positions:');
    alicePositions.forEach(p => {
      console.log(`  ${p.payload?.side}: ${p.contractId}`);
    });
    console.log('');
    console.log('Bob positions:');
    bobPositions.forEach(p => {
      console.log(`  ${p.payload?.side}: ${p.contractId}`);
    });
    console.log('');
    console.log('Preflight complete. Visit /canton to see the live state.');
    console.log('Switch between Operator, Alice, and Bob views to see the privacy model.');

  } catch (err) {
    console.error('Preflight failed:', err.message);
    process.exit(1);
  }
}

runPreflight();
