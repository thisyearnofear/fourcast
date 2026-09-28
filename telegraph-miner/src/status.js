/**
 * Miner status: sources, coverage, and the state of the signing key.
 * Claims here are limited to what the code does.
 */

import { txline } from './txline.js';
import { LEAGUES } from './espn.js';
import { publicKey, keyIsPersistent } from './attest.js';
import { upstreamReport } from './observe.js';

export async function getMinerStatus() {
  const txlineStatus = await txline.getStatus();

  return {
    miner: {
      name: 'Fourcast Telegraph Miner',
      version: '1.1.0',
      intents: ['SPORTS_SCORE', 'GAME_RESULT'],
      deterministic: false, // live data changes over time
    },
    sources: {
      txline: {
        role: 'primary; the only source with independently verifiable (Solana Merkle) proofs',
        note: 'free tier: limited leagues and no historical results',
        connection: txlineStatus,
      },
      espn: {
        role: 'fallback for live scores and recent finals; signed, not independently verifiable',
        leagues: LEAGUES.map((l) => l.name),
      },
    },
    signing: { algorithm: 'ed25519', public_key: publicKey, persistent: keyIsPersistent },
    upstream: upstreamReport().calls,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
