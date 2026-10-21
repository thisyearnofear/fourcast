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
    jsx: 'automatic',
    // Next.js compiles JSX inside .js files; vite does not. Our app pages
    // (app/arena/page.js, app/signals/page.js, …) are .js WITH JSX, so any
    // test that mounts a real page — see tests/surfaceContract.test.jsx —
    // needs the jsx loader on them. Scoped to our own source: the earlier
    // broad `loader: 'jsx'` reclassified every .js file in the dep graph,
    // and there are no .ts/.tsx files under app/ or components/ to lose.
    // `exclude` has to be set too: vite's default is /\.js$/, which would
    // keep .js out of the esbuild step entirely.
    include: [/(^|\/)(app|components|tests|utils|services|hooks)\/.*\.jsx?$/],
    exclude: /node_modules/,
    loader: 'jsx',
  },
});
