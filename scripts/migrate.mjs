#!/usr/bin/env node
/**
 * Run database migrations before the build.
 *
 * Reads TURSO_CONNECTION_URL + TURSO_AUTH_TOKEN from env (Vercel or local).
 * Uses migrations/ directory. Idempotent — checks applied table.
 *
 * Exit 0 on success or skip, 1 on failure.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ── Check TURSO env vars BEFORE importing migrations/ ──

const hasTurso = Boolean(
  process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN
);

if (!hasTurso) {
  console.log('⚠️  TURSO env vars not set — skipping migrations');
  process.exit(0);
}

process.chdir(root);

// ── Dynamically import and run (avoids ESM hoisting) ────────────

console.log('⏩ Running database migrations…');

try {
  // Dynamic import so ESM doesn't hoist — migrations/run.js has a top-level
  // Turso/SQLite check that would otherwise run before we reach this point.
  const { runMigrations } = await import('../migrations/run.js');
  await runMigrations();
  console.log('✅ Migrations up to date.');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
}
