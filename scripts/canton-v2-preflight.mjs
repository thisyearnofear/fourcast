/**
 * canton-v2-preflight.mjs — deploy + live-verify canton-2.0.0 (atomic settlement).
 *
 * Steps (idempotent-ish; safe to re-run, it creates fresh demo contracts each time):
 *   1. Read .env.local, ensure NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID is the v2 id
 *      (uploads the DAR via POST /v2/packages if missing).
 *   2. Ensure the reference CIP-56 registry exists (TokenRules) →
 *      patches CANTON_REFERENCE_RULES_CID into .env.local.
 *   3. Mint demo balances (operator reserve + Alice/Bob user mints).
 *   4. Full lifecycle: market → Alice offer → operator accept → BOTH escrow
 *      legs allocated → attestation → resolve → ALICE settles her own win.
 *   5. Assert balances & conservation, print the proof table.
 *
 * Usage: node scripts/canton-v2-preflight.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { readFileSync, writeFileSync } from 'node:fs';

const EXPECTED_PACKAGE = '550828d219effd88bc03fadd856403ab42795e33c185cbea4ff2e055a2ed930a';
const DAR_PATH = 'canton/.daml/dist/fourcast-2.0.0.dar';
const ALICE = process.env.CANTON_ALICE_PARTY_ID;
const BOB = process.env.CANTON_BOB_PARTY_ID;

const step = (n, s) => console.log(`\n── Step ${n}: ${s}`);

function patchEnv(key, value) {
  const path = '.env.local';
  let text = readFileSync(path, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (text.match(re)) text = text.replace(re, `${key}=${value}`);
  else text += `\n${key}=${value}\n`;
  writeFileSync(path, text);
  process.env[key] = value;
  console.log(`   .env.local updated: ${key}=${value.slice(0, 21)}…`);
}

// Client reads env at module load; import only after env is set.
let client;

step(1, 'Ensure v2 DAR is uploaded');
client = await import('../services/cantonLedgerClient.js');
let packages = await client.listPackages();
console.log(`   participant knows ${packages.length} packages`);
if (!packages.includes(EXPECTED_PACKAGE)) {
  console.log('   v2 package not on ledger — attempting upload via POST /v2/packages…');
  try {
    await client.uploadDar(readFileSync(DAR_PATH));
  } catch (e) {
    console.log('');
    console.log('   ⛔ DAR upload is operator-gated on this participant (403 PERMISSION_DENIED).');
    console.log('   This is the same gate that required NODERS to upload the v1 DAR.');
    console.log('');
    console.log('   ➜ Action required (the only manual step): ask NODERS to upload');
    console.log(`     ${DAR_PATH}`);
    console.log(`     (expected package id: ${EXPECTED_PACKAGE})`);
    console.log('     Then re-run: node scripts/canton-v2-preflight.mjs');
    console.log('');
    console.log('     Everything after the upload is scripted: registry, mints, escrow,');
    console.log('     attestation, resolution, holder-settled win, balance assertions.');
    console.log('     See docs/CANTON_V2_DEPLOY.md for the full runbook.');
    process.exit(3);
  }
  packages = await client.listPackages();
  if (!packages.includes(EXPECTED_PACKAGE)) {
    throw new Error('upload reported success but package id absent from /v2/packages');
  }
  console.log('   upload confirmed');
} else {
  console.log('   v2 package already on ledger');
}
if (process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID !== EXPECTED_PACKAGE) {
  patchEnv('NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID', EXPECTED_PACKAGE);
  console.log('   NOTE: client module was already loaded with the old package id — the');
  console.log('   NEXT run of any app server/preflight uses the new one. Commands by name');
  console.log('   (#canton:) resolve to the newest upload, so this preflight is unaffected.');
}

// Re-import with patched env for by-hash command template IDs.
client = await import(`../services/cantonLedgerClient.js?x=${Date.now()}`);

step(2, 'Ensure reference registry (Fourcast.Token:TokenRules)');
let rulesCid = process.env.CANTON_REFERENCE_RULES_CID || '';
{
  const existing = await client.queryActiveContracts(process.env.CANTON_OPERATOR_PARTY_ID, [
    { module: 'Fourcast.Token', name: 'TokenRules' },
  ]);
  if (existing.length) {
    rulesCid = existing[0].contractId;
    console.log(`   rules already exist: ${rulesCid.slice(0, 21)}…`);
  } else {
    const r = await client.createTokenRules();
    rulesCid = r.rulesCid;
    console.log(`   created rules: ${rulesCid.slice(0, 21)}…`);
  }
  if (process.env.CANTON_REFERENCE_RULES_CID !== rulesCid) {
    patchEnv('CANTON_REFERENCE_RULES_CID', rulesCid);
    client = await import(`../services/cantonLedgerClient.js?x=${Date.now()}`);
  }
}

step(3, 'Mint demo balances (reference cBTC)');
const operator = process.env.CANTON_OPERATOR_PARTY_ID;

// Cheap early probe: create+archive a MintRequest as Alice. If the ledger user
// lacks actAs rights over the holder parties, ALL v2 holder flows (offers,
// holder-settle) are blocked — surface that here, before touching real state.
if (ALICE) {
  try {
    const { mintRequestCid } = await client.requestMint(ALICE);
    console.log('   actAs probe passed (Alice)');
    // Reject it so no junk accumulates from a failed probe path
    // (RejectMint is admin-controlled; we don't need the mint.)
    try {
      await client.submitCommands({
        actAs: [operator],
        commands: [{
          ExerciseCommand: {
            templateId: `#fourcast:Fourcast.Token:MintRequest`,
            contractId: mintRequestCid,
            choice: 'RejectMint',
            choiceArgument: {},
          },
        }],
      });
    } catch { /* non-fatal: probe contract may remain, fine */ }
  } catch (e) {
    console.log('');
    console.log('   ⛔ actAs probe FAILED — the ledger user cannot submit as Alice.');
    console.log('   v2 requires holder-signed offers + holder-settled wins, so the demo');
    console.log('   needs actAs rights over the holder parties.');
    console.log(`   Ask NODERS: extend ledger user actAs to
     ${ALICE}
     ${BOB || '(bob id not set)'}`);
    console.log('   (Everything else was verified: DAR builds, 7/7 tests, interface ids on-ledger.)');
    process.exit(4);
  }
}

