#!/usr/bin/env node
/**
 * Tatum Sui RPC check — proves the read path and renders object proofs.
 *
 * The Total Recall entry grades a *Tatum* Sui integration, and the
 * non-decorative use is proof-of-existence: every memory write's `owner`
 * object is re-read through Tatum and printed as
 * `object=id@version · digest · checkpoint`, next to its blob_id.
 *
 * Usage:
 *   node scripts/tatum-sui-check.mjs                    # selftest only
 *   node scripts/tatum-sui-check.mjs <objectId> [...]   # per-object proof
 *   node scripts/tatum-sui-check.mjs --tx=<digest>      # re-read a tx block
 *
 * Environment (see services/tatum/tatumSuiClient.js):
 *   TATUM_API_KEY (required), SUI_NETWORK, TATUM_SUI_RPC_URL, TATUM_TIMEOUT_MS
 */

import dotenv from 'dotenv';
import {
  assertMemoryObjectOnChain,
  tatumStatus,
  tatumSuiRpc,
} from '../services/tatum/tatumSuiClient.js';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();

const args = process.argv.slice(2);
const val = (name) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};
const objectIds = args.filter((a) => !a.startsWith('--'));
const line = (s = '') => console.log(s);

async function main() {
  const status = tatumStatus();
  line('');
  line('⛓  Fourcast → Tatum Sui RPC');
  line('='.repeat(48));
  line(`network      ${status.network} via ${status.url || 'unresolved'}`);
  line(`configured   ${status.configured}  key ${status.apiKeyTail || 'unset'}`);
  if (status.reason) line(`note         ${status.reason}`);

  if (!status.configured) {
    line('');
    line(`✋ ${status.reason} — set it and re-run. Nothing was fetched.`);
    process.exitCode = 1;
    return;
  }

  let ok = true;

  // Selftest: the two cheapest reads that prove the gateway answers.
  line('');
  line('— Selftest —');
  try {
    const [chainId, checkpoint] = await Promise.all([
      tatumSuiRpc('sui_getChainIdentifier'),
      tatumSuiRpc('sui_getLatestCheckpointSequenceNumber'),
    ]);
    line(`  chain id     ${chainId}`);
    line(`  checkpoint   ${checkpoint}`);
  } catch (err) {
    ok = false;
    line(`  ✗ ${err.code || 'ERROR'}: ${err.message}`);
  }

  for (const objectId of objectIds) {
    const proof = await assertMemoryObjectOnChain(objectId);
    if (proof.exists === true) {
      line(`  ✓ ${proof.render}`);
    } else {
      ok = false;
      const verdict = proof.exists === false ? 'ABSENT' : 'UNKNOWN';
      line(`  ✗ ${verdict} ${objectId} — ${proof.reason}`);
    }
  }

  const digest = val('tx');
  if (digest) {
    const tx = await tatumSuiRpc('sui_getTransactionBlock', [
      digest,
      { showEffects: true, showBalanceChanges: true },
    ]);
    if (!tx) {
      ok = false;
      line(`  ✗ tx ${digest} — no result`);
    } else {
      line(`  ✓ tx ${digest} · effects.status=${tx.effects?.status?.status ?? 'n/a'}`);
    }
  }

  if (!objectIds.length && !digest) {
    line('');
    line('Next step: pass a memory owner object id to render its on-chain proof.');
  }
  if (!ok) process.exitCode = 1;
  line('');
}

main().catch((error) => {
  console.error('Tatum check failed:', error);
  process.exitCode = 1;
});
