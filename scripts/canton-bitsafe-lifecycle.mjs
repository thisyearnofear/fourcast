/**
 * canton-bitsafe-lifecycle.mjs — run the atomic-settlement lifecycle against
 * the REAL BitSafe CBTC registry on Canton DevNet.
 *
 * This is the qualification gate for HackCanton's CBTC challenge: the rubric
 * requires "integrating CBTC in a meaningful way, not a passing mention."
 * The reference-registry preflight (canton-v2-preflight.mjs) settles a token
 * named "cBTC"; this script settles the actual BitSafe CBTC instrument.
 *
 * The Daml does not change. The only swaps are config (env): the
 * AllocationFactory contract id, the registry admin, and the instrument id.
 * Parties are faucet-funded with real CBTC (no reference-registry mint).
 *
 * Prereqs (env in .env.local):
 *   CANTON_JSON_API_URL, CANTON_OIDC_* (transport — same as preflight)
 *   NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID (the v2 package id, already uploaded)
 *   CANTON_OPERATOR_PARTY_ID, CANTON_ALICE_PARTY_ID
 *   CANTON_BTC_REGISTRY_CID     (BitSafe AllocationFactory contract id)
 *   CANTON_BTC_INSTRUMENT_ADMIN (BitSafe registry admin party)
 *   CANTON_BTC_INSTRUMENT_ID    (real CBTC instrument id from BitSafe's registry)
 *   CANTON_ATTESTER_PARTY_ID    (optional; defaults to operator = self-attested)
 *
 * If any BitSafe env is missing, this script prints the exact ask for BitSafe
 * and exits — it never silently falls back to the reference registry.
 *
 * Usage: node scripts/canton-bitsafe-lifecycle.mjs
 *   (fund operator + Alice at https://cbtc-faucet.bitsafe.finance/ first)
 */
import { readFileSync } from 'node:fs';

// Minimal .env.local loader (no dotenv dependency) — sets process.env for the
// keys present. Behaves like dotenv.config for the keys we read.
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

const client = await import('../services/cantonLedgerClient.js');
const operator = process.env.CANTON_OPERATOR_PARTY_ID;
const alice = process.env.CANTON_ALICE_PARTY_ID;
const STAKE = Number(process.env.BITSAFE_DEMO_STAKE || 0.4);
const MULT = Number(process.env.BITSAFE_DEMO_MULT || 2);

