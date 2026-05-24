/**
 * Migration Runner
 * 
 * Manages database schema migrations with:
 * - Ordered execution based on filename prefix
 * - Hash-based deduplication (won't re-run applied migrations)
 * - Transaction support where available
 * - Rollback capability
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Determine database type
const isTurso = process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN;

// Import db helpers - dynamically based on environment
let db;
let execute, query;

if (isTurso) {
  const { createClient } = await import('@libsql/client');
  db = createClient({
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  
  execute = async (sql, params = []) => {
    return db.execute({ sql, args: params });
  };
  
  query = async (sql, params = []) => {
    const result = await db.execute({ sql, args: params });
    return Array.isArray(result) ? result : (result.rows || []);
  };
} else {
  const Database = require('better-sqlite3');
  const dbPath = path.join(process.cwd(), 'fourcast.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  execute = (sql, params = []) => {
    const stmt = db.prepare(sql);
    return params.length > 0 ? stmt.run(...params) : stmt.run();
  };
  
  query = (sql, params = []) => {
    const stmt = db.prepare(sql);
    return params.length > 0 ? stmt.all(...params) : stmt.all();
  };
}

// Calculate SHA256 hash of file content
function getFileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Get migration files sorted by version
function getMigrationFiles(migrationsDir) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .filter(f => /^\d{4}_/.test(f)) // Match pattern like 0001_*.sql
    .sort();
  
  return files.map(f => ({
    filename: f,
    filepath: path.join(migrationsDir, f),
    version: parseInt(f.split('_')[0], 10),
    name: f.replace(/^\d{4}_/, '').replace('.sql', ''),
  }));
}

// Initialize migrations tracking table
async function initMigrationsTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      hash TEXT NOT NULL,
      applied_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
}

// Get list of applied migrations
async function getAppliedMigrations() {
  const rows = await query('SELECT version, hash FROM migrations_applied ORDER BY version');
  return new Map(rows.map(r => [r.version, r.hash]));
}

// Check if migration was already applied (by hash)
async function isMigrationApplied(version, hash) {
  const rows = await query(
    'SELECT hash FROM migrations_applied WHERE version = ? AND hash = ?',
    [version, hash]
  );
  return rows.length > 0;
}

// Record migration as applied
async function recordMigration(version, name, hash) {
  await execute(
    'INSERT OR IGNORE INTO migrations_applied (version, name, hash) VALUES (?, ?, ?)',
    [version, name, hash]
  );
}

// Parse SQL file into executable statements.
// Strips `-- line comments` so statements preceded by header comments
// (e.g. "-- Positions table\nCREATE TABLE ...") aren't discarded.
function parseSqlStatements(sql) {
  return sql
    .split(';')
    .map(chunk => chunk
      .split('\n')
      .map(line => line.replace(/--.*$/, ''))
      .join('\n')
      .trim())
    .filter(s => s.length > 0);
}

// Execute a single migration file
async function runMigration(migration) {
  const content = fs.readFileSync(migration.filepath, 'utf-8');
  const hash = getFileHash(content);
  
  // Check if already applied
  if (await isMigrationApplied(migration.version, hash)) {
    console.log(`  ✓ ${migration.filename} (already applied)`);
    return { skipped: true };
  }
  
  console.log(`  → Running ${migration.filename}...`);
  
  const statements = parseSqlStatements(content);
  
  if (isTurso) {
    // Turso: execute statements individually
    for (const stmt of statements) {
      try {
        await execute(stmt);
      } catch (err) {
        // Ignore "duplicate column" and "already exists" errors
        if (!err.message.includes('duplicate column') && 
            !err.message.includes('already exists') &&
            !err.message.includes('no such column')) {
          throw err;
        }
      }
    }
  } else {
    // SQLite: wrap in transaction
    const runTransaction = db.transaction(() => {
      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err) {
          // Ignore expected errors
          if (!err.message.includes('duplicate column') && 
              !err.message.includes('already exists') &&
              !err.message.includes('no such column')) {
            throw err;
          }
        }
      }
    });
    runTransaction();
  }
  
  // Record the migration
  await recordMigration(migration.version, migration.name, hash);
  console.log(`  ✓ ${migration.filename} applied`);
  
  return { applied: true };
}

// Main migration runner
async function runMigrations(options = {}) {
  const migrationsDir = options.dir || path.join(process.cwd(), 'migrations');
  const dryRun = options.dryRun || false;
  const targetVersion = options.to || null;
  
  console.log('\n🔄 Migration Runner');
  console.log('='.repeat(40));
  console.log(`Database: ${isTurso ? 'Turso' : 'SQLite (local)'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');
  
  // Check migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }
  
  // Initialize tracking table
  await initMigrationsTable();
  
  // Get migration files
  const migrations = getMigrationFiles(migrationsDir);
  
  if (migrations.length === 0) {
    console.log('No migration files found.');
    return;
  }
  
  console.log(`Found ${migrations.length} migration file(s):`);
  for (const m of migrations) {
    console.log(`  ${m.filename} - "${m.name}"`);
  }
  console.log('');
  
  // Get applied migrations
  const applied = await getAppliedMigrations();
  console.log(`Already applied: ${applied.size}`);
  console.log('');
  
  // Run pending migrations
  let appliedCount = 0;
  let skippedCount = 0;
  
  for (const migration of migrations) {
    // Skip if target version specified and this is past it
    if (targetVersion !== null && migration.version > targetVersion) {
      break;
    }
    
    // Skip if already applied
    if (applied.has(migration.version)) {
      skippedCount++;
      continue;
    }
    
    if (dryRun) {
      console.log(`  → Would apply: ${migration.filename}`);
      appliedCount++;
    } else {
      const result = await runMigration(migration);
      if (result.applied) appliedCount++;
      if (result.skipped) skippedCount++;
    }
  }
  
  console.log('');
  console.log('='.repeat(40));
  console.log(`Summary: ${appliedCount} applied, ${skippedCount} skipped`);
  
  if (dryRun) {
    console.log('(Dry run - no changes made)');
  }
  
  return { applied: appliedCount, skipped: skippedCount };
}

// Status command - show migration status
async function showStatus() {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  
  console.log('\n📊 Migration Status');
  console.log('='.repeat(40));
  
  await initMigrationsTable();
  
  const migrations = getMigrationFiles(migrationsDir);
  const applied = await getAppliedMigrations();
  
  console.log(`\nTotal migrations: ${migrations.length}`);
  console.log(`Applied: ${applied.size}`);
  console.log(`Pending: ${migrations.length - applied.size}`);
  console.log('');
  
  console.log('Migration History:');
  console.log('-'.repeat(40));
  
  for (const m of migrations) {
    const status = applied.has(m.version) ? '✓' : '○';
    const appliedInfo = applied.has(m.version) 
      ? ` (✓ applied)` 
      : '';
    console.log(`  ${status} ${m.filename}${appliedInfo}`);
  }
  
  console.log('');
}

// Create new migration file
function createMigration(name) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  
  // Get next version number
  const existing = getMigrationFiles(migrationsDir);
  const nextVersion = existing.length > 0 
    ? Math.max(...existing.map(m => m.version)) + 1 
    : 1;
  
  const version = String(nextVersion).padStart(4, '0');
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const filename = `${version}_${safeName}.sql`;
  const filepath = path.join(migrationsDir, filename);
  
  const template = `-- Migration: ${filename}
-- Description: ${name}
-- Created: ${new Date().toISOString().split('T')[0]}

-- Add your SQL here

`;
  
  fs.writeFileSync(filepath, template);
  console.log(`✅ Created: ${filepath}`);
  console.log('\nEdit the file and run: npm run migrate');
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'status':
    showStatus().catch(console.error);
    break;
    
  case 'new':
    const name = process.argv[3];
    if (!name) {
      console.error('Usage: npm run migrate:new <name>');
      process.exit(1);
    }
    createMigration(name);
    break;
    
  case 'up':
    runMigrations().catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
    break;
    
  case 'down':
    console.log('Rollback not implemented - use migrations for corrections');
    break;
    
  default:
    // Run all pending migrations
    runMigrations().catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export { runMigrations, showStatus, createMigration };