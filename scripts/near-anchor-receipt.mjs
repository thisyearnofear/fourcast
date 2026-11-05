#!/usr/bin/env node
/**
 * Anchor a Fourcast decision-receipt hash on NEAR — the hackathon's
 * "commit receipt before the outcome resolves" leg.
 *
 * Usage:
 *   node scripts/near-anchor-receipt.mjs --fixture <id> --hash <64hex>   # anchor
 *   node scripts/near-anchor-receipt.mjs --fixture <id>                  # demo hash
 *   node scripts/near-anchor-receipt.mjs --verify <txHash> --hash <64hex>
 *   node scripts/near-anchor-receipt.mjs --read --fixture <id>           # state check
 *   node scripts/near-anchor-receipt.mjs --queue                         # list pending anchors
 *   node scripts/near-anchor-receipt.mjs --drain                         # anchor everything queued
 *
 * do X, see Y:
 *   1. Set NEAR_ACCOUNT_ID + NEAR_PRIVATE_KEY (ed25519:…) on testnet.
 *   2. Run `--fixture demo1` → prints the nearblocks tx link.
 *   3. Run `--read --fixture demo1` → prints the same memo back from
 *      on-chain state — no backend, no tx hash needed.
 *
 * Environment: NEAR_NETWORK (default testnet), NEAR_RPC_URL,
 * NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY, NEAR_SOCIAL_CONTRACT,
 * NEAR_ANCHOR_DEPOSIT_NEAR, FOURCAST_AGENT_ENV_FILE.
 */

import dotenv from 'dotenv';
import { createHash } from 'crypto';
import {
  anchorReceiptCommitment,
  verifyCommitmentTx,
  readAnchoredCommitment,
} from '../services/near/nearReceiptCommitment.js';
import { readAnchorQueue, drainNearAnchors } from '../services/near/nearAnchorQueue.js';
import { getNearConfig, isNearConfigured } from '../services/near/nearConfig.js';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();
dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const val = (name) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};
const has = (name) => args.includes(`--${name}`);
const line = (s = '') => console.log(s);

const config = getNearConfig();
const stateDir = process.env.FOURCAST_AGENT_STATE_DIR || '.fourcast-agent';
const fixtureId = val('fixture') || `demo-${Date.now()}`;
const contentHash =
  val('hash') || createHash('sha256').update(`fourcast-demo-receipt:${fixtureId}`).digest('hex');

line(`network    ${config.network} (${config.rpcUrl})`);
line(`account    ${config.accountId || '(unset)'}`);
line(`social     ${config.socialContract}`);
line(`fixture    ${fixtureId}`);
line(`hash       ${contentHash}`);
line();

async function main() {
  if (has('queue')) {
    const items = readAnchorQueue(stateDir);
    if (!items.length) {
      line(`queue empty (${stateDir}/near-anchors.json)`);
      return;
    }
    for (const i of items) {
      line(`${i.status.padEnd(8)} ${i.fixtureId}  ${i.contentHash.slice(0, 12)}…  ${i.txHash || i.lastError || ''}`);
    }
    return;
  }

  if (has('drain')) {
    const summary = await drainNearAnchors({ stateDir, force: has('force') });
    line(`drain      attempted=${summary.attempted} anchored=${summary.anchored} failed=${summary.failed} pending=${summary.pending}`);
    for (const i of summary.items.filter((x) => x.status === 'anchored')) {
      line(`  ✓ ${i.fixtureId}  ${i.txHash}`);
      line(`    ${i.explorerUrl}`);
    }
    process.exit(summary.failed > 0 ? 1 : 0);
  }

  if (has('read')) {
    const r = await readAnchoredCommitment({ accountId: config.accountId, fixtureId });
    if (!r.found) {
      line('not anchored — nothing at ' + (r.socialKey || '(no account)'));
      process.exit(1);
    }
    line(`anchored   ${r.memo}`);
    line(`key        ${r.socialKey}`);
    return;
  }

  const verifyHash = val('verify');
  if (verifyHash) {
    const r = await verifyCommitmentTx(verifyHash, contentHash);
    line(r.ok ? 'verified ✓' : `verify failed: ${r.reason}`);
    line(`memo       ${r.memo || '(none)'}`);
    line(`committer  ${r.committer || '(unknown)'}`);
    if (r.blockTime) line(`block time ${new Date(r.blockTime * 1000).toISOString()}`);
    line(`explorer   ${r.explorerUrl}`);
    process.exit(r.ok ? 0 : 1);
  }

  if (!isNearConfigured()) {
    line('Set NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY (ed25519:…) to anchor.');
    line('Testnet account: create one via the testnet wallet, then fund it.');
    process.exit(1);
  }

  const r = await anchorReceiptCommitment({ fixtureId, contentHash });
  line(`anchored   ${r.memo}`);
  line(`tx         ${r.txHash}`);
  line(`explorer   ${r.explorerUrl}`);
  line(`key        ${r.socialKey}`);
  line();
  line(`check it:  node --env-file=.env.local scripts/near-anchor-receipt.mjs --verify ${r.txHash} --hash ${contentHash}`);
}

main().catch((err) => {
  console.error(`near-anchor-receipt: ${err.message}`);
  process.exit(1);
});
