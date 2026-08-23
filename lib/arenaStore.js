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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_RUNS = 300;
let dbPromise = null;

// ── Last-good snapshot ─────────────────────────────────────────────────────
// The landing's whole "living product" promise depends on this feed. When
// Turso is unreachable the feed must not go dark: every successful read
// persists a snapshot (cache/ is gitignored), and a failed read falls back
// to it flagged `stale: true` so the UI can show an honest amber state
// instead of either nothing or a fake LIVE lamp.
const SNAPSHOT_PATH = path.join(process.cwd(), 'cache', 'arena-feed-snapshot.json');
const SNAPSHOT_RUNS = 40;

async function writeSnapshot(feed) {
  try {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(
      SNAPSHOT_PATH,
      JSON.stringify({ savedAt: new Date().toISOString(), latest: feed.latest, runs: feed.runs.slice(0, SNAPSHOT_RUNS) }),
    );
  } catch {
    // Best-effort: a snapshot failure must never break the live read.
  }
}

async function readSnapshot() {
  try {
    const raw = await readFile(SNAPSHOT_PATH, 'utf8');
    const snap = JSON.parse(raw);
    if (!snap || !Array.isArray(snap.runs)) return null;
    return { latest: snap.latest || snap.runs[0] || null, runs: snap.runs, stale: true };
  } catch {
    return null;
  }
}

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
 *
 * Fresh reads persist a snapshot; failures (or a missing Turso config)
 * fall back to the last-good snapshot flagged `stale: true`.
 *
 * @returns {Promise<{ latest: object|null, runs: object[], stale?: boolean }>}
 */
export async function getArenaFeed({ limit = 40 } = {}) {
  const capped = Math.min(limit, MAX_RUNS);
  try {
    const db = await getDb();
    if (!db) return (await readSnapshot()) || { latest: null, runs: [] };

    const res = await db.execute({
      sql: 'SELECT payload FROM arena_runs ORDER BY ts DESC LIMIT ?',
      args: [capped],
    });
    const runs = res.rows
      .map((row) => { try { return JSON.parse(row.payload); } catch { return null; } })
      .filter(Boolean);
    const feed = { latest: runs[0] || null, runs };
    if (runs.length > 0) await writeSnapshot(feed);
    return feed;
  } catch {
    return (await readSnapshot()) || { latest: null, runs: [] };
  }
}
