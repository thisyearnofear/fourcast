-- Durable evidence for each autonomous run. The summary is intentionally
-- denormalized: it is a replayable decision receipt, not a second forecast store.
ALTER TABLE agent_runs ADD COLUMN run_mode TEXT DEFAULT 'advisory';
ALTER TABLE agent_runs ADD COLUMN summary TEXT;
