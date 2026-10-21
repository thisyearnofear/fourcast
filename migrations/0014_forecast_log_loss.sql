-- Migration: 0014_forecast_log_loss.sql
-- Description: Persist binary log-loss alongside the Brier point.
--
-- The Total Recall memory schema asks for "Brier, log-loss, hit rate, sample
-- size" per analyst/source/window. Brier was scored at resolution; log-loss
-- never was. Log-loss is the stricter proper score and the one that punishes
-- confident-wrong, which is exactly what Kelly sizing is unforgiving of.
--
-- The value is DERIVED, not invented: log_loss = -(o·ln(p) + (1-o)·ln(1-p))
-- computed in services/db.js from the row's own ai_probability and
-- actual_outcome. Backfill runs in JS (backfillForecastLogLoss) because SQLite
-- math functions (ln) are not guaranteed on every libsql/better-sqlite3 build,
-- and a migration that fails half-applied is worse than a slow one.

ALTER TABLE agent_forecasts ADD COLUMN log_loss REAL;

CREATE INDEX IF NOT EXISTS idx_forecasts_resolved_bucket ON agent_forecasts(resolved, confidence_bucket);
