-- Migration: 0015_memory_writes.sql
-- Description: Local ledger of every memory Fourcast appends to Walrus Memory.
--
-- The Total Recall entry claims "at least 10 memories on Sui mainnet". A claim
-- like that needs a receipt trail, and the relayer's listMemories() returns
-- metadata only (blob_id, namespace, created_at) -- no text. So this table
-- records what WE wrote and WHY, and the sync script diffs it against the
-- relayer inventory by blob_id. Rows in mainnet but not here, or here but not
-- on mainnet, are both findings rather than shrugs.
--
-- idempotency_key is UNIQUE and doubles as the MemWal SDK idempotency key, so a
-- retried write collapses onto the original job instead of duplicating a
-- memory. MemWal is append-only: a corrected metric is a NEW row with a higher
-- version for the same (kind, memkey). That version ladder is the demo.

CREATE TABLE IF NOT EXISTS memory_writes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,
  namespace TEXT NOT NULL,
  memkey TEXT NOT NULL,
  version INTEGER NOT NULL,
  text_sha256 TEXT NOT NULL,
  blob_id TEXT,
  memory_id TEXT,
  owner TEXT,
  network TEXT,
  trigger_receipt TEXT,
  evidence_source TEXT,
  error TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  written_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memory_writes_key ON memory_writes(kind, memkey, version);
CREATE INDEX IF NOT EXISTS idx_memory_writes_blob ON memory_writes(blob_id);
CREATE INDEX IF NOT EXISTS idx_memory_writes_written ON memory_writes(written_at);
