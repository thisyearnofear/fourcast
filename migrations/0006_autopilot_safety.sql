-- Migration: 0006_autopilot_safety.sql
-- Description: Autopilot safety columns — dry-run default, last run tracking, daily spend cap
-- Created: 2026-07-13

ALTER TABLE autopilot_schedule ADD COLUMN dry_run INTEGER NOT NULL DEFAULT 1;
ALTER TABLE autopilot_schedule ADD COLUMN last_run_at INTEGER;
ALTER TABLE autopilot_schedule ADD COLUMN daily_cap_pct REAL NOT NULL DEFAULT 0.5;
