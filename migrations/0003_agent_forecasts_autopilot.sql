-- Migration: 0003_agent_forecasts_autopilot.sql
-- Description: Add autopilot execution tracking columns to agent_forecasts
-- Created: 2026-05-22

-- Add autopilot execution tracking columns
ALTER TABLE agent_forecasts ADD COLUMN autopilot_executed BOOLEAN DEFAULT 0;
ALTER TABLE agent_forecasts ADD COLUMN execution_status TEXT;
ALTER TABLE agent_forecasts ADD COLUMN execution_response TEXT;
ALTER TABLE agent_forecasts ADD COLUMN size_pct REAL;
ALTER TABLE agent_forecasts ADD COLUMN kelly_pct REAL;
ALTER TABLE agent_forecasts ADD COLUMN direction TEXT;

-- Add market_title and platform to positions if not exists
ALTER TABLE positions ADD COLUMN market_title TEXT;
ALTER TABLE positions ADD COLUMN platform TEXT;
ALTER TABLE positions ADD COLUMN entry_timestamp INTEGER;