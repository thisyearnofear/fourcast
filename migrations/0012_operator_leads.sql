-- Operator "Talk to us" capture — wedge buyers who size into prediction
-- markets and care about leakage. Not a vanity waitlist; interview pipeline.

CREATE TABLE IF NOT EXISTS operator_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  sizes INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  source TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_operator_leads_created ON operator_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_operator_leads_email ON operator_leads(email);
