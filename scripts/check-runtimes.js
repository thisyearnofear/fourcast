#!/usr/bin/env node
/**
 * Runtime Declaration Checker
 * 
 * Validates that all API routes declare their runtime explicitly.
 * Runs as part of the CI pipeline.
 */

import fs from 'fs';
import path from 'path';

const ROOTS = ['app/api'];
const REQUIRED_RUNTIME = /export\s+const\s+runtime\s*=\s*['"](edge|nodejs)['"]/;

let hasErrors = false;
let checkedCount = 0;

function checkFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  checkedCount++;
  
  if (!REQUIRED_RUNTIME.test(content)) {
    const rel = path.relative(process.cwd(), filepath);
    console.error(`❌ Missing runtime declaration: ${rel}`);
    hasErrors = true;
    return false;
  }
  
  return true;
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and hidden dirs
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walkDir(fullPath);
    } else if (entry.name === 'route.js' || entry.name === 'route.ts') {
      checkFile(fullPath);
    }
  }
}

console.log('🔍 Checking runtime declarations...\n');

for (const root of ROOTS) {
  walkDir(root);
}

console.log(`\nChecked ${checkedCount} route file(s)`);

if (hasErrors) {
  console.log('\n❌ FAILED: Some routes are missing runtime declarations');
  console.log('Add "export const runtime = \'edge\'" or "export const runtime = \'nodejs\'" to each route');
  process.exit(1);
} else {
  console.log('\n✅ All routes have runtime declarations');
  process.exit(0);
}