#!/usr/bin/env node
/**
 * Design token lint — gate G1 of the surface quality bar.
 *
 * The rule: colour in `components/` and `app/` comes from `tokens.css` by
 * NAME. A raw `#hex` / `rgb()` / `hsl()` is a drift away from the design
 * system, and drift is how a product stops looking like one product.
 *
 * This lint RATCHETS rather than fails flat:
 *
 *   - first run  → writes a baseline and reports the debt (exit 0)
 *   - later runs → fails only if a file's count INCREASED (exit 1)
 *   - --update   → rewrites the baseline (call it after fixing things)
 *   - --enforce  → fails on any violation above the baseline, and on any
 *                  file missing from the baseline (new debt is new debt)
 *
 * So a fix banks permanently and the suite never goes red on legacy debt.
 * Escape hatch, with a reason, on the offending line:
 *
 *   const COLORS = { sky: '#87CEEB' }; // token-ok — legacy chart palette
 *
 * Usage:
 *   node scripts/check-design-tokens.mjs            # report + ratchet
 *   node scripts/check-design-tokens.mjs --enforce  # CI gate
 *   node scripts/check-design-tokens.mjs --update   # accept current state
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'design-tokens-baseline.json');
const SCAN_ROOTS = ['app', 'components'];
const SCAN_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);
/**
 * `api` and `canvasui` are excluded on purpose: they RENDER PIXELS — an OG
 * image through satori, a scene through a 2D/3D canvas. CSS custom properties
 * do not exist in those contexts, so a raw colour there is correct, not drift.
 * Linting them would train the team to ignore the lint.
 */
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'contracts', 'lib', 'out', 'dist', 'coverage',
  'api', 'canvasui', 'weather3d',
]);

/**
 * Canvas / WebGL renderers. These paint pixels with a 2D context or
 * three.js material, where a CSS custom property is not available — the
 * honest fix is to read the token off the document at runtime
 * (`getComputedStyle(document.body).getPropertyValue('--color-accent')`),
 * which is a follow-up, not a reason to lint them into silence today.
 */
const PIXEL_RENDERERS = new Set([
  'components/Scene3D.js',
  'components/CardScene.js',
  'components/WaveGrid.js',
]);

// A raw colour literal. `#` is excluded when it is part of a `0x…` literal or
// preceded by a word character (so `url(#gradient)` and `id="x#y"` are safe).
const COLOR_PATTERNS = [
  { kind: 'hex', re: /(?<![0-9A-Za-z_-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g },
  { kind: 'fn', re: /\b(?:rgba?|hsla?)\(\s*[0-9.]/g },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Count raw colour literals per file, ignoring `token-ok` lines. */
function scanFile(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const hits = [];
  lines.forEach((line, index) => {
    if (line.includes('token-ok')) return;
    for (const { kind, re } of COLOR_PATTERNS) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(line)) !== null) {
        hits.push({ line: index + 1, kind, literal: match[0], text: line.trim().slice(0, 120) });
      }
    }
  });
  return hits;
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeBaseline(counts) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

const args = process.argv.slice(2);
const enforce = args.includes('--enforce');
const update = args.includes('--update');

const counts = {};
const detail = {};
let total = 0;

for (const root of SCAN_ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    const rel = path.relative(ROOT, file);
    if (PIXEL_RENDERERS.has(rel)) continue;
    const hits = scanFile(file);
    if (hits.length === 0) continue;
    counts[rel] = hits.length;
    detail[rel] = hits;
    total += hits.length;
  }
}

const files = Object.keys(counts).length;
const baseline = readBaseline();

console.log('🎨 Design token lint — raw colour literals outside tokens.css\n');
console.log(`   files scanned : ${SCAN_ROOTS.join(', ')} (${files} with hits)`);
console.log(`   violations    : ${total}\n`);

if (total > 0) {
  for (const [file, hits] of Object.entries(detail)) {
    console.log(`  ${file} — ${hits.length}`);
    for (const hit of hits.slice(0, 4)) {
      console.log(`      ${String(hit.line).padStart(4)}: ${hit.literal.padEnd(22)} ${hit.text}`);
    }
    if (hits.length > 4) console.log(`      … ${hits.length - 4} more`);
    console.log('');
  }
}

if (!baseline) {
  writeBaseline(counts);
  console.log('📌 No baseline yet — wrote scripts/design-tokens-baseline.json.');
  console.log('   Fix what you can, then run: node scripts/check-design-tokens.mjs --update');
  process.exit(0);
}

const regressions = [];
for (const [file, count] of Object.entries(counts)) {
  const before = baseline[file] ?? 0;
  if (count > before) regressions.push({ file, before, after: count });
}

const newFiles = enforce
  ? Object.keys(counts).filter((file) => !(file in baseline))
  : [];

if (update) {
  writeBaseline(counts);
  console.log('✅ Baseline updated to the current state.');
  process.exit(0);
}

if (regressions.length > 0 || newFiles.length > 0) {
  console.log('❌ Design token regression — raw colour went UP, not down:\n');
  for (const r of regressions) {
    console.log(`   ${r.file}: ${r.before} → ${r.after}`);
  }
  for (const f of newFiles) {
    console.log(`   ${f}: new file, ${counts[f]} raw colour literal(s) not in the baseline`);
  }
  console.log('\n   Use a token by name, or add `// token-ok — <reason>` on the line.');
  process.exit(1);
}

const banked = Object.keys(baseline).filter((file) => counts[file] === undefined || counts[file] < baseline[file]);
if (banked.length > 0) {
  console.log(`📈 ${banked.length} file(s) improved — run --update to bank the reduction.`);
}
console.log('✅ No regression. Raw colour is not going up.');
process.exit(0);
