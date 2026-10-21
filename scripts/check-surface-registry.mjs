#!/usr/bin/env node
/**
 * Surface registry check — keeps `docs/SURFACES.md` and the app in step.
 *
 * Two failure modes this catches:
 *   1. a route exists with no registry row  → the surface ships below the bar
 *      without anyone noticing, because nobody was asked.
 *   2. a registry row points at a route that does not exist → the registry
 *      is lying about the app.
 *
 * It also reports rows whose audit is stale (no date), because a registry
 * that is never updated is a registry nobody reads.
 *
 * Usage: node scripts/check-surface-registry.mjs
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'SURFACES.md');
const APP_DIR = path.join(ROOT, 'app');
const STALE_DAYS = 21;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'api' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/^page\.jsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** `app/agent/[operatorId]/page.js` → `/agent/[operatorId]`; `app/page.js` → `/`. */
function routeOf(file) {
  const rel = path.relative(APP_DIR, file).replace(/\\/g, '/');
  const withoutPage = rel.replace(/page\.jsx?$/, '').replace(/\/$/, '');
  return withoutPage ? `/${withoutPage}` : '/';
}

function findRoutes() {
  return walk(APP_DIR).map(routeOf).sort();
}

/** Rows look like: | `/arena` | yes | A spine | … */
function findRegistryRows(markdown) {
  const rows = new Map();
  for (const line of markdown.split('\n')) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|(.*)$/);
    if (!match) continue;
    const route = match[1];
    const cells = match[2].split('|').map((cell) => cell.trim());
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    rows.set(route, { renders: cells[0] || '', lastAudit: cells[cells.length - 1] || '' });
  }
  return rows;
}

if (!fs.existsSync(REGISTRY_PATH)) {
  console.error('❌ docs/SURFACES.md is missing — the surface registry is the quality ledger.');
  process.exit(1);
}

const routes = findRoutes();
const rows = findRegistryRows(fs.readFileSync(REGISTRY_PATH, 'utf8'));

const missing = routes.filter((route) => !rows.has(route));
const extra = [...rows.keys()].filter((route) => !routes.includes(route));
const stale = [...rows.entries()].filter(([, row]) => {
  const audited = row.lastAudit;
  // "—" means explicitly not audited yet; that is a work item, not a stale row.
  if (!audited || audited === '—' || audited === '-') return false;
  const match = audited.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return true;
  const when = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`).getTime();
  return Date.now() - when > STALE_DAYS * 24 * 60 * 60 * 1000;
});

console.log('🗂  Surface registry check\n');
console.log(`   routes in app/ : ${routes.length}`);
console.log(`   registry rows  : ${rows.size}\n`);

let failed = false;

if (missing.length > 0) {
  failed = true;
  console.error('❌ Routes with no registry row — they would ship below the bar:');
  for (const route of missing) console.error(`     ${route}`);
  console.error('');
}

if (extra.length > 0) {
  failed = true;
  console.error('❌ Registry rows pointing at a route that does not exist:');
  for (const route of extra) console.error(`     ${route}`);
  console.error('');
}

if (stale.length > 0) {
  console.log(`⏳ ${stale.length} row(s) have not been audited in ${STALE_DAYS} days:`);
  for (const [route] of stale) console.log(`     ${route}`);
  console.log('');
}

if (failed) {
  console.error('   Add a row to docs/SURFACES.md for every route, or delete the route.');
  process.exit(1);
}

console.log('✅ Every route has a registry row, and every row points at a real route.');
process.exit(0);
