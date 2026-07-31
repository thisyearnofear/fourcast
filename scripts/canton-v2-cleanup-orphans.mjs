/**
 * canton-v2-cleanup-orphans.mjs — clear orphaned preflight positions.
 *
 * Earlier failed preflight attempts left OPEN v2 positions (markets resolved
 * never because of the 20s deadline gate). The proper exit paths:
 *   - sender withdraws each present allocation → funds unlock and return
 *   - operator withdraws the position's AllocationRequest → position archives
 *   - operator voids the orphan market → clean end-state
 *
 * Usage: node scripts/canton-v2-cleanup-orphans.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = await import(`../services/cantonLedgerClient.js?x=${Date.now()}`);
const operator = process.env.CANTON_OPERATOR_PARTY_ID;

const positions = await client.getOpenPositions(operator);
const orphans = positions.filter((p) => String(p.payload?.marketId || '').startsWith('v2-preflight-'));
console.log(`found ${orphans.length} orphan preflight position(s)`);

for (const p of orphans) {
  const pos = p.payload;
  console.log(`\nposition ${p.contractId.slice(0, 18)}… market ${pos.marketId}`);
  const legs = await client.findPositionAllocations(pos);
  for (const [leg, cid] of [['stake', legs.stakeAllocationCid], ['payout', legs.payoutAllocationCid]]) {
    if (!cid) continue;
    const sender = leg === 'stake' ? pos.holder : pos.operator;
    try {
      await client.withdrawAllocation(cid, sender);
      console.log(`   withdrew ${leg} allocation (sender ${String(sender).split('::')[0]})… funds unlocked back`);
    } catch (e) {
      console.log(`   ✗ withdraw ${leg} failed: ${e.message.slice(0, 160)}`);
    }
  }
  try {
    await client.withdrawAllocationRequest(p.contractId);
    console.log('   allocation request withdrawn (position archived)');
  } catch (e) {
    console.log(`   ✗ withdraw request failed: ${e.message.slice(0, 160)}`);
  }
}

// Void orphan markets for a clean end-state
const markets = await client.getOpenMarkets(operator);
const orphanMarkets = markets.filter((m) => String(m.payload?.marketId || '').startsWith('v2-preflight-'));
console.log(`\nfound ${orphanMarkets.length} orphan preflight market(s)`);
for (const m of orphanMarkets) {
  try {
    await client.voidMarket(m.contractId, { reason: 'stale preflight run cleanup', viewers: [] });
    console.log(`   voided ${m.payload?.marketId}`);
  } catch (e) {
    console.log(`   ✗ void failed: ${e.message.slice(0, 160)}`);
  }
}

const b = await client.getBalances(operator);
console.log(`\noperator after cleanup: unlocked=${b.unlocked} locked=${b.locked}`);
if (process.env.CANTON_ALICE_PARTY_ID) {
  const a = await client.getBalances(process.env.CANTON_ALICE_PARTY_ID);
  console.log(`alice after cleanup:    unlocked=${a.unlocked} locked=${a.locked}`);
}
