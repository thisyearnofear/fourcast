#!/usr/bin/env node
/**
 * Render telegraph.yaml from the intent registry.
 *
 * telegraph.yaml is what gets pinned on-chain, so it must show exactly the
 * registered intents — no more, no less. It is generated: edit
 * telegraph.template.yaml for structure and src/intents/index.js for intent
 * names/descriptions, then run this. test/intentRegistry.test.js runs it in
 * --check mode so a hand-edit or a forgotten re-render fails the suite.
 *
 *   node scripts/render-manifest.mjs           # write telegraph.yaml
 *   node scripts/render-manifest.mjs --check   # verify only, exit 1 on drift
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { INTENT_REGISTRY } from '../src/intents/index.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATE_PATH = resolve(HERE, '../telegraph.template.yaml');
const OUTPUT_PATH = resolve(HERE, '../telegraph.yaml');

export function renderManifest(registry = INTENT_REGISTRY) {
  const registered = registry.filter((i) => i.registered);
  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  return template
    .replace('{{INTENT_ENUM}}', registered.map((i) => i.name).join(', '))
    .replace(
      '{{INTENT_DESCRIPTIONS}}',
      registered.map((i) => `${i.name} for ${i.description}`).join('; ') + '.',
    )
    .replace('{{SUPPORTED_INTENTS}}', registered.map((i) => `    - ${i.name}`).join('\n'));
}

const entryScript = process.env.pm_exec_path || process.argv[1];
const isDirectRun = entryScript && import.meta.url === pathToFileURL(resolve(entryScript)).href;

if (isDirectRun) {
  const check = process.argv.includes('--check');
  const rendered = renderManifest();
  const current = readFileSync(OUTPUT_PATH, 'utf8');

  if (rendered === current) {
    console.log('[render-manifest] telegraph.yaml is in sync with INTENT_REGISTRY');
  } else if (check) {
    console.error('[render-manifest] DRIFT: telegraph.yaml does not match INTENT_REGISTRY.');
    console.error('  Re-run: node scripts/render-manifest.mjs');
    process.exitCode = 1;
  } else {
    writeFileSync(OUTPUT_PATH, rendered);
    console.log('[render-manifest] telegraph.yaml regenerated from INTENT_REGISTRY');
  }
}
