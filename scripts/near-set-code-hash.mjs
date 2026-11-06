#!/usr/bin/env node
/**
 * Code-hash attestation — the "Only on NEAR" checkbox that doesn't need the
 * full Shade port (docs/NEAR_HACKATHON_ODDS.md, Step 2).
 *
 *   node scripts/near-set-code-hash.mjs          # compute only — prints the
 *                                                # hash + what it covers.
 *   node scripts/near-set-code-hash.mjs --set    # owner call:
 *                                                # set_approved_code_hash.
 *                                                # Needs NEAR_ACCOUNT_ID +
 *                                                # NEAR_PRIVATE_KEY in env.
 *
 * The hash is a sha256 manifest over the files that produce signature
 * requests — the honest reading of "the code that may request signatures is
 * registered on-chain." Compute it ON THE DEPLOY MACHINE, AFTER code freeze:
 * once set, every request_signature without a matching
 * NEAR_WORKER_CODE_HASH is refused — including the demo order.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getMandate, getMandateContractId } from '../services/near/nearMandateClient.js';
import { getSignerAccount } from '../services/near/nearClient.js';
import { explorerTxUrl } from '../services/near/nearConfig.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// The signing surface: everything between "decision made" and "signature
// returned." If a file here changes, the manifest changes — that's the point.
const FILES = [
  'services/aiAgentLoop.js',
  'services/polymarketTrading.js',
  'services/near/chainSigSigner.js',
  'services/near/nearMandateClient.js',
  'scripts/fourcast-agent-worker.mjs',
];

const manifest = FILES.map((f) => {
  const h = createHash('sha256').update(readFileSync(join(root, f))).digest('hex');
  return `${f}:${h}`;
}).sort();
const codeHash = 'sha256:' + createHash('sha256').update(manifest.join('\n')).digest('hex');

console.log('worker code manifest — files covered by the attestation:');
for (const line of manifest) console.log(`  ${line.slice(0, 64)}…`);
console.log(`\nNEAR_WORKER_CODE_HASH=${codeHash}`);

if (!process.argv.includes('--set')) {
  console.log('\nread-only. With --set this registers the hash on the contract (owner call).');
  process.exit(0);
}

const mandate = await getMandate();
console.log(`\ncontract  ${getMandateContractId()}`);
console.log(`current   approved_code_hash = ${mandate.approved_code_hash ?? 'unset'}`);
console.log('setting — after this, every signature request MUST carry this hash.');

const account = getSignerAccount();
const outcome = await account.callFunction({
  contractId: getMandateContractId(),
  methodName: 'set_approved_code_hash',
  args: { code_hash: codeHash },
  gas: BigInt(30_000_000_000_000),
});

const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id || null;
console.log(`\nset_approved_code_hash confirmed${txHash ? ` — ${explorerTxUrl(txHash)}` : ''}`);
console.log(`\nNow set on the worker env BEFORE any signing demo:\n  NEAR_WORKER_CODE_HASH=${codeHash}`);
