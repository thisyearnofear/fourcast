/**
 * Miner status and metadata endpoint.
 */

import { txline } from './txline.js';

export async function getMinerStatus() {
  const txlineStatus = await txline.getStatus();

  return {
    miner: {
      name: 'Fourcast Telegraph Miner',
      version: '1.0.0',
      intents: ['SPORTS_SCORE', 'GAME_RESULT'],
      tier: 'A',
      category: 'Weather & Sports',
      evaluation_method: 'WASM Exact Match',
      deterministic: false, // live data changes over time
    },
    data_source: {
      provider: 'TxLINE / TxODDS',
      description: 'Professional bookmaker consensus odds and verified match results',
      verification: 'Solana Merkle proofs — independently verifiable on-chain',
      coverage: [
        'MLS (Major League Soccer) — live',
        'NFL (National Football League) — live',
        'Premier League — live from Aug 21 2025',
        'International Friendlies',
      ],
      documentation: 'https://txline-docs.txodds.com',
    },
    connection: txlineStatus,
    differentiators: [
      'Cryptographic proof of every result (Solana Merkle tree)',
      'Professional bookmaker consensus — sharpest odds available',
      'On-chain verification: consumers can independently validate without trusting the miner',
      'Sub-minute latency on live scores',
      'Free tier data (no cost overhead passed to consumers)',
    ],
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
