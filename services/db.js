// Database service for prediction history and analytics
// Uses Turso (LibSQL) for production, SQLite for local development

import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

let db;
let isTurso = false;

// Initialize database
if (process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN) {
  // Production: Use Turso
  db = createClient({
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  isTurso = true;
  console.log('Using Turso database');
} else {
  // Development: Use local SQLite
  const dbPath = path.join(process.cwd(), 'fourcast.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  try {
    db.pragma('journal_mode = WAL');
  } catch (err) {
    console.warn('Failed to set WAL mode:', err.message);
  }
  console.log('Using local SQLite database');
}

// Create tables
const initSql = `
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

  CREATE TABLE IF NOT EXISTS market_outcomes (
    market_id TEXT PRIMARY KEY,
    resolved BOOLEAN DEFAULT 0,
    outcome TEXT,
    resolution_time INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    user_address TEXT PRIMARY KEY,
    total_predictions INTEGER DEFAULT 0,
    total_stake_wei TEXT DEFAULT '0',
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

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
    -- Autopilot execution tracking
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
`;

// ── Migration: Add autopilot columns to agent_forecasts (safe for existing DBs) ──
const migrationSql = `
  ALTER TABLE agent_forecasts ADD COLUMN autopilot_executed BOOLEAN DEFAULT 0;
  ALTER TABLE agent_forecasts ADD COLUMN execution_status TEXT;
  ALTER TABLE agent_forecasts ADD COLUMN execution_response TEXT;
  ALTER TABLE agent_forecasts ADD COLUMN size_pct REAL;
  ALTER TABLE agent_forecasts ADD COLUMN kelly_pct REAL;
  ALTER TABLE agent_forecasts ADD COLUMN direction TEXT;
  ALTER TABLE positions ADD COLUMN market_title TEXT;
  ALTER TABLE positions ADD COLUMN platform TEXT;
  ALTER TABLE positions ADD COLUMN entry_timestamp INTEGER;
`;

// Initialize tables
const runMigrations = () => {
  const migrationStmts = migrationSql.split(';').filter(s => s.trim());
  for (const stmt of migrationStmts) {
    if (stmt.trim()) {
      try {
        if (isTurso) {
          // Turso handled asynchronously below
        } else {
          db.exec(stmt.trim());
        }
      } catch (err) {
        if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
          console.warn('Migration warning:', err.message);
        }
      }
    }
  }
};

if (isTurso) {
  // Split SQL statements for Turso (it doesn't support multiple statements at once)
  const statements = initSql.split(';').filter(s => s.trim());
  const migrationStatements = migrationSql.split(';').filter(s => s.trim());
  (async () => {
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await db.execute(stmt.trim());
        } catch (err) {
          if (!err.message.includes('already exists')) {
            console.warn('Failed to create table:', err.message);
          }
        }
      }
    }
    // Run migrations
    for (const stmt of migrationStatements) {
      if (stmt.trim()) {
        try {
          await db.execute(stmt.trim());
        } catch (err) {
          if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.warn('Migration failed:', err.message);
          }
        }
      }
    }
  })();
} else {
  db.exec(initSql);
  runMigrations();
}

// Database operation helpers
async function execute(sql, params = []) {
  if (isTurso) {
    try {
      return await db.execute({
        sql,
        args: params,
      });
    } catch (err) {
      console.error('Execute error:', err, 'SQL:', sql);
      throw err;
    }
  } else {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      return stmt.run(...params);
    } else {
      return stmt.run();
    }
  }
}

async function query(sql, params = []) {
  if (isTurso) {
    try {
      const result = await db.execute({
        sql,
        args: params,
      });
      // Turso returns rows as an array of objects
      return Array.isArray(result) ? result : (result.rows || []);
    } catch (err) {
      console.error('Query error:', err);
      throw err;
    }
  } else {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      return stmt.all(...params);
    } else {
      return stmt.all();
    }
  }
}

/**
 * Position Management
 */
