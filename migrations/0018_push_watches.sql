-- Browser push subscriptions for watched receipts. Empty until someone opts in.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS push_watches (
  endpoint TEXT NOT NULL,
  fixture_id TEXT NOT NULL,
  home TEXT,
  away TEXT,
  last_status TEXT,
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (endpoint, fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_push_watches_fixture ON push_watches(fixture_id);
