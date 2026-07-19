// Database service for prediction history and analytics
// Uses Turso (LibSQL) for production, SQLite for local development
//
// NOTE: Schema changes MUST go through migrations/ directory.
// See migrations/0001_init.sql, 0002_*.sql, etc.
// DO NOT add inline ALTER TABLE statements here.

import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getExecutionStatus } from './autopilotSafety.js';

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
  // Development: Use local SQLite (DATABASE_PATH lets tests point at a temp file)
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'fourcast.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  try {
    db.pragma('journal_mode = WAL');
  } catch (err) {
    console.warn('Failed to set WAL mode:', err.message);
  }
  console.log('Using local SQLite database');
}

// ─────────────────────────────────────────────────────────────
// Migration System
// ─────────────────────────────────────────────────────────────

// Calculate SHA256 hash of file content
function getFileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Get migration files sorted by version
function getMigrationFiles(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return [];
  
  return fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .filter(f => /^\d{4}_/.test(f))
    .sort()
    .map(f => ({
      filename: f,
      filepath: path.join(migrationsDir, f),
      version: parseInt(f.split('_')[0], 10),
      name: f.replace(/^\d{4}_/, '').replace('.sql', ''),
    }));
}

// Initialize migrations tracking table
async function initMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS migrations_applied (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      hash TEXT NOT NULL,
      applied_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `;
  
  if (isTurso) {
    await db.execute(sql);
  } else {
    db.exec(sql);
  }
}

// Get list of applied migrations
async function getAppliedMigrations() {
  const sql = 'SELECT version, hash FROM migrations_applied ORDER BY version';
  
  let rows;
  if (isTurso) {
    const result = await db.execute(sql);
    rows = Array.isArray(result) ? result : (result.rows || []);
  } else {
    rows = db.prepare(sql).all();
  }
  
  return new Map(rows.map(r => [r.version, r.hash]));
}

// Check if migration was already applied (by hash)
async function isMigrationApplied(version, hash) {
  const sql = 'SELECT hash FROM migrations_applied WHERE version = ? AND hash = ?';
  
  let rows;
  if (isTurso) {
    const result = await db.execute({ sql, args: [version, hash] });
    rows = Array.isArray(result) ? result : (result.rows || []);
  } else {
    rows = db.prepare(sql).all(version, hash);
  }
  
  return rows.length > 0;
}

// Record migration as applied
async function recordMigration(version, name, hash) {
  const sql = 'INSERT OR IGNORE INTO migrations_applied (version, name, hash) VALUES (?, ?, ?)';
  
  if (isTurso) {
    await db.execute({ sql, args: [version, name, hash] });
  } else {
    db.prepare(sql).run(version, name, hash);
  }
}

// Parse SQL file into executable statements.
// Strips `-- line comments` so statements with leading header comments
// (e.g. "-- Positions table\nCREATE TABLE ...") are not discarded.
function parseSqlStatements(sql) {
  return sql
    .split(';')
    .map(chunk => chunk
      .split('\n')
      .map(line => line.replace(/--.*$/, '')) // strip line comments
      .join('\n')
      .trim())
    .filter(s => s.length > 0);
}

// Run all pending migrations
async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const migrations = getMigrationFiles(migrationsDir);
  
  if (migrations.length === 0) {
    console.log('No migration files found');
    return;
  }
  
  await initMigrationsTable();
  const applied = await getAppliedMigrations();
  
  console.log(`\n🔄 Running ${migrations.length - applied.size} pending migration(s)...`);
  
  for (const migration of migrations) {
    // Skip if already applied
    if (applied.has(migration.version)) {
      continue;
    }
    
    const content = fs.readFileSync(migration.filepath, 'utf-8');
    const hash = getFileHash(content);
    
    // Double-check (race condition protection)
    if (await isMigrationApplied(migration.version, hash)) {
      continue;
    }
    
    console.log(`  → ${migration.filename}`);
    
    const statements = parseSqlStatements(content);
    
    for (const stmt of statements) {
      try {
        if (isTurso) {
          await db.execute(stmt);
        } else {
          db.exec(stmt);
        }
      } catch (err) {
        // Ignore expected errors for idempotent migrations
        if (!err.message.includes('duplicate column') && 
            !err.message.includes('already exists') &&
            !err.message.includes('no such column')) {
          console.warn(`    ⚠ ${err.message}`);
        }
      }
    }
    
    await recordMigration(migration.version, migration.name, hash);
    console.log(`  ✓ Applied`);
  }
}

// Run migrations on module load and expose readiness promise.
// Tests (and any consumer that needs guaranteed-ready tables) should
// `await migrationsReady` before performing queries.
const migrationsReady = runMigrations().catch(err => {
  console.error('Migration error:', err.message);
});

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
    // LEFT-correlated subquery surfaces the most-recent on-chain signal receipt
    // for each position so the /positions UI can render an "Arc receipt" link
    // without forcing a schema migration. We concatenate tx_hash + chain_origin
    // into a single 'tx|origin' value and split client-side below — one subquery
    // per row, not two. LIMIT 1 guards against cartesian explosion if a user
    // published multiple signals for the same market_id. TODO(v2): consider a
    // migration to add tx_hash directly to the positions table.
    const rows = await query(
      `SELECT p.*,
         (SELECT s.tx_hash || '|' || s.chain_origin FROM signals s
          WHERE s.event_id = p.market_id
            AND LOWER(s.author_address) = LOWER(p.user_address)
            AND s.tx_hash IS NOT NULL
          ORDER BY s.timestamp DESC LIMIT 1) AS receipt
       FROM positions p
       WHERE p.user_address = ? ${statusFilter}
       ORDER BY p.created_at DESC`,
      params
    );
    const positions = rows.map((p) => {
      if (!p.receipt) return p;
      const [txHash, chainOrigin] = String(p.receipt).split('|');
      return {
        ...p,
        receipt_tx_hash: txHash || null,
        receipt_chain_origin: chainOrigin || null,
      };
    });
    return { success: true, positions };
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
        signal.chain_origin || 'ARC'
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
 * Count signals published by an author (case-insensitive address match)
 */
export async function getSignalCountByAuthor(authorAddress) {
  const addr = authorAddress?.toLowerCase();
  if (!addr) return { success: true, count: 0 };
  try {
    const rows = await query(
      `SELECT COUNT(*) as count FROM signals WHERE LOWER(author_address) = ?`,
      [addr]
    );
    return { success: true, count: rows[0]?.count || 0 };
  } catch (error) {
    return { success: false, error: error.message, count: 0 };
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
 * Get a signal by its ID
 */
export async function getSignalById(id) {
  try {
    const rows = await query(
      `SELECT * FROM signals WHERE id = ? LIMIT 1`,
      [id]
    );
    return { success: true, signal: rows[0] || null };
  } catch (error) {
    console.error('Failed to get signal by ID:', error);
    return { success: false, error: error.message, signal: null };
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
        getExecutionStatus(execution),
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
 * Get persisted autopilot schedule (enabled flag + interval + safety columns)
 */
export async function getAutopilotSchedule() {
  try {
    const rows = await query(
      `SELECT enabled, interval_minutes, updated_at, dry_run, last_run_at, daily_cap_pct
       FROM autopilot_schedule WHERE id = 1 LIMIT 1`
    );

    const row = rows[0] || {
      enabled: 0,
      interval_minutes: 60,
      updated_at: 0,
      dry_run: 1,
      last_run_at: null,
      daily_cap_pct: 0.5,
    };

    return {
      success: true,
      schedule: {
        enabled: row.enabled === 1 || row.enabled === true,
        intervalMinutes: row.interval_minutes,
        updatedAt: row.updated_at,
        dryRun: row.dry_run === 1 || row.dry_run === true,
        lastRunAt: row.last_run_at,
        dailyCapPct: row.daily_cap_pct,
      },
    };
  } catch (error) {
    console.error('Failed to get autopilot schedule:', error);
    return { success: false, error: error.message, schedule: null };
  }
}

/**
 * Persist autopilot schedule (enabled flag + interval + safety columns)
 *
 * Backward-compatible: old 2-arg callers (enabled, intervalMinutes) still work.
 */
export async function setAutopilotSchedule(enabled, intervalMinutes, dryRun, dailyCapPct) {
  try {
    const updatedAt = Math.floor(Date.now() / 1000);

    // Resolve defaults for backward compatibility
    const dryRunValue = dryRun === undefined ? true : !!dryRun;
    const dailyCapPctValue = dailyCapPct === undefined ? 0.5 : Math.max(0, Math.min(1, Number(dailyCapPct)));

    await execute(
      `INSERT INTO autopilot_schedule (id, enabled, interval_minutes, updated_at, dry_run, daily_cap_pct)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         enabled = excluded.enabled,
         interval_minutes = excluded.interval_minutes,
         updated_at = excluded.updated_at,
         dry_run = excluded.dry_run,
         daily_cap_pct = excluded.daily_cap_pct`,
      [
        enabled ? 1 : 0,
        intervalMinutes,
        updatedAt,
        dryRunValue ? 1 : 0,
        dailyCapPctValue,
      ]
    );

    return {
      success: true,
      schedule: {
        enabled: enabled === true,
        intervalMinutes,
        updatedAt,
        dryRun: dryRunValue,
        dailyCapPct: dailyCapPctValue,
      },
    };
  } catch (error) {
    console.error('Failed to set autopilot schedule:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Record the most recent autopilot run timestamp.
 */
export async function recordAutopilotRun(timestamp) {
  try {
    await execute(
      `UPDATE autopilot_schedule SET last_run_at = ? WHERE id = 1`,
      [timestamp]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to record autopilot run:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get autopilot executions since a given unix timestamp.
 */
export async function getAutopilotExecutionsSince(unixSeconds, limit = 200) {
  try {
    const rows = await query(
      `SELECT * FROM agent_forecasts
       WHERE autopilot_executed = 1
         AND timestamp >= ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [unixSeconds, limit]
    );
    return { success: true, executions: rows };
  } catch (error) {
    console.error('Failed to get autopilot executions since:', error);
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

// Export db instance, helpers, and migrations readiness
export { db, execute, query, migrationsReady };
