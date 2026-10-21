/**
 * Memory store: the write, read and reconciliation surface for Walrus Memory.
 *
 * MemWal is APPEND-ONLY. There is no upsert and no delete-then-rewrite that
 * reviewers would accept, so "updating a belief" means writing a new memory at
 * a higher version and letting the ladder stand. That is not a limitation to
 * hide: the ladder is the demo. Each rung is a real number, computed on the day
 * the evidence said that, citable by blob_id.
 *
 * Two consequences this module owns:
 *   1. Never re-write the same facts. A version bump must mean the ledger
 *      actually moved, so the digest that gates a write covers the FACTS only
 *      (not `v`, not `as_of`). Otherwise a nightly cron would bury the ladder
 *      in identical rungs.
 *   2. Highest-version-wins, and version comes from a deterministic parse of
 *      the header — not from recall's similarity ranking, which is a search
 *      relevance score and has no business deciding what is true.
 */

import { getClient, memoryStatus } from './memwalClient.js';
import {
  buildIdempotencyKey,
  fieldValue,
  fieldNumber,
  formatMemory,
  namespaceFor,
  parseMemoryText,
  sha256Hex,
} from './memoryFormat.js';
import {
  claimMemoryWrite,
  confirmMemoryWrite,
  failMemoryWrite,
  latestLedgerVersion,
  ledgerBlobIds,
} from './writeLedger.js';

/** How many rungs per key we surface in the UI/blog. Older rungs stay on-chain. */
export const LADDER_DEPTH = 3;

/**
 * Facts only — `v` and `as_of` are excluded by construction, because the writer
 * adds them. Two candidates that agree on every metric hash identically even if
 * they were computed a week apart.
 */
export function factsDigest({ kind, key, fields = {} }) {
  const rest = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
  return sha256Hex(JSON.stringify({ kind, key, fields: rest }));
}

export function planMemory(candidate, { version }) {
  const namespace = namespaceFor(candidate.kind);
  const fields = { v: version, as_of: candidate.asOf, ...candidate.fields };
  const text = formatMemory({ kind: candidate.kind, key: candidate.key, fields, note: candidate.note });
  const textSha256 = sha256Hex(text);
  const contentHash = factsDigest(candidate);
  return {
    kind: candidate.kind,
    key: candidate.key,
    namespace,
    version,
    text,
    textSha256,
    contentHash,
    idempotencyKey: buildIdempotencyKey({ kind: candidate.kind, key: candidate.key, version, contentHash }),
    triggerReceipt: candidate.triggerReceipt || null,
    evidenceSource: candidate.evidenceSource || null,
    note: candidate.note || null,
  };
}

/**
 * @param dryRun defaults to true: this writes to an append-only public ledger,
 *   so meaning it has to be said out loud.
 * @param knownLatest the ladder head, if the caller already read it (the batch
 *   script has). Reading it is what makes "append" mean "the facts moved":
 *   identical facts are refused, and the version counts on-chain rungs too —
 *   the local ledger can be behind if another box wrote first.
 */
export async function writeMemory(candidate, { dryRun = true, knownLatest = null } = {}) {
  const status = memoryStatus();
  if (!candidate?.kind || !candidate?.key) {
    return { ok: false, skipped: true, reason: 'candidate needs kind and key' };
  }

  const namespace = namespaceFor(candidate.kind);
  const latest = knownLatest ?? (await latestMemory(candidate.kind, candidate.key));
  if (isUnchangedFacts(candidate, latest)) {
    return {
      ok: true,
      dryRun,
      skipped: true,
      reason: `unchanged since v${latest.version} (${latest.blobId || 'no blob'})`,
      kind: candidate.kind,
      key: candidate.key,
      namespace,
      version: latest.version,
      contentHash: latest.contentHash,
    };
  }

  const version = Math.max(
    await latestLedgerVersion({ kind: candidate.kind, memkey: candidate.key }),
    Number(latest?.version) || 0
  ) + 1;
  const plan = planMemory(candidate, { version });

  if (dryRun) {
    return { ok: true, dryRun: true, skipped: false, ...plan, network: status.network, writable: status.writable, reason: status.reason };
  }
  if (!status.writable) {
    return { ok: false, dryRun: false, skipped: true, reason: status.reason || 'memory is not writable', ...plan };
  }

  const claimed = await claimMemoryWrite({
    idempotencyKey: plan.idempotencyKey,
    kind: plan.kind,
    namespace: plan.namespace,
    memkey: plan.key,
    version: plan.version,
    textSha256: plan.textSha256,
    network: status.network,
    triggerReceipt: plan.triggerReceipt,
    evidenceSource: plan.evidenceSource,
  });
  if (claimed.duplicate && claimed.row?.blob_id) {
    return { ok: true, skipped: true, reason: 'already written (idempotent replay)', blobId: claimed.row.blob_id, ...plan };
  }

  let client;
  try {
    client = await getClient();
  } catch (error) {
    await failMemoryWrite(plan.idempotencyKey, error);
    return { ok: false, skipped: true, error: error.message, code: error.code, ...plan };
  }
  if (!client) {
    await failMemoryWrite(plan.idempotencyKey, new Error('client unavailable'));
    return { ok: false, skipped: true, reason: 'client unavailable', ...plan };
  }

  try {
    // Positional namespace is the only way to name it: passing an object there
    // keeps the client default, which would silently co-locate every kind.
    const result = await client.rememberAndWait(plan.text, namespace, { idempotencyKey: plan.idempotencyKey });
    await confirmMemoryWrite(plan.idempotencyKey, {
      blobId: result?.blob_id || null,
      memoryId: result?.id || null,
      owner: result?.owner || null,
    });
    return { ok: true, dryRun: false, ...plan, blobId: result?.blob_id || null, memoryId: result?.id || null, owner: result?.owner || null };
  } catch (error) {
    await failMemoryWrite(plan.idempotencyKey, error);
    console.error('[memory] write failed:', error.message);
    return { ok: false, error: error.message, ...plan };
  }
}