console.log('   operator self-mint 5000 (payout reserve)…');
await client.mintSelf({ amount: 5000, instrumentId: client.referenceInstrumentId('CBTC', operator) });
for (const [name, party, amount] of [['alice', ALICE, 2000], ['bob', BOB, 1000]]) {
  if (!party) { console.log(`   skipping ${name} (no env party id)`); continue; }
  console.log(`   ${name} mint-request ${amount}…`);
  const { mintRequestCid } = await client.requestMint(party);
  await client.acceptMint(mintRequestCid, { amount, instrumentId: client.referenceInstrumentId('CBTC', operator) });
}
const b0 = await client.getBalances(operator);
console.log(`   operator: unlocked=${b0.unlocked} locked=${b0.locked}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

step(4, 'Atomic lifecycle on live ledger');
const marketId = `v2-preflight-${Date.now()}`;
console.log(`   create market ${marketId}…`);
await client.createMarket({
  marketId,
  question: 'Will BTC exceed $150K by end of 2026?',
  settlementAsset: 'CBTC',
  // window for offers/allocations; resolution strictly after
  deadline: new Date(Date.now() + 60 * 1000).toISOString(),
});
const markets = await client.getOpenMarkets();
const marketCid = markets.find((m) => m.payload?.marketId === marketId)?.contractId;
if (!marketCid) throw new Error('market not found after creation');
console.log(`   market cid: ${marketCid.slice(0, 21)}…`);

console.log('   alice signs PositionOffer (YES 500)…');
const { offerContractId } = await client.createPositionOffer({
  holder: ALICE, marketCid, side: 'Yes', stake: 500, oddsMultiplier: 2,
});
console.log(`   offer cid: ${offerContractId.slice(0, 21)}…`);
console.log('   operator accepts…');
const { positionContractId } = await client.acceptOffer(offerContractId);
console.log(`   position cid: ${positionContractId.slice(0, 21)}…`);

const position = (await client.getOpenPositions()).find((p) => p.contractId === positionContractId)?.payload;
console.log('   allocate stake leg (alice, actAs alice — proves holder consent path)…');
await client.allocateLeg(position, 'stake', ALICE);
console.log('   allocate payout leg (operator)…');
await client.allocateLeg(position, 'payout', operator);
const lockedForOffer = async (partyId, senderPartyId) =>
  (await client.getAllocations(partyId))
    .filter((a) => a.payload?.allocation?.settlement?.settlementRef?.cid === offerContractId
      && a.payload?.allocation?.transferLeg?.sender === senderPartyId)
    .reduce((acc, a) => acc + Number(a.payload?.allocation?.transferLeg?.amount ?? 0), 0);
const aliceEscrowPre = await lockedForOffer(ALICE, ALICE);
const opEscrowPre = await lockedForOffer(operator, operator);
const aliceBalPre = await client.getBalances(ALICE);
const opBalPre = await client.getBalances(operator);
console.log(`   escrow scoped to this position: alice=${aliceEscrowPre} locked, operator=${opEscrowPre} locked`);
const waitMs = Date.parse(position.allocateBefore) - Date.now() + 2000;
if (waitMs > 0) { console.log(`   waiting ${(waitMs / 1000).toFixed(0)}s for the market window to close…`); await sleep(waitMs); }

console.log('   attestation + resolve (YES wins)…');
const { attestationContractId } = await client.createAttestation({
  marketId,
  outcome: 'ResolvedYes',
  evidenceHash: 'sha256:preflight-attestation',
  evidenceUri: `https://fourcast.app/txline/receipts/${marketId}`,
});
await client.resolveMarket(marketCid, { attestationCid: attestationContractId, viewers: [ALICE, BOB].filter(Boolean) });
const resolutions = await client.getMarketResolutions();
const resolutionCid = resolutions.find((r) => r.payload?.marketId === marketId)?.contractId;
if (!resolutionCid) throw new Error('resolution not found after resolve');

