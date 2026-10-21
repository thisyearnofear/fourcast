#!/usr/bin/env node
/**
 * Prove that memory RECALL works, not just memory write.
 *
 * Asks the relayer a natural-language question, parses the headers of whatever
 * comes back, and prints the version ladder for the best-matching key. This is
 * the demo the hackathon criterion asks for ("a read that changes the product"):
 * the rung is the belief, the blob_id is the receipt, and the parse is why the
 * answer is deterministic even though the retrieval is fuzzy.
 *
 * Note on verifiability: these memories are SEAL-encrypted and owner-scoped, so
 * a reader with the blob_id sees ciphertext, not our numbers. What is public is
 * that the object exists on Sui at an owner we control (WP4 asserts it with
 * sui_getObject through Tatum). Do not describe this as a public ledger.
 *
 * Usage:
 *   node scripts/memory-recall-demo.mjs "which venue are we best calibrated on"
 *   node scripts/memory-recall-demo.mjs --kind analyst --key 0xabc…
 *   node scripts/memory-recall-demo.mjs --query "monthly brier trend" --limit 8
 *
 * Environment: same credentials as scripts/memories-to-mainnet.mjs.
 */

import dotenv from 'dotenv';
import { memoryStatus, getClient } from '../services/memory/memwalClient.js';
import { listMemoryLadder } from '../services/memory/memoryStore.js';
import { parseMemoryText } from '../services/memory/memoryFormat.js';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();

const args = process.argv.slice(2);
const val = (name) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};

const query = val('query') || args.find((a) => !a.startsWith('--')) || 'what is fourcast calibrated on';
const kind = val('kind');
const key = val('key');
const limit = Number(val('limit') || 10);

async function main() {
  const status = memoryStatus();
  console.log('');
  console.log('🔎 Walrus Memory recall demo');
  console.log('='.repeat(48));
  console.log(`network ${status.network} · relayer ${status.relayerUrl} · configured ${status.configured}`);
  if (!status.configured) {
    console.log('');
    console.log(`No credentials (${status.reason}). Recall needs a delegate key: writes are`);
    console.log('append-only, but reading is still owner-authenticated — an anonymous reader');
    console.log('gets nothing, which is the point of SEAL here.');
    process.exitCode = 1;
    return;
  }

  const client = await getClient();

  if (kind && key) {
    const ladder = await listMemoryLadder(kind, key, { client, limit: 24, depth: 12 });
    console.log(`\nladder for ${kind}:${key} (${ladder.length} rungs found)`);
    for (const rung of ladder) {
      console.log(`  v${rung.version} as_of=${rung.asOf} ${rung.header.replace(`${kind} ${key} v=${rung.version} as_of=${rung.asOf} `, '')}`);
      console.log(`      blob_id ${rung.blobId}`);
      if (rung.note) console.log(`      ${rung.note}`);
    }
    if (!ladder.length) console.log('  nothing recalled — has this key been written? (npm run memories -- --write)');
    return;
  }

  const namespace = val('namespace') || (kind ? `fourcast.${kind}` : undefined);
  console.log(`\nquery: "${query}"${namespace ? ` namespace: ${namespace}` : ' (all namespaces)'}`);
  const result = await client.recall({ query, limit, ...(namespace ? { namespace } : {}) });
  const hits = result?.results || [];
  console.log(`${hits.length} hits, total ${result?.total ?? '?'}${result?.dropped_count ? `, ${result.dropped_count} undecryptable` : ''}`);

  for (const hit of hits) {
    const parsed = parseMemoryText(hit.text);
    if (!parsed.ok) {
      console.log(`\n  [${hit.distance.toFixed(4)}] unparseable memory (${parsed.error}) — blob ${hit.blob_id}`);
      continue;
    }
    console.log(`\n  [${hit.distance.toFixed(4)}] ${parsed.kind}:${parsed.key} v${parsed.fields.v} as_of=${parsed.fields.as_of}`);
    console.log(`      ${parsed.header}`);
    console.log(`      blob_id ${hit.blob_id}${hit.created_at ? ` · written ${hit.created_at}` : ''}`);
    if (parsed.note) console.log(`      ${parsed.note}`);
  }

  if (!hits.length) {
    console.log('\n  No memories recalled. Write some first: node scripts/memories-to-mainnet.mjs --write');
  }
}

main().catch((error) => {
  console.error('Recall demo failed:', error.message);
  process.exitCode = 1;
});
