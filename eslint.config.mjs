import next from 'eslint-config-next';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

const config = [
  {
    name: 'fourcast/ignores',
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'coverage/**',
      // Separate toolchains with their own package.json (and their own CI jobs).
      'onchain/**',
      'telegraph-miner/**',
      'media/**',
      'videos/**',
      // Solidity + a gitignored copy of OpenZeppelin; no JS to lint here.
      'contracts/**',
      // The OpenZeppelin submodule. lib/*.js are first-party and stay linted.
      'lib/openzeppelin-contracts/**',
    ],
  },
  ...next,
  {
    name: 'fourcast/runtime',
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    name: 'fourcast/react-compiler-rules-as-warnings',
    plugins: { 'react-hooks': reactHooks },
    // The React Compiler-based hook rules in eslint-plugin-react-hooks v7 are
    // stricter than the hook-correctness rules. Keep them visible as warnings;
    // rules-of-hooks and exhaustive-deps stay at error.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
];

export default config;
