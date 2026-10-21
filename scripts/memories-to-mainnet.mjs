#!/usr/bin/env node
/**
 * Append Fourcast's real track record to Walrus Memory (MemWal) on Sui.
 *
 * This is the Total Recall deliverable: memories of what the loop actually
 * got right and wrong, written to mainnet, each one citable by blob_id and
 * traceable to a row in `agent_forecasts` or a WIN/LOSS verdict in `signals`.
 *
 * DRY RUN IS THE DEFAULT. MemWal is append-only on a public ledger — a wrong
 * number cannot be edited, retracted quietly, or explained away later. Read the
 * plan it prints, then re-run with --write.
 *
 * Usage:
 *   node scripts/memories-to-mainnet.mjs                        # preview
 *   node scripts/memories-to-mainnet.mjs --write                # append for real
 *   node scripts/memories-to-mainnet.mjs --kinds=analyst,window --min-samples=20
 *   node scripts/memories-to-mainnet.mjs --signal-limit=25 --operator=<uuid>
 *   node scripts/memories-to-mainnet.mjs --reconcile            # diff ledger vs relayer
 *
 * Environment (see services/memory/memwalClient.js):
 *   FOURCAST_MEMORY_ENABLED, MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID,
 *   MEMWAL_RELAYER_URL, SUI_NETWORK, FOURCAST_MEMORY_MIN_SAMPLES
 *   plus the usual TURSO_* / DATABASE_PATH for the ledger read.
 */

import dotenv from 'dotenv';
import { migrationsReady } from '../services/db.js';
import { memoryStatus, checkRelayerHealth } from '../services/memory/memwalClient.js';
import { collectMemoryCandidates } from '../services/memory/ledgerMemory.js';
import { writeMemory, latestMemory, reconcileLedger } from '../services/memory/memoryStore.js';
import { memoryLedgerSummary } from '../services/memory/writeLedger.js';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const val = (name) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};

const WRITE = has('--write');
const TARGET = Number(val('target') || 10);
const KINDS = (val('kinds') || 'analyst,source,window,signal').split(',').map((k) => k.trim()).filter(Boolean);
const MIN_SAMPLES = Number(val('min-samples') || process.env.FOURCAST_MEMORY_MIN_SAMPLES || 20);

const line = (s = '') => console.log(s);