export async function openPosition(position) {
  try {
    await execute(
      `INSERT INTO positions (
        id, user_address, market_id, market_title, platform, side, entry_price, size, entry_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        position.id,
        position.userAddress.toLowerCase(),
        position.marketId,
        position.marketTitle || null,
        position.platform || null,
        position.side,
        position.entryPrice,
        position.size,
        position.entryTimestamp || Math.floor(Date.now() / 1000),
      ]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function closePosition(positionId, exitPrice, realizedPnl) {
  try {
    await execute(
      `UPDATE positions
       SET status = 'CLOSED', realized_pnl = ?, updated_at = strftime('%s', 'now')
       WHERE id = ?`,
      [realizedPnl, positionId]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getUserPositions(userAddress, status = 'all') {
  try {
    const statusFilter = status === 'all' ? '' : 'AND status = ?';
    const params = status === 'all'
      ? [userAddress.toLowerCase()]
      : [userAddress.toLowerCase(), status];
    const rows = await query(
      `SELECT * FROM positions WHERE user_address = ? ${statusFilter} ORDER BY created_at DESC`,
      params
    );
    return { success: true, positions: rows };
  } catch (error) {
    return { success: false, error: error.message, positions: [] };
  }
}

export async function savePrediction(prediction) {
  try {
    // Validate timestamp is reasonable (within 5 min of now)
    const now = Math.floor(Date.now() / 1000)
    const timeDiff = Math.abs(now - prediction.timestamp)
    if (timeDiff > 300) {
      console.warn(`Prediction timestamp off by ${timeDiff}s - possible clock skew`)
    }

    await execute(
      `INSERT INTO predictions (
        id, user_address, market_id, market_title, side, 
        stake_wei, odds_bps, chain_id, tx_hash, metadata_uri, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prediction.id,
        prediction.userAddress.toLowerCase(),
        prediction.marketId,
        prediction.marketTitle || null,
        prediction.side,
        prediction.stakeWei.toString(),
        prediction.oddsBps,
        prediction.chainId,
        prediction.txHash || null,
        prediction.metadataUri || null,
        prediction.timestamp
      ]
    );

    // Update user stats
    await execute(
      `INSERT INTO user_stats (user_address, total_predictions, total_stake_wei)
       VALUES (?, 1, ?)
       ON CONFLICT(user_address) DO UPDATE SET
         total_predictions = total_predictions + 1,
         total_stake_wei = CAST(total_stake_wei AS INTEGER) + CAST(excluded.total_stake_wei AS INTEGER),
         updated_at = strftime('%s', 'now')`,
      [prediction.userAddress.toLowerCase(), prediction.stakeWei.toString()]
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to save prediction:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get predictions by user
 */
export async function getPredictionsByUser(userAddress, limit = 50) {
  try {
    const rows = await query(
      `SELECT * FROM predictions 
       WHERE user_address = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [userAddress.toLowerCase(), limit]
    );
    return { success: true, predictions: rows };
  } catch (error) {
    return { success: false, error: error.message, predictions: [] };
  }
}

/**
 * Get predictions by user (alias for getPredictionsByUser)
 */
export async function getUserPredictions(userAddress, limit = 50) {
  return getPredictionsByUser(userAddress, limit);
}

/**
 * Get predictions by market
 */
export async function getPredictionsByMarket(marketId, limit = 50) {
  try {
    const rows = await query(
      `SELECT * FROM predictions 
       WHERE market_id = ? 
       ORDER BY timestamp DESC
       LIMIT ?`,
      [marketId, limit]
    );
    return { success: true, predictions: rows };
  } catch (error) {
    return { success: false, error: error.message, predictions: [] };
  }
}

/**
 * Get user stats
 */
export async function getUserStats(userAddress) {
  try {
    const rows = await query(
      `SELECT * FROM user_stats 
       WHERE user_address = ?`,
      [userAddress.toLowerCase()]
    );
    return { success: true, stats: rows[0] || null };
  } catch (error) {
    return { success: false, error: error.message, stats: null };
  }
}

/**
 * Get recent predictions
 */
export async function getRecentPredictions(limit = 50) {
  try {
    const rows = await query(
      `SELECT p.*, m.resolved, m.outcome
       FROM predictions p
       LEFT JOIN market_outcomes m ON p.market_id = m.market_id
       ORDER BY p.timestamp DESC
       LIMIT ?`,
      [limit]
    );
    return { success: true, predictions: rows };
  } catch (error) {
    return { success: false, error: error.message, predictions: [] };
  }
}

/**
 * Set market outcome
 */
export async function setMarketOutcome(marketId, outcome, resolutionTime) {
  try {
    await execute(
      `INSERT INTO market_outcomes (market_id, resolved, outcome, resolution_time)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(market_id) DO UPDATE SET
         resolved = 1,
         outcome = excluded.outcome,
         resolution_time = excluded.resolution_time`,
      [marketId, outcome, resolutionTime]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Save a signal to the database
 */
export async function saveSignal(signal) {
  try {
    await execute(
      `INSERT INTO signals (
        id, event_id, market_title, venue, event_time, market_snapshot_hash,
        weather_json, ai_digest, confidence, odds_efficiency, author_address,
        tx_hash, timestamp, chain_origin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signal.id,
        signal.event_id,
        signal.market_title,
        signal.venue,
        signal.event_time,
        signal.market_snapshot_hash,
        signal.weather_json ? JSON.stringify(signal.weather_json) : null,
        signal.ai_digest,
        signal.confidence,
        signal.odds_efficiency,
        (signal.author_address && typeof signal.author_address === 'string') ? signal.author_address.toLowerCase() : null,
        signal.tx_hash,
        signal.timestamp,
        signal.chain_origin || 'APTOS'
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to save signal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get latest signals
 */
export async function getLatestSignals(limit = 20) {
  try {
    const rows = await query(
      `SELECT * FROM signals
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    );
    return { success: true, signals: rows };
  } catch (error) {
    return { success: false, error: error.message, signals: [] };
  }
}

/**
 * Get signals by event
 */
export async function getSignalsByEvent(eventId, limit = 50) {
  try {
    const rows = await query(
      `SELECT * FROM signals
       WHERE event_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [eventId, limit]
    );
    return { success: true, signals: rows };
  } catch (error) {
    return { success: false, error: error.message, signals: [] };
  }
}

/**
 * Update signal tx_hash
 */
export async function updateSignalTxHash(id, txHash) {
  try {
    await execute(
      `UPDATE signals 
       SET tx_hash = ? 
       WHERE id = ?`,
      [txHash, id]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get signal count for a user
 */
export async function getSignalCount(authorAddress) {
  try {
    const rows = await query(
      `SELECT COUNT(*) as count FROM signals
       WHERE author_address = ?`,
      [authorAddress.toLowerCase()]
    );
    return rows[0]?.count || 0;
  } catch (error) {
    console.error('Failed to get signal count:', error);
    return 0;
  }
}

/**
 * Get leaderboard (top analysts by win rate)
 */
export async function getLeaderboard(limit = 50) {
  try {
    const rows = await query(
      `SELECT 
         author_address as user_address,
         COUNT(*) as total_predictions,
         SUM(CASE WHEN confidence = 'HIGH' THEN 1 ELSE 0 END) as high_confidence_signals,
         AVG(CASE WHEN odds_efficiency = 'EFFICIENT' THEN 1 ELSE 0 END) as win_rate
       FROM signals
       WHERE author_address IS NOT NULL
       GROUP BY author_address
       ORDER BY high_confidence_signals DESC, total_predictions DESC
       LIMIT ?`,
      [limit]
    );
    return { success: true, leaderboard: rows };
  } catch (error) {
    return { success: false, error: error.message, leaderboard: [] };
  }
}

/**
 * Save an agent forecast to the database for track record
 */
export async function saveForecast(forecast) {
  try {
    await execute(
      `INSERT INTO agent_forecasts (
        id, market_id, market_title, platform, ai_probability, market_odds,
        edge, confidence, reasoning, key_factors, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        forecast.id,
        forecast.marketID,
        forecast.title,
        forecast.platform,
        forecast.aiProbability,
        forecast.marketOdds,
        forecast.edge,
        forecast.confidence,
        forecast.reasoning || null,
        forecast.keyFactors ? JSON.stringify(forecast.keyFactors) : null,
        forecast.timestamp || Math.floor(Date.now() / 1000),
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to save forecast:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update forecast with actual outcome and calculate Brier score
 */
export async function resolveForecast(marketId, actualOutcome) {
  try {
    const rows = await query(
      `SELECT * FROM agent_forecasts WHERE market_id = ? AND resolved = 0`,
      [marketId]
    );

    for (const forecast of rows) {
      const brierScore = Math.pow(forecast.ai_probability - actualOutcome, 2);
      await execute(
        `UPDATE agent_forecasts 
         SET resolved = 1, actual_outcome = ?, brier_score = ?, resolution_time = ?
         WHERE id = ?`,
        [actualOutcome, brierScore, Math.floor(Date.now() / 1000), forecast.id]
      );
    }

    return { success: true, resolved: rows.length };
  } catch (error) {
    console.error('Failed to resolve forecast:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get agent track record statistics
 */
export async function getAgentTrackRecord() {
  try {
    const stats = await query(
      `SELECT 
        COUNT(*) as total_forecasts,
        COUNT(CASE WHEN resolved = 1 THEN 1 END) as resolved_forecasts,
        AVG(CASE WHEN resolved = 1 THEN brier_score END) as avg_brier_score,
        AVG(CASE WHEN resolved = 1 AND confidence = 'HIGH' THEN brier_score END) as high_conf_brier,
        COUNT(CASE WHEN resolved = 1 AND confidence = 'HIGH' THEN 1 END) as high_conf_count
       FROM agent_forecasts`
    );

    const recentForecasts = await query(
      `SELECT * FROM agent_forecasts 
       WHERE resolved = 1 
       ORDER BY resolution_time DESC 
       LIMIT 50`
    );

    return {
      success: true,
      stats: stats[0],
      recentForecasts,
    };
  } catch (error) {
    console.error('Failed to get track record:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if market was recently analyzed (within hours)
 */
export async function wasRecentlyAnalyzed(marketId, hoursAgo = 6) {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - (hoursAgo * 3600);
    const rows = await query(
      `SELECT id FROM agent_forecasts 
       WHERE market_id = ? AND timestamp > ?
       LIMIT 1`,
      [marketId, cutoff]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to check recent analysis:', error);
    return false;
  }
}

/**
 * Update a forecast record with autopilot execution result
 */
export async function updateForecastExecution(forecastId, execution) {
  try {
    await execute(
      `UPDATE agent_forecasts 
       SET autopilot_executed = 1,
           execution_status = ?,
           execution_response = ?,
           size_pct = ?,
           kelly_pct = ?,
           direction = ?
       WHERE id = ?`,
      [
        execution.success ? 'SUCCESS' : 'FAILED',
        execution.orderID || execution.error || '',
        execution.sizePct || null,
        execution.kellyPct || null,
        execution.direction || null,
        forecastId
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to update forecast execution:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get autopilot execution history from agent_forecasts
 */
export async function getAutopilotExecutions(limit = 20) {
  try {
    const rows = await query(
      `SELECT * FROM agent_forecasts 
       WHERE autopilot_executed = 1
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    );
    return { success: true, executions: rows };
  } catch (error) {
    console.error('Failed to get autopilot executions:', error);
    return { success: false, error: error.message, executions: [] };
  }
}

/**
 * Save agent run metadata
 */
export async function saveAgentRun(runData) {
  try {
    await execute(
      `INSERT INTO agent_runs (
        id, config, markets_scanned, candidates_filtered, forecasts_made, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        runData.id,
        JSON.stringify(runData.config),
        runData.marketsScanned,
        runData.candidatesFiltered,
        runData.forecastsMade,
        runData.timestamp,
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to save agent run:', error);
    return { success: false, error: error.message };
  }
}

// Export db instance and helpers
export { db, execute, query };
