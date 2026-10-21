/**
 * Local ledger of memory writes (table `memory_writes`, migration 0015).
 *
 * MemWal is append-only and its listMemories() returns metadata only, so this
 * table is where the "why" of each write lives: which key, which version, which
 * content hash, which on-chain blob, and what receipt triggered it. It is what
 * makes the entry's "≥10 memories on mainnet" claim auditable instead of vibes:
 * scripts/memories-to-mainnet.mjs diffs these rows against the relayer by
 * blob_id, and /api/memory/status counts from here.
 *
 * A row is written BEFORE the remember() call (status = pending, no blob_id) so
 * a crash mid-write leaves evidence, not a mystery.
 */

import { query, execute, migrationsReady } from '../db.js';

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Register an intent to write. `ON CONFLICT DO NOTHING` on idempotency_key is
 * the whole retry story: the same facts re-run return the existing row instead
 * of appending a second memory.
 */
export async function claimMemoryWrite({
  idempotencyKey,
  kind,
  namespace,
  memkey,
  version,
  textSha256,
  network = null,
  triggerReceipt = null,
  evidenceSource = null,
}) {
  await migrationsReady;
  if (!idempotencyKey) throw new Error('claimMemoryWrite requires an idempotencyKey');
  if (!textSha256) throw new Error('claimMemoryWrite requires a textSha256');

  const existing = await query('SELECT * FROM memory_writes WHERE idempotency_key = ?', [idempotencyKey]);
  if (existing.length > 0) return { claimed: false, row: existing[0], duplicate: true };

  await execute(
    `INSERT INTO memory_writes
      (idempotency_key, kind, namespace, memkey, version, text_sha256, network,
       trigger_receipt, evidence_source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idempotencyKey,
      kind,
      namespace,
      memkey,
      version,
      textSha256,
      network,
      triggerReceipt,
      evidenceSource,
      nowEpoch(),
    ]
  );
  const rows = await query('SELECT * FROM memory_writes WHERE idempotency_key = ?', [idempotencyKey]);
  return { claimed: true, row: rows[0] || null, duplicate: false };
}

export async function confirmMemoryWrite(idempotencyKey, { blobId, memoryId = null, owner = null }) {
  await migrationsReady;
  await execute(
    `UPDATE memory_writes
      SET blob_id = ?, memory_id = ?, owner = ?, written_at = ?, error = NULL
      WHERE idempotency_key = ?`,
    [blobId || null, memoryId, owner, nowEpoch(), idempotencyKey]
  );
  return true;
}

export async function failMemoryWrite(idempotencyKey, error) {
  await migrationsReady;
  await execute('UPDATE memory_writes SET error = ? WHERE idempotency_key = ?', [
    String(error?.message || error || 'unknown').slice(0, 500),
    idempotencyKey,
  ]);
  return true;
}

/** Highest version we have ever claimed for this key — 0 when none. */
export async function latestLedgerVersion({ kind, memkey }) {
  await migrationsReady;
  const rows = await query(
    `SELECT MAX(version) as version FROM memory_writes WHERE kind = ? AND memkey = ?`,
    [kind, memkey]
  );
  return toInt(rows[0]?.version) || 0;
}

export async function listMemoryWrites({ kind = null, memkey = null, limit = 50 } = {}) {
  await migrationsReady;
  const clauses = [];
  const params = [];
  if (kind) {
    clauses.push('kind = ?');
    params.push(kind);
  }
  if (memkey) {
    clauses.push('memkey = ?');
    params.push(memkey);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(Math.max(1, Math.min(500, Number(limit) || 50)));
  const rows = await query(
    `SELECT * FROM memory_writes ${where} ORDER BY version DESC, created_at DESC LIMIT ?`,
    params
  );
  return rows;
}

/**
 * The headline count: confirmed, on-chain writes per network. `confirmed` means
 * we hold a blob_id from the relayer — an accepted-but-unresolved job is not a
 * memory, and counting one would overstate the deliverable.
 */
export async function memoryLedgerSummary() {
  await migrationsReady;
  const rows = await query(
    `SELECT network,
            COUNT(*) as total,
            SUM(CASE WHEN blob_id IS NOT NULL THEN 1 ELSE 0 END) as confirmed,
            SUM(CASE WHEN blob_id IS NULL AND error IS NULL THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as failed
      FROM memory_writes
      GROUP BY network`,
    []
  );
  const byKey = await query(
    `SELECT kind, COUNT(DISTINCT memkey) as distinct_keys, MAX(version) as max_version
      FROM memory_writes
      GROUP BY kind`,
    []
  );
  const byNetwork = rows.map((r) => ({
    network: r.network || 'unknown',
    total: toInt(r.total) || 0,
    confirmed: toInt(r.confirmed) || 0,
    pending: toInt(r.pending) || 0,
    failed: toInt(r.failed) || 0,
  }));
  return {
    byNetwork,
    byKind: byKey.map((r) => ({
      kind: r.kind,
      distinctKeys: toInt(r.distinct_keys) || 0,
      maxVersion: toInt(r.max_version) || 0,
    })),
    confirmed: byNetwork.reduce((sum, n) => sum + n.confirmed, 0),
    mainnetConfirmed: byNetwork.find((n) => n.network === 'mainnet')?.confirmed || 0,
  };
}

/** Every blob_id we believe we wrote, for the relayer-inventory diff. */
export async function ledgerBlobIds() {
  await migrationsReady;
  const rows = await query('SELECT DISTINCT blob_id FROM memory_writes WHERE blob_id IS NOT NULL', []);
  return rows.map((r) => r.blob_id).filter(Boolean);
}
