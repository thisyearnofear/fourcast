/**
 * Fourcast Telegraph Miner
 *
 * Serves verified sports intelligence (SPORTS_SCORE, GAME_RESULT) to the
 * Telegraph Protocol network. Data sourced from TxLINE — professional
 * bookmaker consensus with Solana Merkle proof verification.
 *
 * Intents served:
 *   - SPORTS_SCORE: live and recent match scores
 *   - GAME_RESULT:  final match results with cryptographic proof
 */

import 'dotenv/config';
import express from 'express';
import { handleSportsScore } from './intents/sportsScore.js';
import { handleGameResult } from './intents/gameResult.js';
import { getMinerStatus } from './status.js';
import { txline } from './txline.js';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 8402;
const HOST = process.env.HOST || '0.0.0.0';

// ─── Intent Router ──────────────────────────────────────────────────────────

const INTENT_HANDLERS = {
  SPORTS_SCORE: handleSportsScore,
  GAME_RESULT: handleGameResult,
};

/**
 * POST /query
 *
 * Telegraph miners receive intent requests as POST with a JSON body:
 * {
 *   "intent": "SPORTS_SCORE",
 *   "params": { ... intent-specific parameters ... },
 *   "request_id": "uuid",
 *   "timestamp": "iso8601"
 * }
 *
 * Response must be deterministic and match the evaluation script's expected
 * ground-truth format for "WASM Exact Match" scoring.
 */
app.post('/query', async (req, res) => {
  const start = Date.now();
  const { intent, params, request_id } = req.body || {};

  if (!intent) {
    return res.status(400).json({
      error: 'missing_intent',
      message: 'Request must include an "intent" field',
    });
  }

  const handler = INTENT_HANDLERS[intent];
  if (!handler) {
    return res.status(400).json({
      error: 'unsupported_intent',
      message: `This miner serves SPORTS_SCORE and GAME_RESULT intents. Received: ${intent}`,
      supported_intents: Object.keys(INTENT_HANDLERS),
    });
  }

  try {
    const result = await handler(params || {});
    const latencyMs = Date.now() - start;

    return res.json({
      request_id: request_id || null,
      intent,
      answer: result.answer,
      metadata: {
        ...result.metadata,
        provider: 'fourcast-txline',
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(`[miner] ${intent} error:`, err.message);
    return res.status(500).json({
      error: 'handler_error',
      message: err.message,
      intent,
      request_id: request_id || null,
    });
  }
});

// ─── Health & Status ────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/status', async (_req, res) => {
  const status = await getMinerStatus();
  res.json(status);
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Fourcast Telegraph Miner',
    description: 'Verified sports intelligence powered by TxLINE (professional bookmaker consensus + Solana Merkle proofs)',
    intents: ['SPORTS_SCORE', 'GAME_RESULT'],
    evaluation: 'WASM Exact Match',
    tier: 'A',
    category: 'Weather & Sports',
    source: 'TxLINE/TxODDS',
    verification: 'Solana Merkle proofs (on-chain)',
    docs: 'https://txline-docs.txodds.com',
    endpoints: {
      query: 'POST /query',
      health: 'GET /health',
      status: 'GET /status',
    },
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`[fourcast-miner] Telegraph miner listening on ${HOST}:${PORT}`);
  console.log(`[fourcast-miner] Intents: SPORTS_SCORE, GAME_RESULT`);
  console.log(`[fourcast-miner] TxLINE origin: ${process.env.TXLINE_API_ORIGIN || 'https://txline.txodds.com'}`);
  console.log(`[fourcast-miner] Token configured: ${Boolean(process.env.TXLINE_API_TOKEN)}`);
});

export default app;