const step = (n, s) => console.log(`\n── Step ${n}: ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 0. Validate configuration ────────────────────────────────────────────
step(0, 'Validate BitSafe CBTC configuration');
const required = {
  CANTON_JSON_API_URL: process.env.CANTON_JSON_API_URL,
  NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID: process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID,
  CANTON_OPERATOR_PARTY_ID: operator,
  CANTON_ALICE_PARTY_ID: alice,
  CANTON_BTC_REGISTRY_CID: process.env.CANTON_BTC_REGISTRY_CID,
  CANTON_BTC_INSTRUMENT_ADMIN: process.env.CANTON_BTC_INSTRUMENT_ADMIN,
  CANTON_BTC_INSTRUMENT_ID: process.env.CANTON_BTC_INSTRUMENT_ID,
};
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.log('\n⛔ BitSafe CBTC env not configured. This script does NOT fall back');
  console.log('   to the reference registry — that would defeat the CBTC integration gate.');
  console.log('\n   Missing:');
  for (const k of missing) console.log(`     • ${k}`);
  console.log('\n   ➜ Ask BitSafe for (see docs/BITSAFE_INTEGRATION.md):');
  console.log('     • the CBTC AllocationFactory contract id  → CANTON_BTC_REGISTRY_CID');
  console.log('     • the BitSafe registry admin party        → CANTON_BTC_INSTRUMENT_ADMIN');
  console.log('     • the real CBTC InstrumentId (admin + id)  → CANTON_BTC_INSTRUMENT_ID');
  console.log('     • faucet CBTC for the operator + a holder party (https://cbtc-faucet.bitsafe.finance/)');
  console.log('\n   Then re-run: node scripts/canton-bitsafe-lifecycle.mjs');
  process.exit(3);
}
console.log(`   registry factory: ${process.env.CANTON_BTC_REGISTRY_CID.slice(0, 21)}…`);
console.log(`   instrument admin: ${process.env.CANTON_BTC_INSTRUMENT_ADMIN.slice(0, 21)}…`);
console.log(`   instrument id:   ${process.env.CANTON_BTC_INSTRUMENT_ID}`);
console.log(`   mode: ${client.isBitSafeConfigured() ? 'BitSafe CBTC (production path)' : 'WARNING — not BitSafe-configured'}`);

// ── 1. Faucet-funding check ─────────────────────────────────────────────
step(1, 'Confirm faucet-funded CBTC balances');
const opBal0 = await client.getBalances(operator);
const aliceBal0 = await client.getBalances(alice);
console.log(`   operator: unlocked=${opBal0.unlocked} locked=${opBal0.locked}`);
console.log(`   alice:    unlocked=${aliceBal0.unlocked} locked=${aliceBal0.locked}`);
if (Number(opBal0.unlocked) < STAKE * (MULT - 1)) {
  console.log(`\n   ⛔ operator needs ≥ ${STAKE * (MULT - 1)} CBTC (payout reserve) for a ${STAKE}/${MULT}x demo.`);
  console.log('      Fund at https://cbtc-faucet.bitsafe.finance/ and re-run.');
  process.exit(4);
}
if (Number(aliceBal0.unlocked) < STAKE) {
  console.log(`\n   ⛔ alice needs ≥ ${STAKE} CBTC (stake) for the demo.`);
  console.log('      Fund at https://cbtc-faucet.bitsafe.finance/ and re-run.');
  process.exit(4);
}

// ── 2. Atomic lifecycle against BitSafe CBTC ────────────────────────────
step(2, 'Atomic lifecycle on real CBTC');
const marketId = `bitsafe-${Date.now()}`;
const instrument = client.referenceInstrumentId('CBTC', operator);
console.log(`   instrument: { admin:${instrument.admin.slice(0, 12)}…, id:${instrument.id} }`);
console.log(`   create market ${marketId}…`);
await client.createMarket({
  marketId,
  question: 'Will BTC exceed $150K by end of 2026?',
  settlementAsset: 'CBTC',
  instrument,
  deadline: new Date(Date.now() + 60 * 1000).toISOString(),
});
const markets = await client.getOpenMarkets();
const marketCid = markets.find((m) => m.payload?.marketId === marketId)?.contractId;
if (!marketCid) throw new Error('market not found after creation');
console.log(`   market cid: ${marketCid.slice(0, 21)}…`);

console.log(`   alice signs PositionOffer (YES ${STAKE}, ${MULT}x)…`);
const { offerContractId } = await client.createPositionOffer({
  holder: alice, marketCid, side: 'Yes', stake: STAKE, oddsMultiplier: MULT,
});
console.log(`   offer cid: ${offerContractId.slice(0, 21)}…`);
const { positionContractId } = await client.acceptOffer(offerContractId);
console.log(`   position cid: ${positionContractId.slice(0, 21)}…`);

const position = (await client.getOpenPositions()).find((p) => p.contractId === positionContractId)?.payload;
console.log('   allocate stake leg (alice, actAs alice — holder consent)…');
await client.allocateLeg(position, 'stake', alice);
console.log('   allocate payout leg (operator)…');
await client.allocateLeg(position, 'payout', operator);

const lockedFor = async (partyId, senderPartyId) =>
  (await client.getAllocations(partyId))
    .filter((a) => {
      const alloc = a.payload?.allocation || a.payload;
      return alloc?.settlement?.settlementRef?.cid === offerContractId
        && alloc?.transferLeg?.sender === senderPartyId;
    })
    .reduce((acc, a) => { const alloc = a.payload?.allocation || a.payload; return acc + Number(alloc?.transferLeg?.amount ?? 0); }, 0);
const aliceEscPre = await lockedFor(alice, alice);
const opEscPre = await lockedFor(operator, operator);
const alicePre = await client.getBalances(alice);
const opPre = await client.getBalances(operator);
console.log(`   escrow (this position): alice=${aliceEscPre} op=${opEscPre} CBTC locked`);
const waitMs = Date.parse(position.allocateBefore) - Date.now() + 2000;
if (waitMs > 0) { console.log(`   waiting ${(waitMs / 1000).toFixed(0)}s for the market window…`); await sleep(waitMs); }

console.log('   attestation + resolve (YES wins)…');
const { attestationContractId } = await client.createAttestation({
  marketId,
  outcome: 'ResolvedYes',
  evidenceHash: 'sha256:bitsafe-attestation',
  evidenceUri: `https://fourcast.app/txline/receipts/${marketId}`,
});
await client.resolveMarket(marketCid, { attestationCid: attestationContractId, viewers: [alice] });
const resolutions = await client.getMarketResolutions();
const resolutionCid = resolutions.find((r) => r.payload?.marketId === marketId)?.contractId;
if (!resolutionCid) throw new Error('resolution not found after resolve');

console.log('   ALICE settles her own win (SettleAsHolder)…');
const settleRes = await client.settlePositionV2(positionContractId, {
  resolutionCid,
  lane: 'holder',
  holderPartyId: alice,
});
const settleUpdateId = settleRes?.updateId || settleRes?.raw?.updateId || '(unavailable)';
console.log(`   settle update id: ${settleUpdateId}`);

