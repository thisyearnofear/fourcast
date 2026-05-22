#!/usr/bin/env node
/**
 * Bundle Size Checker
 * 
 * Checks Edge route bundle sizes after build.
 * Warns at 750KB, fails at 900KB.
 * Runs as part of the CI pipeline.
 */

import fs from 'fs';
import path from 'path';

const WARN_SIZE = 750 * 1024;  // 750 KB
const FAIL_SIZE = 900 * 1024;  // 900 KB

function getRouteBundles() {
  const serverDir = '.next/server/app';
  if (!fs.existsSync(serverDir)) {
    console.error('❌ .next/server/app not found. Run "npm run build" first.');
    process.exit(1);
  }

  const bundles = [];

  function scanDir(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const routePrefix = prefix ? `${prefix}/` : '';

      if (entry.isDirectory()) {
        // Check if this is an API route
        if (entry.name === 'api' || entry.name.includes('api_')) {
          scanDir(fullPath, routePrefix + entry.name);
        } else if (entry.name === 'route.js' || entry.name === 'route.ts') {
          // This is a route handler
          const parentDir = path.dirname(fullPath);
          const routePath = parentDir
            .replace(serverDir, '')
            .replace(/\\/g, '/')
            .replace(/^\/app/, '/app');
          
          bundles.push({ path: routePath, file: fullPath });
        } else {
          scanDir(fullPath, routePrefix + entry.name);
        }
      }
    }
  }

  scanDir(serverDir);
  return bundles;
}

function getBundleSize(filepath) {
  try {
    const stat = fs.statSync(filepath);
    return stat.size;
  } catch {
    return 0;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

console.log('📦 Checking Edge route bundle sizes...\n');

const bundles = getRouteBundles();
let hasWarnings = false;
let hasErrors = false;

for (const bundle of bundles) {
  const size = getBundleSize(bundle.file);
  
  if (size > FAIL_SIZE) {
    console.error(`❌ FAIL: ${bundle.path} is ${formatSize(size)} (limit: ${formatSize(FAIL_SIZE)})`);
    hasErrors = true;
  } else if (size > WARN_SIZE) {
    console.warn(`⚠️  WARN: ${bundle.path} is ${formatSize(size)} (warn at ${formatSize(WARN_SIZE)})`);
    hasWarnings = true;
  } else {
    console.log(`✅ ${bundle.path}: ${formatSize(size)}`);
  }
}

console.log('');

if (hasErrors) {
  console.error('❌ FAILED: Bundle size exceeds limit');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('⚠️  WARNING: Some bundles are large');
  process.exit(0); // Warnings don't fail CI
} else {
  console.log('✅ All bundles within size budget');
  process.exit(0);
}