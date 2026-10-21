import { memoryStatus } from '@/services/memory/memwalClient.js';
import { memoryLedgerSummary, listMemoryWrites } from '@/services/memory/writeLedger.js';
import { listMemoryLadder, listKindMemories, reconcileLedger } from '@/services/memory/memoryStore.js';
import { KINDS } from '@/services/memory/memoryFormat.js';
import { assertMemoryObjectOnChain } from '@/services/tatum/tatumSuiClient.js';

export const runtime = 'nodejs';

/**
 * GET /api/memory/status
 *
 * What the memory layer is, and whether the numbers it claims are actually on
 * chain. Two sources are reported side by side and never blended: the local
 * `memory_writes` ledger (what we intended to append) and the relayer/chain
 * read (what exists). If they disagree, that disagreement IS the answer — a
 * route that only printed the ledger would be a claim, not evidence.
 *
 * Default response is local-only and cheap. The remote reads are opt-in per
 * query param, because a page load must not silently spend relayer requests:
 *   ?ladder=1&kind=window[&key=2026-10]  recall the version rungs from the relayer
 *   ?kind=analyst                       list every key of one kind
 *   ?reconcile=1                        diff our ledger against relayer inventory
 *   ?proof=1                            assert each returned rung's owner object
 *                                       exists on chain, through Tatum JSON-RPC
 *
 * Response:
 * {
 *   success: true,
 *   schema: 'memory-status/v1',
 *   memory: { enabled, configured, writable, network, relayerUrl, reason, … },
 *   ledger: { confirmed, mainnetConfirmed, byNetwork: […], byKind: […] },
 *   rows: [ …latest ledger rows… ],
 *   rungs?: [ { version, key, blobId, asOf, fields, … }, … ],
 *   reconciliation?: { … },
 *   proofs?: [ { memkey, version, blobId, onchain: { exists, render, reason } }, … ],
 *   notes: [ …refusals, in plain words… ]
 * }
 *
 * Memories are SEAL-encrypted and owner-scoped: a judge cannot read the text
 * behind a blob_id. What this route can prove is the object's existence,
 * version and digest on mainnet, plus the hash of text we hold locally. Say so
 * in `notes` rather than let `blob_id` imply a public ledger.
 */

function truthy(value) {
  return value === '1' || value === 'true';
}

export async function GET(request) {
  const notes = [];
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind');
  const key = searchParams.get('key');

  if (kind && !KINDS.includes(kind)) {
    return Response.json(
      { success: false, error: `kind must be one of ${KINDS.join(', ')}` },
      { status: 400 },
    );
  }

  // Config and ledger are local — they answer even when every credential is unset.
  const memory = memoryStatus();
  const ledger = await memoryLedgerSummary();
  const rows = await listMemoryWrites({ kind: kind || null, memkey: key, limit: 20 });

  const body = { success: true, schema: 'memory-status/v1', memory, ledger, rows, notes };

  if (memory.writable) {
    notes.push(
      'Memories are SEAL-encrypted and owner-scoped. The blob_id and the on-chain owner object are public; the text is not.'
    );
  } else {
    notes.push(`Memory reads are unavailable: ${memory.reason || 'the writer is not writable'}.`);
  }

  const wantRungs = truthy(searchParams.get('ladder')) || Boolean(kind && key && truthy(searchParams.get('list')));
  if (wantRungs && memory.writable) {
    if (key) {
      body.rungs = await listMemoryLadder(kind, key);
    } else {
      body.rungs = await listKindMemories(kind || 'window');
    }
    if (!body.rungs.length) notes.push('The relayer returned no parseable rung for that namespace.');
  } else if (wantRungs) {
    notes.push('Ladder requested but skipped: the relayer is not reachable without credentials.');
  }

  if (truthy(searchParams.get('reconcile'))) {
    body.reconciliation = memory.writable
      ? await reconcileLedger()
      : { skipped: true, reason: 'memory is not configured' };
  }

  // Prove-on-read: our ledger stores the `owner` object id that
  // rememberAndWait() returned, so ask the chain whether it exists rather than
  // trusting the relayer's word. The rung text cannot be the source here —
  // recall() returns blob metadata only, no owner — so the ledger is the only
  // honest place to read an object id from. Best-effort and never fatal: an
  // unreachable gateway reports `exists: null`, which is a different claim from
  // `exists: false`.
  if (truthy(searchParams.get('proof'))) {
    body.proofs = [];
    for (const row of body.rows) {
      const objectId = row.owner || null;
      if (!objectId) {
        body.proofs.push({
          memkey: row.memkey,
          version: row.version,
          blobId: row.blob_id,
          onchain: { exists: null, reason: 'ledger row carries no owner object id (write unconfirmed)' },
        });
        continue;
      }
      body.proofs.push({
        memkey: row.memkey,
        version: row.version,
        blobId: row.blob_id,
        onchain: await assertMemoryObjectOnChain(objectId),
      });
    }
    if (!body.proofs.length) notes.push('Proof requested but the local ledger has no rows to prove.');
  }

  return Response.json(body);
}
