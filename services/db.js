// Database service for prediction history and analytics
// Uses Turso (LibSQL) for production, SQLite for local development
//
// NOTE: Schema changes MUST go through migrations/ directory.
// See migrations/0001_init.sql, 0002_*.sql, etc.
// DO NOT add inline ALTER TABLE statements here.

import { createClient } from '@libsql/client';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getExecutionStatus } from './autopilotSafety.js';

// Lazy-load better-sqlite3 only for local/dev SQLite. Production uses Turso, so a
// static import would pull the native addon into every Vercel serverless NFT graph.
const require = createRequire(import.meta.url);

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
  const Database = require('better-sqlite3');
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
// Strips `-- line comments` BEFORE splitting on `;` so that a semicolon
// inside a comment (e.g. "-- today agent_forecasts is global; this adds ...")
// does not split the comment into an invalid SQL fragment.
function parseSqlStatements(sql) {
  const stripped = sql
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n');
  return stripped
    .split(';')
    .map(chunk => chunk.trim())
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

const LOG_LOSS_PROB_CLAMP = 1e-6;

function toScorableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Binary log-loss — Brier's stricter sibling: -(o·ln(p) + (1-o)·ln(1-p)).
 *
 * Probability is clamped away from 0/1 because the ledger does contain literal
 * 0 and 1 predictions, and ln(0) is -Infinity, which would poison every average
 * the value appears in.
 *
 * Returns null when either input is absent or off-scale: Number(null) is 0, and
 * an unscored forecast must never be recorded as the worst possible log loss.
 */
export function computeLogLoss(probability, outcome) {
  const p = toScorableNumber(probability);
  const o = toScorableNumber(outcome);
  if (p === null || o === null || p < 0 || p > 1 || o < 0 || o > 1) return null;
  const clamped = Math.min(1 - LOG_LOSS_PROB_CLAMP, Math.max(LOG_LOSS_PROB_CLAMP, p));
  return -(o * Math.log(clamped) + (1 - o) * Math.log(1 - clamped));
}

/**
 * Derive a confidence bucket from a forecast's confidence level.
 *
 * Maps the text confidence values (LOW/MEDIUM/HIGH) used in the UI to the
 * same buckets stored in the database. For raw numeric confidence, applies
 * standard thresholds: <0.50 → LOW, 0.50–0.75 → MEDIUM, ≥0.75 → HIGH.
 */
export function deriveConfidenceBucket(confidence) {
  if (!confidence) return 'LOW';
  const s = String(confidence).toUpperCase().trim();
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM') return 'MEDIUM';
  if (s === 'LOW') return 'LOW';
  // Numeric: treat as a probability or score
  const n = Number(confidence);
  if (!Number.isFinite(n)) return 'LOW';
  if (n >= 0.75) return 'HIGH';
  if (n >= 0.50) return 'MEDIUM';
  return 'LOW';
}

/**
 * Save an agent forecast to the database for track record
 *
 * operatorId is optional. When set, the forecast is scoped to that operator's
 * Track Record URL (migration 0010). When omitted, the forecast belongs to
 * the global/legacy agent (back-compat with existing callers).
 *
 * Also persists confidence_bucket for calibration analysis (migration 0013).
 */
export async function saveForecast(forecast) {
  // A row without a real probability is a guess recorded as evidence —
  // everything downstream (calibration, sizing, memory) reads it as true.
  const p = forecast?.aiProbability;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
    return { success: false, error: 'aiProbability must be a finite number in [0,1]' };
  }
  try {
    const bucket = deriveConfidenceBucket(forecast.confidence);
    await execute(
      `INSERT INTO agent_forecasts (
        id, market_id, market_title, platform, ai_probability, market_odds,
        edge, confidence, reasoning, key_factors, timestamp, operator_id,
        confidence_bucket
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        forecast.operatorId || null,
        bucket,
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to save forecast:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update forecast with actual outcome and score it (Brier point + log-loss)
 */
export async function resolveForecast(marketId, actualOutcome) {
  // A resolution is a fact, not a guess: 1 or 0 only. Anything else — including
  // the 0.5 "neutral" the calibration backfill used to invent — would put an
  // outcome nobody observed into the ledger that calibration, sizing and memory
  // all read as evidence.
  const outcome = Number(actualOutcome);
  if (outcome !== 0 && outcome !== 1) {
    return {
      success: false,
      resolved: 0,
      error: `actual_outcome must be 1 (won) or 0 (lost); got ${JSON.stringify(actualOutcome)}`,
    };
  }
  try {
    const rows = await query(
      `SELECT * FROM agent_forecasts WHERE market_id = ? AND resolved = 0`,
      [marketId]
    );

    for (const forecast of rows) {
      const brierScore = Math.pow(forecast.ai_probability - outcome, 2);
      const logLoss = computeLogLoss(forecast.ai_probability, outcome);
      await execute(
        `UPDATE agent_forecasts 
         SET resolved = 1, actual_outcome = ?, brier_score = ?, log_loss = ?, resolution_time = ?
         WHERE id = ?`,
        [outcome, brierScore, logLoss, Math.floor(Date.now() / 1000), forecast.id]
      );
    }

    return { success: true, resolved: rows.length };
  } catch (error) {
    console.error('Failed to resolve forecast:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List forecasts still waiting on an outcome — the resolver sweep's input.
 */
export async function listUnresolvedForecasts() {
  try {
    const rows = await query(
      `SELECT id, market_id, platform, market_title FROM agent_forecasts WHERE resolved = 0`
    );
    return rows;
  } catch (error) {
    console.error('Failed to list unresolved forecasts:', error);
    return [];
  }
}

/**
 * Derive log_loss for resolved forecasts that pre-date the 0014 migration.
 *
 * Backfill rather than re-scoring: the inputs (ai_probability, actual_outcome)
 * are already in the row, so the derived number is the same one resolveForecast
 * would have written. Nothing is invented.
 */
export async function backfillForecastLogLoss({ dryRun = false } = {}) {
  try {
    await migrationsReady;
    const rows = await query(
      `SELECT id, ai_probability, actual_outcome FROM agent_forecasts
       WHERE resolved = 1 AND log_loss IS NULL
         AND ai_probability IS NOT NULL AND actual_outcome IN (0, 1)`
    );
    const updates = rows
      .map((row) => ({
        id: row.id,
        logLoss: computeLogLoss(row.ai_probability, row.actual_outcome),
      }))
      .filter((update) => update.logLoss != null);

    if (!dryRun) {
      for (const update of updates) {
        await execute(`UPDATE agent_forecasts SET log_loss = ? WHERE id = ?`, [
          update.logLoss,
          update.id,
        ]);
      }
    }

    return {
      success: true,
      scanned: rows.length,
      updated: dryRun ? 0 : updates.length,
      skippedNonBinary: rows.length - updates.length,
      dryRun: !!dryRun,
    };
  } catch (error) {
    console.error('Failed to backfill log-loss:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get calibration analysis — bucketed hit rates, Brier scores, and the
 * data points needed to render a calibration curve.
 *
 * Confirms or refutes: "sized on calibrated confidence, not vibes."
 *
 * Returns an array of bucket objects (LOW, MEDIUM, HIGH), each with:
 *   - bucket: the bucket name
 *   - count: resolved forecasts in this bucket
 *   - hitRate: fraction that won (0–1)
 *   - avgBrier: mean Brier score within bucket
 *   - avgLogLoss: mean binary log-loss within bucket
 *   - avgProbability: mean predicted probability (for curve x-axis)
 *   - midpointConfidence: the bucket's representative confidence value
 *
 * Plus a top-level summary:
 *   - totalResolved, avgBrier, avgLogLoss, minBucket, maxBucket
 *
 * Every metric is emitted in BOTH camelCase (canonical, `schema:
 * 'calibration/v2'`) and the original SQL snake_case. That duplication is
 * deliberate: SQL aliases are snake_case, the UI and worker read camelCase, and
 * the two disagreed silently — CalibrationCurve plotted every bucket at hit
 * rate 0 and the calibration-aware Kelly shrinkage never fired. Aliases stay
 * until every consumer is migrated.
 *
 * operatorId is optional for per-operator calibration.
 */
export const CALIBRATION_SCHEMA = 'calibration/v2';

const BUCKET_MIDPOINTS = { HIGH: 0.875, MEDIUM: 0.625, LOW: 0.25 };

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getCalibrationAnalysis(operatorId = null) {
  try {
    await migrationsReady;
    // Every aggregation below already opens with `WHERE resolved = 1 AND ...`,
    // so the operator scope has to be an AND. As written with a second WHERE it
    // was a syntax error, which `catch` turned into `{success: false}` — so
    // per-operator calibration (the track-record page, and any memory built for
    // one operator) silently reported "no calibration" rather than failing loud.
    const whereClause = operatorId ? 'AND operator_id = ?' : '';
    const params = operatorId ? [operatorId] : [];

    // Bucketed aggregation
    const buckets = await query(
      `SELECT
        confidence_bucket as bucket,
        COUNT(*) as count,
        SUM(CASE WHEN actual_outcome = 1 THEN 1 ELSE 0 END) / CAST(COUNT(*) AS REAL) as hit_rate,
        AVG(brier_score) as avg_brier,
        AVG(log_loss) as avg_log_loss,
        AVG(ai_probability) as avg_probability
       FROM agent_forecasts
       WHERE resolved = 1 AND confidence_bucket IS NOT NULL
       ${whereClause}
       GROUP BY confidence_bucket
       ORDER BY CASE confidence_bucket WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 END`,
      params
    );

    // Overall summary
    const summary = await query(
      `SELECT
        COUNT(*) as total_resolved,
        AVG(brier_score) as avg_brier,
        AVG(log_loss) as avg_log_loss,
        MIN(confidence_bucket) as min_bucket,
        MAX(confidence_bucket) as max_bucket
       FROM agent_forecasts
       WHERE resolved = 1 AND confidence_bucket IS NOT NULL
       ${whereClause}`,
      params
    );

    // Temporal trend — Brier score per month (last 12 months)
    const trend = await query(
      `SELECT
        strftime('%Y-%m', datetime(resolution_time, 'unixepoch')) as month,
        COUNT(*) as count,
        AVG(brier_score) as avg_brier,
        AVG(log_loss) as avg_log_loss,
        MAX(resolution_time) as last_resolved
       FROM agent_forecasts
       WHERE resolved = 1 AND resolution_time IS NOT NULL
       ${whereClause}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      params
    );

    // Source-level calibration (if platform/source is tracked)
    const sourceCal = await query(
      `SELECT
        platform as source,
        COUNT(*) as count,
        AVG(brier_score) as avg_brier,
        AVG(log_loss) as avg_log_loss,
        SUM(CASE WHEN actual_outcome = 1 THEN 1 ELSE 0 END) / CAST(COUNT(*) AS REAL) as hit_rate,
        MAX(resolution_time) as last_resolved
       FROM agent_forecasts
       WHERE resolved = 1 AND platform IS NOT NULL
       ${whereClause}
       GROUP BY platform
       ORDER BY avg_brier ASC`,
      params
    );

    // Per-month bucket hit rates. The `window` memory carries these so a stored
    // memory can do what the local curve does in a deployment whose DB is cold —
    // and it carries the sample sizes beside them, because a hit rate with no
    // `n` next to it is precisely the claim WP1 refused to let sizing consume.
    const monthBuckets = await query(
      `SELECT
        strftime('%Y-%m', datetime(resolution_time, 'unixepoch')) as month,
        confidence_bucket as bucket,
        COUNT(*) as count,
        SUM(CASE WHEN actual_outcome = 1 THEN 1 ELSE 0 END) / CAST(COUNT(*) AS REAL) as hit_rate
       FROM agent_forecasts
       WHERE resolved = 1 AND resolution_time IS NOT NULL AND confidence_bucket IS NOT NULL
       ${whereClause}
       GROUP BY month, confidence_bucket
       ORDER BY month, CASE confidence_bucket WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 END`,
      params
    );
    const bucketsByMonth = new Map();
    for (const row of monthBuckets) {
      const hitRate = toNumber(row.hit_rate);
      const list = bucketsByMonth.get(row.month) || [];
      list.push({ bucket: row.bucket, count: toNumber(row.count), hitRate, hit_rate: hitRate });
      bucketsByMonth.set(row.month, list);
    }

    const summaryRow = summary[0] || null;
    const summaryOut = summaryRow
      ? {
          totalResolved: toNumber(summaryRow.total_resolved),
          avgBrier: toNumber(summaryRow.avg_brier),
          avgLogLoss: toNumber(summaryRow.avg_log_loss),
          minBucket: summaryRow.min_bucket ?? null,
          maxBucket: summaryRow.max_bucket ?? null,
          total_resolved: toNumber(summaryRow.total_resolved),
          avg_brier: toNumber(summaryRow.avg_brier),
          avg_log_loss: toNumber(summaryRow.avg_log_loss),
          min_bucket: summaryRow.min_bucket ?? null,
          max_bucket: summaryRow.max_bucket ?? null,
        }
      : null;

    return {
      success: true,
      schema: CALIBRATION_SCHEMA,
      summary: summaryOut,
      buckets: buckets.map((b) => {
        const hitRate = toNumber(b.hit_rate);
        const avgBrier = toNumber(b.avg_brier);
        const avgLogLoss = toNumber(b.avg_log_loss);
        const avgProbability = toNumber(b.avg_probability);
        return {
          bucket: b.bucket,
          count: toNumber(b.count),
          hitRate,
          avgBrier,
          avgLogLoss,
          avgProbability,
          midpointConfidence: BUCKET_MIDPOINTS[b.bucket] ?? null,
          hit_rate: hitRate,
          avg_brier: avgBrier,
          avg_log_loss: avgLogLoss,
          avg_probability: avgProbability,
        };
      }),
      trend: trend.map((t) => ({
        ...t,
        count: toNumber(t.count),
        avgBrier: toNumber(t.avg_brier),
        avg_brier: toNumber(t.avg_brier),
        avgLogLoss: toNumber(t.avg_log_loss),
        avg_log_loss: toNumber(t.avg_log_loss),
        lastResolved: toNumber(t.last_resolved),
        last_resolved: toNumber(t.last_resolved),
        buckets: bucketsByMonth.get(t.month) || [],
      })),
      sourceCal: sourceCal.map((s) => {
        const hitRate = toNumber(s.hit_rate);
        const avgBrier = toNumber(s.avg_brier);
        const avgLogLoss = toNumber(s.avg_log_loss);
        const lastResolved = toNumber(s.last_resolved);
        return {
          source: s.source,
          count: toNumber(s.count),
          avgBrier,
          avgLogLoss,
          hitRate,
          lastResolved,
          avg_brier: avgBrier,
          avg_log_loss: avgLogLoss,
          hit_rate: hitRate,
          last_resolved: lastResolved,
        };
      }),
      operatorId: operatorId || null,
    };
  } catch (error) {
    console.error('Failed to get calibration analysis:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Per-analyst credibility — "which voices were right", from verdicts only.
 *
 * Reads `signals` rows whose outcome is an explicit WIN/LOSS verdict. Rows
 * resolved by reputationService.determineSignalOutcome store the *market*
 * result ('YES'/'NO'), which is not a verdict about the author's pick — those
 * are counted in `unmappedOutcomes` and excluded, never silently scored as a
 * miss. `agent_forecasts` is keyed by an operator UUID, so Brier/log-loss only
 * appear when a forecast row carries this same id; an empty forecast block is
 * reported as such rather than filled in.
 *
 * Returns ok:false with reason 'insufficient_sample' below `minSamples` — a
 * credibility figure we cannot support is not surfaced (and never written to
 * memory).
 */
export async function getAnalystCalibration(address, { minSamples = 3 } = {}) {
  try {
    await migrationsReady;
    const normalized = String(address || '').trim().toLowerCase();
    if (!normalized) return { success: false, reason: 'missing_address', ok: false };

    const verdicts = await query(
      // `id ASC` is not decoration: the memory writer cites the newest
      // verdict's snapshot hash, and a memory's content hash includes it. With
      // ties left unordered, two reads of an unchanged ledger could disagree
      // and mint a phantom ladder version.
      `SELECT outcome, confidence, market_snapshot_hash, tx_hash, resolved_at, venue
       FROM signals
       WHERE author_address = ? AND outcome IN ('WIN','LOSS')
       ORDER BY resolved_at DESC, id ASC`,
      [normalized]
    );

    const unmapped = await query(
      `SELECT outcome, COUNT(*) as count
       FROM signals
       WHERE author_address = ? AND outcome IS NOT NULL AND outcome != 'PENDING'
         AND outcome NOT IN ('WIN','LOSS')
       GROUP BY outcome`,
      [normalized]
    );

    const forecastRow = await query(
      `SELECT COUNT(*) as count, AVG(brier_score) as avg_brier, AVG(log_loss) as avg_log_loss
       FROM agent_forecasts
       WHERE resolved = 1 AND operator_id = ?`,
      [normalized]
    );

    const n = verdicts.length;
    const wins = verdicts.filter((s) => s.outcome === 'WIN').length;
    const hitRate = n > 0 ? wins / n : null;

    const bucketRows = {};
    for (const signal of verdicts) {
      const bucket = deriveConfidenceBucket(signal.confidence);
      bucketRows[bucket] = bucketRows[bucket] || { count: 0, wins: 0 };
      bucketRows[bucket].count += 1;
      if (signal.outcome === 'WIN') bucketRows[bucket].wins += 1;
    }
    const buckets = Object.fromEntries(
      Object.entries(bucketRows).map(([bucket, stats]) => [
        bucket,
        { count: stats.count, hitRate: stats.count ? stats.wins / stats.count : null },
      ])
    );

    const byVenue = {};
    for (const signal of verdicts) {
      const venue = signal.venue || 'unknown';
      byVenue[venue] = byVenue[venue] || { count: 0, wins: 0 };
      byVenue[venue].count += 1;
      if (signal.outcome === 'WIN') byVenue[venue].wins += 1;
    }
    const venueBreakdown = Object.entries(byVenue).map(([venue, stats]) => ({
      venue,
      count: stats.count,
      hitRate: stats.count ? stats.wins / stats.count : null,
    }));

    const latest = verdicts[0] || null;
    const forecastStats = forecastRow[0] || null;
    const sufficient = n >= minSamples;

    return {
      success: true,
      ok: sufficient,
      reason: sufficient ? null : 'insufficient_sample',
      address: normalized,
      n,
      wins,
      losses: n - wins,
      hitRate,
      buckets,
      venueBreakdown,
      forecastEvidence: forecastStats
        ? {
            count: toNumber(forecastStats.count) || 0,
            avgBrier: toNumber(forecastStats.avg_brier),
            avgLogLoss: toNumber(forecastStats.avg_log_loss),
          }
        : { count: 0, avgBrier: null, avgLogLoss: null },
      unmappedOutcomes: unmapped.map((u) => ({ outcome: u.outcome, count: toNumber(u.count) })),
      latestTrace: latest
        ? {
            receipt: latest.market_snapshot_hash || null,
            txHash: latest.tx_hash || null,
            resolvedAt: latest.resolved_at || null,
          }
        : null,
      source: 'db:signals+agent_forecasts',
    };
  } catch (error) {
    console.error('Failed to get analyst calibration:', error);
    return { success: false, ok: false, reason: 'error', error: error.message };
  }
}

/**
 * Every address that has at least `minVerdicts` WIN/LOSS verdicts on record.
 * The roster the memory writer walks to build `analyst:*` memories — grouped
 * case-insensitively, because the same wallet has shown up in mixed casing and
 * two spellings of one address would write two conflicting credibility records.
 */
export async function listAnalystAddresses({ minVerdicts = 1, limit = 100 } = {}) {
  try {
    await migrationsReady;
    const rows = await query(
      `SELECT MIN(author_address) as address,
              COUNT(*) as verdicts,
              SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins
       FROM signals
       WHERE outcome IN ('WIN','LOSS')
         AND author_address IS NOT NULL AND author_address != ''
       GROUP BY LOWER(author_address)
       HAVING COUNT(*) >= ?
       ORDER BY verdicts DESC
       LIMIT ?`,
      [Math.max(1, Number(minVerdicts) || 1), Math.max(1, Number(limit) || 100)]
    );
    return {
      success: true,
      addresses: rows.map((r) => ({
        address: String(r.address || '').toLowerCase(),
        verdicts: toNumber(r.verdicts) || 0,
        wins: toNumber(r.wins) || 0,
      })),
    };
  } catch (error) {
    console.error('Failed to list analyst addresses:', error);
    return { success: false, error: error.message, addresses: [] };
  }
}

/**
 * Resolved forecasts backed by a real recorded outcome (0 or 1 only). Rows
 * resolved before the outcome guard existed, or carrying any other value, are
 * excluded: a memory must cite an observation, not a placeholder.
 */
export async function listResolvedForecasts({ limit = 200, operatorId = null, marketId = null } = {}) {
  try {
    await migrationsReady;
    const filters = ['resolved = 1 AND actual_outcome IN (0, 1)'];
    const params = [];
    if (marketId) {
      filters.push('market_id = ?');
      params.push(marketId);
    }
    if (operatorId) {
      filters.push('operator_id = ?');
      params.push(operatorId);
    }
    params.push(Math.max(1, Number(limit) || 200));
    const where = filters.join(' AND ');
    const rows = await query(
      // `id ASC` makes the `LIMIT` window stable, so two runs of the batch
      // writer cannot disagree about which forecasts were memory-worthy.
      `SELECT * FROM agent_forecasts WHERE ${where}
       ORDER BY resolution_time DESC, timestamp DESC, id ASC
       LIMIT ?`,
      params
    );
    return { success: true, forecasts: rows };
  } catch (error) {
    console.error('Failed to list resolved forecasts:', error);
    return { success: false, error: error.message, forecasts: [] };
  }
}

/**
 * Get agent track record statistics
 *
 * operatorId is optional. When set, stats and forecasts are scoped to that
 * operator's Track Record URL (migration 0010). When omitted, returns the
 * global/legacy aggregate (back-compat with /api/agent/track-record).
 */
export async function getAgentTrackRecord(operatorId = null) {
  try {
    await migrationsReady;
    const whereClause = operatorId ? 'WHERE operator_id = ?' : '';
    const params = operatorId ? [operatorId] : [];

    const stats = await query(
      `SELECT
        COUNT(*) as total_forecasts,
        COUNT(CASE WHEN resolved = 1 THEN 1 END) as resolved_forecasts,
        AVG(CASE WHEN resolved = 1 THEN brier_score END) as avg_brier_score,
        AVG(CASE WHEN resolved = 1 AND confidence = 'HIGH' THEN brier_score END) as high_conf_brier,
        COUNT(CASE WHEN resolved = 1 AND confidence = 'HIGH' THEN 1 END) as high_conf_count
       FROM agent_forecasts
       ${whereClause}`,
      params
    );

    const recentForecasts = await query(
      `SELECT * FROM agent_forecasts
       ${whereClause}
       ${operatorId ? 'AND' : 'WHERE'} resolved = 1
       ORDER BY resolution_time DESC
       LIMIT 50`,
      params
    );

    return {
      success: true,
      stats: stats[0],
      recentForecasts,
      operatorId: operatorId || null,
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
    await migrationsReady;
    await execute(
      `INSERT INTO agent_runs (
        id, config, markets_scanned, candidates_filtered, forecasts_made, timestamp, run_mode, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runData.id,
        JSON.stringify(runData.config),
        runData.marketsScanned,
        runData.candidatesFiltered,
        runData.forecastsMade,
        runData.timestamp,
        runData.runMode || 'advisory',
        JSON.stringify(runData.summary || {}),
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to save agent run:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recent autonomous decision receipts. Summaries are parsed here so API and UI
 * consumers cannot accidentally expose a database-encoded JSON string.
 */
export async function getAgentRunLedger(limit = 12) {
  try {
    await migrationsReady;
    const rows = await query(
      `SELECT id, config, markets_scanned, candidates_filtered, forecasts_made,
              timestamp, created_at, run_mode, summary
       FROM agent_runs
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    );

    return {
      success: true,
      runs: rows.map((row) => ({
        ...row,
        config: safeJsonParse(row.config, {}),
        summary: safeJsonParse(row.summary, {}),
      })),
    };
  } catch (error) {
    console.error('Failed to get agent run ledger:', error);
    return { success: false, error: error.message, runs: [] };
  }
}

/**
 * All stored run summaries, parsed, for aggregate receipt statistics.
 * Summaries are small JSON documents; a full scan is fine at current volume
 * and avoids json_extract (unavailable in some deployed SQLite builds).
 */
export async function getReceiptStatsRows() {
  try {
    await migrationsReady;
    const rows = await query(`SELECT summary FROM agent_runs`);
    return {
      success: true,
      summaries: rows
        .map((row) => safeJsonParse(row.summary, null))
        .filter(Boolean),
    };
  } catch (error) {
    console.error('Failed to get receipt stats rows:', error);
    return { success: false, error: error.message, summaries: [] };
  }
}

/**
 * The worker reports one compact, signed status document. Keeping only its
 * latest state is intentional: receipts remain the immutable audit trail,
 * while this table answers the operational question, "what is it doing now?"
 */
export async function saveHistoricalLabStatus(payload) {
  await migrationsReady;
  const updatedAt = Math.floor(Date.now() / 1000);
  await execute(
    `INSERT INTO historical_lab_status (id, payload, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    [JSON.stringify(payload), updatedAt],
  );
  return { success: true, updatedAt };
}

export async function getHistoricalLabStatus() {
  await migrationsReady;
  const rows = await query('SELECT payload, updated_at FROM historical_lab_status WHERE id = 1');
  if (!rows[0]) return { success: true, status: null };
  return { success: true, status: safeJsonParse(rows[0].payload, null), updatedAt: rows[0].updated_at };
}

/**
 * Persist a mandate draft (Slice 4 of the self-serve concierge path). The
 * operator_id is the primary key — re-saving overwrites the previous draft,
 * keeping the "one mandate per operator" invariant. The four policy knobs
 * match createDecisionPolicy() exactly.
 *
 * No auth in this slice — operator_id is an unauthenticated UUID generated
 * client-side and stored in localStorage. Auth + private mandates are a
 * Premium-tier feature, post-concierge-test.
 */
export async function saveMandate({
  operatorId,
  minAbsoluteEdge,
  maxAllocationPct,
  maxLossProbability,
  simulationRuns,
  policyVersion,
  displayName = null,
}) {
  await migrationsReady;
  const updatedAt = Math.floor(Date.now() / 1000);
  await execute(
    `INSERT INTO mandates (
      operator_id, min_absolute_edge, max_allocation_pct, max_loss_probability,
      simulation_runs, policy_version, display_name, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(operator_id) DO UPDATE SET
      min_absolute_edge = excluded.min_absolute_edge,
      max_allocation_pct = excluded.max_allocation_pct,
      max_loss_probability = excluded.max_loss_probability,
      simulation_runs = excluded.simulation_runs,
      policy_version = excluded.policy_version,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at`,
    [
      operatorId,
      minAbsoluteEdge,
      maxAllocationPct,
      maxLossProbability,
      simulationRuns,
      policyVersion,
      displayName,
      updatedAt,
    ],
  );
  return { success: true, operatorId, updatedAt };
}

/**
 * Read a persisted mandate draft by operator_id. Returns { success: true,
 * mandate: null } when the operator has no saved mandate — the caller (the
 * /agent/[operatorId] page) treats this as "no mandate yet, show the builder".
 */
export async function getMandate(operatorId) {
  await migrationsReady;
  const rows = await query(
    `SELECT operator_id, min_absolute_edge, max_allocation_pct, max_loss_probability,
            simulation_runs, policy_version, display_name, created_at, updated_at
     FROM mandates
     WHERE operator_id = ?`,
    [operatorId],
  );
  if (!rows[0]) return { success: true, mandate: null };
  const m = rows[0];
  return {
    success: true,
    mandate: {
      operatorId: m.operator_id,
      minAbsoluteEdge: m.min_absolute_edge,
      maxAllocationPct: m.max_allocation_pct,
      maxLossProbability: m.max_loss_probability,
      simulationRuns: m.simulation_runs,
      policyVersion: m.policy_version,
      displayName: m.display_name,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    },
  };
}

function safeJsonParse(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Operator lead capture — Talk to us (privacy wedge interview pipeline).
 */
export async function saveOperatorLead({ email, sizes = false, note = null, source = 'privacy' }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, error: 'Valid email required' };
  }
  const cleanNote = note ? String(note).trim().slice(0, 500) : null;
  const cleanSource = source ? String(source).trim().slice(0, 64) : 'privacy';
  try {
    await migrationsReady;
    await execute(
      `INSERT INTO operator_leads (email, sizes, note, source, created_at)
       VALUES (?, ?, ?, ?, strftime('%s', 'now'))`,
      [normalized, sizes ? 1 : 0, cleanNote, cleanSource]
    );
    return { success: true, email: normalized };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Export db instance, helpers, and migrations readiness
export { db, execute, query, migrationsReady };
