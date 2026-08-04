/**
 * canton-stage-demo.mjs — stage ONE fresh demo market + Alice position with
 * BOTH escrow legs locked, then stop. Leaves the ledger in the exact state
 * the Grand Final demo (and tonight's wallet-settle verification) starts from.
 *
 * Usage:
 *   node scripts/canton-stage-demo.mjs            stage only (resolve happens live on stage)
 *   node scripts/canton-stage-demo.mjs --resolve  also attest + resolve — position is
 *                                                 ready for "Settle with my wallet" NOW
 *
 * Tonight's verification: run with --resolve, then click Settle in the holder
 * dashboard. Tomorrow: run WITHOUT --resolve minutes before the pitch so
 * Act 3 can show the resolve → settle beat live.
 *
 * Prereqs: same env as canton-bitsafe-lifecycle.mjs (.env.local). If the
 * BitSafe CBTC env is present the escrow legs lock the real CBTC instrument;
 * otherwise the reference registry is used (the Daml flow is identical).
 *
 * The holder party is CANTON_ALICE_PARTY_ID — the Console Wallet on the demo
 * machine MUST control that same party for the wallet-signed settle to work.
 */
import { readFileSync } from 'node:fs';

// Minimal .env.local loader (same behaviour as the lifecycle script).
try {
  const text = readFileSync('.env.local', 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
} catch { /* .env.local optional when env is provided another way */ }

const RESOLVE = process.argv.includes('--resolve');
const holderArg = process.argv.find((a) => a.startsWith('--holder='))?.slice('--holder='.length);
const client = await import('../services/cantonLedgerClient.js');
const operator = process.env.CANTON_OPERATOR_PARTY_ID;
// The holder is whichever party the demo wallet can sign for. Override with
// --holder=<partyId> or CANTON_DEMO_HOLDER; defaults to the pre-seeded Alice.
const alice = holderArg || process.env.CANTON_DEMO_HOLDER || process.env.CANTON_ALICE_PARTY_ID;
const STAKE = Number(process.env.BITSAFE_DEMO_STAKE || 0.4);
const MULT = Number(process.env.BITSAFE_DEMO_MULT || 2);

if (!operator || !alice) {
  console.error('⛔ CANTON_OPERATOR_PARTY_ID and CANTON_ALICE_PARTY_ID must be set (same env as the lifecycle script).');
  process.exit(4);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bitsafe = client.isBitSafeConfigured?.() ?? false;
console.log(`   mode: ${bitsafe ? 'BitSafe CBTC (production path)' : 'reference registry'}`);
console.log(`   holder: ${alice.slice(0, 28)}…  ← the demo Console Wallet MUST control this party`);

// ── Stage: market → offer → accept → both escrow legs ──────────────────
const marketId = `demo-${Date.now()}`;
const instrument = client.referenceInstrumentId('CBTC', operator);
const deadline = new Date(Date.now() + 75 * 1000);
console.log(`\n   create market ${marketId} (deadline ${deadline.toISOString()})…`);
await client.createMarket({
  marketId,
  question: 'Demo: Will BTC exceed $150K by end of 2026?',
  settlementAsset: 'CBTC',
  instrument,
  deadline: deadline.toISOString(),
});
const marketCid = (await client.getOpenMarkets())
  .find((m) => m.payload?.marketId === marketId)?.contractId;
if (!marketCid) throw new Error('market not found after creation');
console.log(`   market cid: ${marketCid.slice(0, 24)}…`);

console.log(`   Alice signs PositionOffer (YES ${STAKE}, ${MULT}x)…`);
const { offerContractId } = await client.createPositionOffer({
  holder: alice, marketCid, side: 'Yes', stake: STAKE, oddsMultiplier: MULT,
});
const { positionContractId } = await client.acceptOffer(offerContractId);
console.log(`   position cid: ${positionContractId.slice(0, 24)}…`);

const position = (await client.getOpenPositions())
  .find((p) => p.contractId === positionContractId)?.payload;
console.log('   allocate stake leg (Alice, actAs Alice)…');
await client.allocateLeg(position, 'stake', alice);
console.log('   allocate payout leg (operator)…');
await client.allocateLeg(position, 'payout', operator);
console.log('   ✓ both escrow legs locked');

if (!RESOLVE) {
  console.log(`
✅ STAGED — open escrowed position ready.
   On stage: resolve in the settlement hub (Act 3), then "Settle with my wallet".
   To verify tonight instead, re-run with --resolve (needs a fresh position, so
   run THIS first only if you have not already).`);
  process.exit(0);
}

// ── Resolve: attest + resolve so the position is settle-ready NOW ──────
const waitMs = Date.parse(position.allocateBefore) - Date.now() + 2000;
if (waitMs > 0) {
  console.log(`   waiting ${(waitMs / 1000).toFixed(0)}s for the market window to close…`);
  await sleep(waitMs);
}
console.log('   attest + resolve (ResolvedYes)…');
const { attestationContractId } = await client.createAttestation({
  marketId,
  outcome: 'ResolvedYes',
  evidenceHash: 'sha256:demo-attestation',
  evidenceUri: `https://fourcast.app/txline/receipts/${marketId}`,
});
await client.resolveMarket(marketCid, { attestationCid: attestationContractId, viewers: [alice] });

console.log(`
✅ READY TO SETTLE
   position: ${positionContractId}
   market:   ${marketId} · ResolvedYes · attested (${attestationContractId.slice(0, 24)}…)

   Next: open the deployed site → /canton/holder → Connect Console Wallet
   (Alice's party) → "Settle with my wallet" → approve the popup.
   Expected: green "Settled — signed by your wallet" + update id.`);