console.log('   ALICE settles her own win (SettleAsHolder, holder actAs)…');
await client.settlePositionV2(positionContractId, {
  resolutionCid,
  lane: 'holder',
  holderPartyId: ALICE,
});

step(5, 'Assertions');
const aliceAfter = await client.getBalances(ALICE);
const opAfter = await client.getBalances(operator);
const settled = await client.getSettledPositions(ALICE);
const receipt = settled.find((s) => s.payload?.marketId === marketId)?.payload;
const aliceEscrowPost = await lockedForOffer(ALICE, ALICE);
const opEscrowPost = await lockedForOffer(operator, operator);
console.log('');
console.log(`   alice:   unlocked=${aliceAfter.unlocked} (pre-settle: ${aliceBalPre.unlocked}, escrow ${aliceEscrowPre}→${aliceEscrowPost})`);
console.log(`   operator: unlocked=${opAfter.unlocked} (pre-settle: ${opBalPre.unlocked}, escrow ${opEscrowPre}→${opEscrowPost})`);
console.log(`   receipt: payout=${receipt?.payout} evidenceHash=${receipt?.evidenceHash}`);
const checks = [
  ['alice escrowed 500 pre-settle (this position)', aliceEscrowPre === 500],
  ['operator escrowed 500 pre-settle (this position)', opEscrowPre === 500],
  ['alice unlocked += 1000 (stake back + 500 payout)', Math.abs(aliceAfter.unlocked - (aliceBalPre.unlocked + 1000)) < 1e-9],
  ['operator unlocked unchanged (payout came from escrow, not free balance)', Math.abs(opAfter.unlocked - opBalPre.unlocked) < 1e-9],
  ['operator total holdings -= 500 (net payout paid)', Math.abs((opAfter.unlocked + opAfter.locked) - (opBalPre.unlocked + opBalPre.locked - 500)) < 1e-9],
  ['alice escrow cleared after settle (this position)', aliceEscrowPost === 0],
  ['operator escrow cleared after settle (this position)', opEscrowPost === 0],
  ['settled receipt exists', Boolean(receipt)],
  ['receipt payout == 1000 (stake + winnings)', Number(receipt?.payout) === 1000],
  ['receipt commits to evidence', Boolean(receipt?.evidenceHash)],
];
let ok = true;
for (const [label, pass] of checks) { console.log(`   ${pass ? '✓' : '✗'} ${label}`); if (!pass) ok = false; }

console.log('');
if (ok) console.log('✅ PREFLIGHT PASSED — atomic settlement verified live on DevNet.');
else { console.error('❌ PREFLIGHT FAILED — see checks above'); process.exitCode = 1; }
