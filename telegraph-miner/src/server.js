/**
 * Fourcast Telegraph Miner
 *
 * Serves verified sports intelligence (SPORTS_SCORE, GAME_RESULT) to the
 * Telegraph Protocol network. Data sourced from TxLINE — professional
 * bookmaker consensus with Solana Merkle proof verification.
 *
 * POST /query accepts:
 *   - envelope { intent, params, request_id } (direct callers)
 *   - flatter { query, team, fixture_id, ... } (Telegraph auto-router)
 */

import 'dotenv/config';
import express from 'express';
import { handleSportsScore } from './intents/sportsScore.js';
import { handleGameResult } from './intents/gameResult.js';
import { getMinerStatus } from './status.js';
import {
  SUPPORTED_INTENTS,
  normalizeQueryRequest,
  signalFieldsFromAnswer,
} from './query.js';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 8402;
const HOST = process.env.HOST || '0.0.0.0';

const INTENT_HANDLERS = {
  SPORTS_SCORE: handleSportsScore,
  GAME_RESULT: handleGameResult,
};

app.post('/query', async (req, res) => {
  const start = Date.now();
  const parsed = normalizeQueryRequest(req.body);

  if (!parsed.ok) {
    return res.status(parsed.status).json({
      error: parsed.error,
      message: parsed.message,
      ...(parsed.extra || {}),
    });
  }

  const { intent, params, request_id } = parsed;
  const handler = INTENT_HANDLERS[intent];

  try {
    const result = await handler(params || {});
    const latencyMs = Date.now() - start;
    const signals = signalFieldsFromAnswer(result.answer);
    const answer = result.answer
      ? { ...result.answer, proof_available: signals.proof_available }
      : result.answer;

    return res.json({
      request_id: request_id || null,
      intent,
      score: signals.score,
      label: signals.label,
      winner: signals.winner,
      reason: signals.reason,
      answer,
      metadata: {
        ...result.metadata,
        source: result.metadata?.source || 'txline',
        verification:
          result.metadata?.verification ||
          result.metadata?.verification_method ||
          'solana-merkle-proof',
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
    intents: [...SUPPORTED_INTENTS],
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

export default app;

app.listen(PORT, HOST, () => {
  console.log(`[fourcast-miner] Telegraph miner listening on ${HOST}:${PORT}`);
  console.log(`[fourcast-miner] Intents: ${SUPPORTED_INTENTS.join(', ')}`);
  console.log(`[fourcast-miner] TxLINE origin: ${process.env.TXLINE_API_ORIGIN || 'https://txline.txodds.com'}`);
  console.log(`[fourcast-miner] Token configured: ${Boolean(process.env.TXLINE_API_TOKEN)}`);
});
