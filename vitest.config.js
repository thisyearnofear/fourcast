import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Only our own tests — keeps vitest away from the OpenZeppelin submodule's
    // hardhat suite under contracts/lib/ (154 phantom failures otherwise).
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx', 'services/**/*.test.js', 'utils/**/*.test.js', 'app/**/*.test.js'],
    environmentMatchGlobs: [
      ['tests/**/*.test.jsx', 'jsdom'],
    ],
    exclude: [
      'node_modules/**',
      'contracts/**',
      'lib/openzeppelin-contracts/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  esbuild: {
    // Use the automatic JSX runtime in .jsx test files so JSX compiles to
    // imports from `react/jsx-runtime` instead of `React.createElement(...)`
    // (which would require `import React from 'react'` in every test file).
    // The previous `loader: 'jsx'` block was too broad (reclassified every
    // .js file in the dep graph as JSX) and is no longer needed because the
    // OperatorMath component has been renamed to `.jsx`.
    jsx: 'automatic',
  },
});
