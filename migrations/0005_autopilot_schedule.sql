-- Migration: 0005_autopilot_schedule.sql
-- Description: Persisted on/off switch and interval for autopilot scheduler
-- Created: 2026-07-13

CREATE TABLE IF NOT EXISTS autopilot_schedule (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  interval_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO autopilot_schedule (id, enabled, interval_minutes, updated_at)
VALUES (1, 0, 60, 0);
