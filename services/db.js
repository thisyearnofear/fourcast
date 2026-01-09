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
    resolved_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_signals_event_id ON signals(event_id);
  CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_signals_author_outcome ON signals(author_address, outcome);
`;

// Initialize tables
if (isTurso) {
  // Split SQL statements for Turso (it doesn't support multiple statements at once)
  const statements = initSql.split(';').filter(s => s.trim());
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
  })();
} else {
  db.exec(initSql);
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
 * Save a prediction to the database
 */
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
        tx_hash, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        signal.timestamp
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

// Export db instance and helpers
export { db, execute, query };
