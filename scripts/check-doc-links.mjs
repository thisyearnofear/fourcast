#!/usr/bin/env node
/**
 * Doc link check — every markdown link in the repo must resolve.
 *
 * Docs get consolidated and moved; a link that silently rots is worse than no
 * link, because a reader trusts it. This is the same idea as
 * `check-surface-registry.mjs` applied to prose: mechanical, cheap, and it
 * fails the moment a doc moves without its references.
 *
 *   node scripts/check-doc-links.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SKIP = new Set([
  'node_modules', '.next', '.git', 'lib', 'canton', 'media', 'videos',
  'contracts', 'telegraph-miner', 'onchain', 'bot', 'cache', 'data',
  'deploy', 'assets', 'public', 'idl', 'types', 'migrations',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue; // broken symlink or a file that vanished mid-walk
    }
    if (st.isDirectory()) walk(p, out);
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

let checked = 0;
let broken = 0;
let badAnchors = 0;

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const dir = dirname(file);
  const rel = relative(ROOT, file);

  for (const m of src.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const target = m[2];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [pathPart, anchor] = target.split('#');
    if (!pathPart) continue;
    checked++;

    const abs = resolve(dir, pathPart);
    if (!existsSync(abs)) {
      console.error(`❌ ${rel} → ${target}`);
      broken++;
      continue;
    }
    if (anchor) {
      const body = readFileSync(abs, 'utf8');
      const slugs = new Set(
        [...body.matchAll(/^#{1,6}\s+(.*)$/gm)].map((h) => slug(h[1]))
      );
      if (!slugs.has(slug(anchor))) {
        console.error(`⚠️  ${rel} → ${target} (anchor not found in ${relative(ROOT, abs)})`);
        badAnchors++;
      }
    }
  }
}

if (broken || badAnchors) {
  console.error(
    `\n❌ ${broken} broken link(s), ${badAnchors} bad anchor(s) — fix the doc moves.`
  );
  process.exit(1);
}
console.log(`✅ ${checked} local doc link(s) checked — none broken.`);