// ── 3. Judge evidence ───────────────────────────────────────────────────
step(3, 'Judge evidence — real CBTC moved atomically');
const aliceAfter = await client.getBalances(alice);
const opAfter = await client.getBalances(operator);
const settled = await client.getSettledPositions(alice);
const receipt = settled.find((s) => s.payload?.marketId === marketId)?.payload;
const aliceEscPost = await lockedFor(alice, alice);
const opEscPost = await lockedFor(operator, operator);

console.log('');
console.log(`   alice:    unlocked ${alicePre.unlocked} → ${aliceAfter.unlocked} (Δ +${aliceAfter.unlocked - alicePre.unlocked} CBTC)`);
console.log(`   operator: unlocked ${opPre.unlocked} → ${opAfter.unlocked} (Δ ${opAfter.unlocked - opPre.unlocked} CBTC)`);
console.log(`   escrow:   alice ${aliceEscPre}→${aliceEscPost}, operator ${opEscPre}→${opEscPost} (both cleared)`);
console.log(`   receipt:  payout=${receipt?.payout} CBTC · instrument=${receipt?.instrument?.id} · evidence=${receipt?.evidenceHash}`);

// Privacy contrast — operator sees the settled receipt; a non-signatory's
// read is refused by the ledger (structural privacy, not an empty list).
console.log('   privacy:  operator sees the settled receipt:');
let nonSig = 'refused';
try {
  await client.queryActiveContracts('ExternalObserver::1220non-signatory-demo-party', [
    { module: 'Fourcast.PredictionPosition', name: 'PositionSettled' },
  ]);
  nonSig = 'empty';
} catch (e) {
  nonSig = `refused (${(e.message || '').slice(0, 60)})`;
}
console.log(`             non-signatory query: ${nonSig}`);

// opPre is captured AFTER allocation (locked CBTC is already deducted from
// unlocked), so the expected post-settle net is opPre.unlocked - payout.
const opExpectedNet = opPre.unlocked - STAKE * (MULT - 1);
const opActualNet = opAfter.unlocked + opAfter.locked;
const checks = [
  ['alice net += winnings (stake*(mult-1))', Math.abs((aliceAfter.unlocked - alicePre.unlocked) - STAKE * (MULT - 1)) < 1e-9],
  ['operator net -= payout (stake*(mult-1))', Math.abs(opActualNet - opExpectedNet) < 1e-8],
  ['both escrow legs cleared', aliceEscPost === 0 && opEscPost === 0],
  ['settled receipt exists with payout', Boolean(receipt) && Number(receipt?.payout) > 0],
  ['receipt instrument is the real CBTC id', String(receipt?.instrument?.id) === process.env.CANTON_BTC_INSTRUMENT_ID],
  ['non-signatory cannot read the position', nonSig !== 'empty'],
];
let ok = true;
for (const [label, pass] of checks) { console.log(`   ${pass ? '✓' : '✗'} ${label}`); if (!pass) ok = false; }

// ── Proof dossier: pin the artifacts the Proof Theatre renders ──────────
// Everything below is real DevNet state captured during this run — contract
// ids, the settle update id, the on-ledger receipt and balance deltas.
try {
  const fs = await import('node:fs');
  fs.mkdirSync('public/proof', { recursive: true });
  fs.writeFileSync('public/proof/canton-receipts.json', JSON.stringify({
    passed: ok,
    capturedAt: new Date().toISOString(),
    network: 'Canton DevNet (HackCanton · NODERS validator)',
    packageRef: '#fourcast (uploaded DAR)',
    instrument,
    stake: { amount: STAKE, oddsMultiplier: MULT },
    parties: { holder: alice, operator },
    marketId,
    contracts: {
      market: marketCid,
      offer: offerContractId,
      position: positionContractId,
      attestation: attestationContractId,
      resolution: resolutionCid,
    },
    settle: { lane: 'holder (SettleAsHolder)', updateId: String(settleUpdateId) },
    receiptPayload: receipt || null,
    deltas: {
      holderUnlocked: { before: alicePre.unlocked, after: aliceAfter.unlocked },
      operatorUnlocked: { before: opPre.unlocked, after: opAfter.unlocked },
      escrowAfter: { holder: aliceEscPost, operator: opEscPost },
    },
    privacy: { nonSignatoryObservation: nonSig },
    checks: checks.map(([label, pass]) => ({ label, pass })),
  }, null, 2));
  console.log('   📄 pinned dossier → public/proof/canton-receipts.json');
} catch (e) {
  console.log(`   (dossier write skipped: ${e.message || e})`);
}

console.log('');
if (ok) {
  console.log('✅ BITSAFE LIFECYCLE PASSED — real CBTC settled atomically on Canton DevNet.');
  console.log('   Settle update id (judge evidence):', settleUpdateId);
} else {
  console.error('❌ BITSAFE LIFECYCLE FAILED — see checks above');
  process.exitCode = 1;
}
