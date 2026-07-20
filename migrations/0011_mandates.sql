-- Persisted mandate drafts — the "Save as my mandate" half of the self-serve
-- concierge path (docs/GO_TO_MARKET.md §2.2). A prospect adjusts the four
-- policy knobs in the MandateBuilder UI, saves, and gets back an anonymous
-- operator_id (UUID). The /agent/[operatorId] page reads this back so their
-- Track Record URL is self-populated when they revisit.
--
-- No auth in this slice — operator_id is an unauthenticated UUID. Auth +
-- private mandates are a Premium-tier feature, post-concierge-test.
--
-- The four policy knobs match createDecisionPolicy() in
-- services/domain/decision/decisionPolicy.js exactly. version is the
-- DECISION_POLICY_VERSION the mandate was saved against, so future policy
-- schema changes can be detected and migrated.

CREATE TABLE IF NOT EXISTS mandates (
  operator_id TEXT PRIMARY KEY,
  min_absolute_edge REAL NOT NULL,
  max_allocation_pct REAL NOT NULL,
  max_loss_probability REAL NOT NULL,
  simulation_runs INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
