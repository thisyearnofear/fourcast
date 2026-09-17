-- Migration: 0013_calibration_buckets.sql
-- Description: Add confidence bucket analysis to agent_forecasts.
-- Enables bucketed hit-rate tracking, Brier score aggregation, and
-- the calibration curve data that proves Fourcast's "sized on calibrated
-- confidence, not vibes" narrative.

-- Add confidence bucket for programmatic analysis.
-- LOW < 0.50, MEDIUM 0.50-0.75, HIGH >= 0.75
-- Set on insert via saveForecast; also backfill existing rows.
ALTER TABLE agent_forecasts ADD COLUMN confidence_bucket TEXT;

CREATE INDEX IF NOT EXISTS idx_forecasts_bucket ON agent_forecasts(confidence_bucket);
CREATE INDEX IF NOT EXISTS idx_forecasts_bucket_resolved ON agent_forecasts(confidence_bucket, resolved);

-- Backfill existing unbucketed rows (confidence is stored as text: LOW/MEDIUM/HIGH already).
-- If confidence column is empty, derive from a default heuristic:
--   edge > 10% → HIGH, edge > 5% → MEDIUM, else → LOW
UPDATE agent_forecasts
SET confidence_bucket = CASE
  WHEN confidence = 'HIGH' THEN 'HIGH'
  WHEN confidence = 'MEDIUM' THEN 'MEDIUM'
  WHEN confidence = 'LOW' THEN 'LOW'
  WHEN edge > 0.10 THEN 'HIGH'
  WHEN edge > 0.05 THEN 'MEDIUM'
  ELSE 'LOW'
END
WHERE confidence_bucket IS NULL;