/** Skip the append when the newest confirmed rung already says exactly this. */
export function isUnchangedFacts(candidate, latest) {
  if (!latest?.contentHash) return false;
  return factsDigest(candidate) === latest.contentHash;
}

/**
 * The truth for one key: recall inside the type namespace, parse every header,
 * keep only exact `kind key` matches, take the highest version. Returns null on
 * any failure — a caller must be able to fall back to the DB without a throw.
 */
export async function latestMemory(kind, key, { limit = 24, client = null } = {}) {
  const ladder = await listMemoryLadder(kind, key, { limit, client, depth: 1 });
  return ladder[0] || null;
}

export async function listMemoryLadder(kind, key, { limit = 24, client = null, depth = LADDER_DEPTH } = {}) {
  const hits = (await recallParsed(kind, `${kind} ${key}`, { limit, client })).filter((h) => h.key === key);
  return hits.sort((a, b) => b.version - a.version).slice(0, Math.max(1, depth));
}

/**
 * Every rung of one kind, newest key first — the read a fresh deployment needs
 * when it has no local `memory_writes` rows to tell it which keys exist. Recall
 * is a semantic search, so the query is a description of what we want back;
 * the parse is what makes the answer deterministic.
 */
export async function listKindMemories(kind, { query = null, limit = 40, client = null } = {}) {
  const hits = await recallParsed(kind, query || `${kind} calibration buckets`, { limit, client });
  return hits.sort(
    (a, b) => String(b.key).localeCompare(String(a.key)) || b.version - a.version
  );
}

/**
 * Recall inside one type namespace and parse every header. Anything that does
 * not parse, or parses to a different kind, is dropped: a fuzzy match on
 * `0xabc` must not be able to quote `0xabcdef`'s credibility. Fails closed to
 * an empty list so callers can fall back to the DB without a throw.
 */
async function recallParsed(kind, queryText, { limit = 24, client = null } = {}) {
  const namespace = namespaceFor(kind);
  try {
    const resolved = client || (await getClient());
    if (!resolved) return [];
    const result = await resolved.recall({ query: queryText, namespace, limit });
    const hits = [];
    for (const memory of result?.results || []) {
      const parsed = parseMemoryText(memory.text);
      if (!parsed.ok || parsed.kind !== kind) continue;
      hits.push({
        key: parsed.key,
        version: fieldNumber(parsed.fields, 'v') || 0,
        asOf: fieldValue(parsed.fields, 'as_of'),
        fields: parsed.fields,
        note: parsed.note,
        text: memory.text,
        header: parsed.header,
        blobId: memory.blob_id,
        distance: memory.distance,
        createdAt: memory.created_at || null,
        contentHash: factsDigest({ kind: parsed.kind, key: parsed.key, fields: withoutSpine(parsed.fields) }),
      });
    }
    return hits;
  } catch (error) {
    console.error(`[memory] recall failed for kind ${kind}:`, error.message);
    return [];
  }
}

function withoutSpine(fields = {}) {
  const rest = { ...fields };
  delete rest.v;
  delete rest.as_of;
  return rest;
}

/**
 * Prove the ledger against the relayer. listMemories() returns metadata only,
 * so the join is blob_id: rows we wrote that the relayer does not list are
 * writes that did not land, and blobs the relayer lists that we never recorded
 * are writes we cannot explain. Both are reportable, neither is a shrug.
 */
export async function reconcileLedger({ pageSize = 200 } = {}) {
  const client = await getClient();
  if (!client) return { ok: false, skipped: true, reason: memoryStatus().reason || 'memory not configured' };

  const seen = new Map();
  let cursor;
  let pages = 0;
  let mustResync = false;
  do {
    const page = await client.listMemories({ cursor, limit: pageSize });
    mustResync = Boolean(page?.must_resync) || mustResync;
    for (const memory of page?.memories || []) {
      seen.set(memory.blob_id, memory);
    }
    cursor = page?.next_cursor || null;
    pages += 1;
  } while (cursor && pages < 40);

  const ours = await ledgerBlobIds();
  const oursSet = new Set(ours);
  const relayerOnly = [...seen.keys()].filter((blob) => !oursSet.has(blob));
  const ledgerOnly = ours.filter((blob) => !seen.has(blob));
  const byNamespace = {};
  for (const memory of seen.values()) {
    byNamespace[memory.namespace_id] = (byNamespace[memory.namespace_id] || 0) + 1;
  }
  return {
    ok: true,
    relayerCount: seen.size,
    ledgerCount: ours.length,
    matched: ours.filter((blob) => seen.has(blob)).length,
    relayerOnly,
    ledgerOnly,
    byNamespace,
    pages,
    mustResync,
  };
}