async function main() {
  await migrationsReady;
  const status = memoryStatus();

  line('');
  line('🧠 Fourcast → Walrus Memory');
  line('='.repeat(48));
  line(`mode         ${WRITE ? 'WRITE (append-only)' : 'DRY RUN (nothing written)'}`);
  line(`network      ${status.network} via ${status.relayerUrl}`);
  line(`enabled      ${status.enabled}  configured ${status.configured}  writable ${status.writable}`);
  line(`account      ${status.accountIdTail || 'unset'}`);
  line(`min samples  ${MIN_SAMPLES} (analyst/source floors)`);
  line(`kinds        ${KINDS.join(', ')}`);
  if (status.reason) line(`not writable ${status.reason}`);

  if (WRITE && !status.writable) {
    line('');
    line('✋ Refusing to write: ' + status.reason);
    line('   Set FOURCAST_MEMORY_ENABLED=true, MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID,');
    line('   and make sure SUI_NETWORK matches MEMWAL_RELAYER_URL.');
    process.exitCode = 1;
    return;
  }

  if (has('--reconcile')) {
    line('');
    line('— Reconciling the local ledger against the relayer inventory —');
    const rec = await reconcileLedger();
    if (!rec.ok) {
      line(`  skipped: ${rec.reason}`);
    } else {
      line(`  relayer lists ${rec.relayerCount} memories in ${rec.pages} pages, we recorded ${rec.ledgerCount} blobs`);
      line(`  matched by blob_id: ${rec.matched}`);
      if (rec.relayerOnly.length) line(`  on-chain but unexplained: ${rec.relayerOnly.slice(0, 5).join(', ')}${rec.relayerOnly.length > 5 ? ' …' : ''}`);
      if (rec.ledgerOnly.length) line(`  recorded but not on-chain: ${rec.ledgerOnly.slice(0, 5).join(', ')}${rec.ledgerOnly.length > 5 ? ' …' : ''}`);
      for (const [ns, count] of Object.entries(rec.byNamespace)) line(`  ${ns}: ${count}`);
      if (rec.mustResync) line('  cursor too old — relayer cannot say what was deleted since; re-run without a cursor');
    }
  }

  line('');
  line('— Reading the ledger —');
  const collected = await collectMemoryCandidates({
    kinds: KINDS,
    minSamples: MIN_SAMPLES,
    signalLimit: Number(val('signal-limit') || 10),
    analystLimit: Number(val('analyst-limit') || 25),
    operatorId: val('operator'),
  });
  line(`  ${collected.candidates.length} memory-worthy, ${collected.skipped.length} refused`);
  for (const skipped of collected.skipped) line(`  skip  ${skipped.skip}`);

  if (!collected.candidates.length) {
    line('');
    line('Nothing to write. This is a real answer, not a failure: the ledger does');
    line('not yet contain enough of the right kind of evidence. Lower --min-samples');
    line('only if the memory would still be true at that sample size.');
    line('');
    line('Next step: resolve more forecasts (npm run agent:once), then re-run --dry.');
    return;
  }

  line('');
  line(WRITE ? '— Appending —' : '— Planned appends —');
  const results = [];
  for (const candidate of collected.candidates) {
    const onChain = WRITE ? null : await latestMemory(candidate.kind, candidate.key);
    const result = await writeMemory(candidate, { dryRun: !WRITE, knownLatest: onChain });
    results.push(result);
    if (result.skipped) {
      line(`  = ${result.kind}:${result.key} ${result.reason}`);
      continue;
    }
    line(`  + ${result.kind}:${result.key} v${result.version} ns=${result.namespace}`);
    line(`      ${result.text.split('\n')[0]}`);
    if (WRITE) line(`      blob_id ${result.blobId || 'MISSING'} · memory_id ${result.memoryId || '—'}`);
    else line(`      idempotency ${result.idempotencyKey.slice(0, 16)}… (dry run, not sent)`);
    if (!result.ok) line(`      ✗ ${result.error}`);
  }

  const written = results.filter((r) => r.ok && !r.skipped);
  const failed = results.filter((r) => !r.ok);
  const summary = await memoryLedgerSummary();

  line('');
  line('— Summary —');
  line(`  planned/written ${written.length} · unchanged ${results.filter((r) => r.skipped && r.ok).length} · failed ${failed.length}`);
  for (const kind of summary.byKind) line(`  ${kind.kind}: ${kind.distinctKeys} keys, newest v${kind.maxVersion}`);
  line(`  confirmed on mainnet: ${summary.mainnetConfirmed} · all networks: ${summary.confirmed}`);
  line(`  deliverable: ${summary.mainnetConfirmed}/${TARGET} memories on mainnet`);

  if (!WRITE) {
    const health = await checkRelayerHealth();
    line('');
    line(`  relayer ${health.ok ? 'reachable' : 'UNREACHABLE'} at ${health.url} (${health.status || health.error})`);
    line('');
    line('Next step: re-run with --write to append these to Sui. Nothing was sent.');
  } else if (summary.mainnetConfirmed < TARGET) {
    line('');
    line(`Next step: ${TARGET - summary.mainnetConfirmed} more to reach the entry's stated floor —`);
    line('  resolve more markets (npm run agent:once), then re-run this script.');
  } else {
    line('');
    line(`Next step: ${summary.mainnetConfirmed} ≥ ${TARGET} — quote the blob_ids from`);
    line('  SELECT blob_id FROM memory_writes WHERE blob_id IS NOT NULL in the blog post.');
  }
  line('');
}

main().catch((error) => {
  console.error('Memory write failed:', error);
  process.exitCode = 1;
});
