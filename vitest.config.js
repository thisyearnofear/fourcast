import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Only our own tests — keeps vitest away from the OpenZeppelin submodule's
    // hardhat suite under contracts/lib/ (154 phantom failures otherwise).
    include: ['tests/**/*.test.js', 'services/**/*.test.js', 'utils/**/*.test.js', 'app/**/*.test.js'],
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
});
