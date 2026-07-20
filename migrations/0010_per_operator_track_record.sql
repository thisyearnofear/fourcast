-- Per-operator track record. The flagship route's GTM doc (docs/GO_TO_MARKET.md
-- section 2.2 step 4) requires a public Track Record URL per operator. Today
-- agent_forecasts is global — this migration adds an operator_id column so
-- forecasts can be scoped to a single operator's URL.
--
-- operator_id is nullable for back-compat with existing rows (which belong to
-- the global/legacy agent). New forecasts from the self-serve mandate builder
-- (Slice 4) and from per-operator worker runs write a non-null operator_id.
--
-- The id is an unauthenticated UUID in Slice 4. Auth + private mandates are
-- a Premium-tier feature, post-concierge-test. The index supports the
-- /api/agent/track-record/:operatorId lookup.

ALTER TABLE agent_forecasts ADD COLUMN operator_id TEXT;

CREATE INDEX IF NOT EXISTS idx_forecasts_operator_id ON agent_forecasts(operator_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_operator_resolved ON agent_forecasts(operator_id, resolved);
