/**
 * Arena Store — persistence for the Delphi competition agent's public feed.
 *
 * The VPS worker posts one record per cycle (summary, decisions with gates
 * and sources, executions, positions). The /arena page and /api/arena/feed
 * render from it. Backed by Turso (libsql) — already provisioned and used by
 * the rest of the app (services/db.js). (Upstash Redis's stored instance no
 * longer resolves — retired 2026-08-12.)
 *
 * Table: arena_runs(run_id PK, ts, payload JSON, received_at) capped at 300.
 */

import { createClient } from '@libsql/client';

const MAX_RUNS = 300;
let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;
  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  const db = createClient({ url, authToken });
  dbPromise = db
    .execute(`
      CREATE TABLE IF NOT EXISTS arena_runs (
        run_id TEXT PRIMARY KEY,
        ts TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL
      )
    `)
    .then(() => db)
    .catch((err) => {
      dbPromise = null;
      throw err;
    });
  return dbPromise;
}

/**
 * Persist one cycle record (deduped by run_id).
 */
export async function saveArenaRun(run) {
  const db = await getDb();
  if (!db) throw new Error('Turso env not configured (TURSO_CONNECTION_URL/TURSO_AUTH_TOKEN)');

  const safe = {
    ...run,
    decisions: (run.decisions || []).slice(0, 20),
    executions: (run.executions || []).slice(0, 20),
    positions: (run.positions || []).slice(0, 20),
  };

  await db.execute({
    sql: 'INSERT OR REPLACE INTO arena_runs (run_id, ts, payload, received_at) VALUES (?, ?, ?, ?)',
    args: [safe.runId, safe.timestamp, JSON.stringify(safe), safe.receivedAt || new Date().toISOString()],
  });

  // Cap history
  await db.execute({
    sql: `DELETE FROM arena_runs WHERE run_id NOT IN (
            SELECT run_id FROM arena_runs ORDER BY ts DESC LIMIT ?
          )`,
    args: [MAX_RUNS],
  });

  return safe;
}

/**
 * Read the public feed.
 * @returns {Promise<{ latest: object|null, runs: object[] }>}
 */
export async function getArenaFeed({ limit = 40 } = {}) {
  const db = await getDb();
  if (!db) return { latest: null, runs: [] };

  const res = await db.execute({
    sql: 'SELECT payload FROM arena_runs ORDER BY ts DESC LIMIT ?',
    args: [Math.min(limit, MAX_RUNS)],
  });
  const runs = res.rows
    .map((row) => { try { return JSON.parse(row.payload); } catch { return null; } })
    .filter(Boolean);
  return { latest: runs[0] || null, runs };
}
