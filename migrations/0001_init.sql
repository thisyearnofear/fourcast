-- Migration: 0001_init.sql
-- Description: Initial schema setup
-- Created: 2026-05-22

-- Positions table for tracking user trades
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  market_id TEXT NOT NULL,
  market_title TEXT,
  platform TEXT,
  side TEXT NOT NULL,
  entry_price REAL NOT NULL,
  size REAL NOT NULL,
  status TEXT DEFAULT 'OPEN',
  realized_pnl REAL DEFAULT 0,
  entry_timestamp INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_address);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);

-- Predictions table for user forecast history
CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  market_id TEXT NOT NULL,
  market_title TEXT,
  side TEXT NOT NULL,
  stake_wei TEXT NOT NULL,
  odds_bps INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  tx_hash TEXT,
  metadata_uri TEXT,
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_address ON predictions(user_address);
CREATE INDEX IF NOT EXISTS idx_market_id ON predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_chain_id ON predictions(chain_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON predictions(timestamp DESC);

-- Market outcomes for resolution tracking
CREATE TABLE IF NOT EXISTS market_outcomes (
  market_id TEXT PRIMARY KEY,
  resolved BOOLEAN DEFAULT 0,
  outcome TEXT,
  resolution_time INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- User stats aggregation
CREATE TABLE IF NOT EXISTS user_stats (
  user_address TEXT PRIMARY KEY,
  total_predictions INTEGER DEFAULT 0,
  total_stake_wei TEXT DEFAULT '0',
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Signals table for on-chain published forecasts
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  market_title TEXT,
  venue TEXT,
  event_time INTEGER,
  market_snapshot_hash TEXT,
  weather_json TEXT,
  ai_digest TEXT,
  confidence TEXT,
  odds_efficiency TEXT,
  author_address TEXT,
  tx_hash TEXT,
  timestamp INTEGER NOT NULL,
  outcome TEXT DEFAULT 'PENDING',
  total_tips TEXT DEFAULT '0',
  chain_origin TEXT DEFAULT 'APTOS',
  resolved_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_signals_event_id ON signals(event_id);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_author_outcome ON signals(author_address, outcome);

-- Agent forecasts for track record
CREATE TABLE IF NOT EXISTS agent_forecasts (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  market_title TEXT,
  platform TEXT,
  ai_probability REAL NOT NULL,
  market_odds REAL NOT NULL,
  edge REAL NOT NULL,
  confidence TEXT,
  reasoning TEXT,
  key_factors TEXT,
  timestamp INTEGER NOT NULL,
  resolved BOOLEAN DEFAULT 0,
  actual_outcome REAL,
  brier_score REAL,
  resolution_time INTEGER,
  autopilot_executed BOOLEAN DEFAULT 0,
  execution_status TEXT,
  execution_response TEXT,
  size_pct REAL,
  kelly_pct REAL,
  direction TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_forecasts_market_id ON agent_forecasts(market_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_timestamp ON agent_forecasts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_resolved ON agent_forecasts(resolved);
CREATE INDEX IF NOT EXISTS idx_forecasts_autopilot ON agent_forecasts(autopilot_executed);

-- Agent runs metadata
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  config TEXT,
  markets_scanned INTEGER,
  candidates_filtered INTEGER,
  forecasts_made INTEGER,
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_timestamp ON agent_runs(timestamp DESC);