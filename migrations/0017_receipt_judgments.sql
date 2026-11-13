-- One judgment per browser per fixture. Counts are real votes, never seeded.

CREATE TABLE IF NOT EXISTS receipt_judgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  holds INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (fixture_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_receipt_judgments_fixture ON receipt_judgments(fixture_id);
