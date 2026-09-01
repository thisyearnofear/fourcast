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
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
    // Graceful degradation: return 200 with a helpful message when we can't
    // answer, rather than a 400 that looks like the miner is broken.
    return res.status(parsed.status).json({
      request_id: parsed.request_id || null,
      intent: null,
      score: '',
      label: 'unsupported',
      winner: '',
      reason: parsed.message || 'This miner serves SPORTS_SCORE and GAME_RESULT. Try asking about a specific team, fixture, or competition.',
      answer: null,
      metadata: {
        error: parsed.error,
        supported_intents: parsed.extra?.supported_intents || [],
        source: 'fourcast-txline',
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
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

// PM2 forks via ProcessContainerFork.js, so argv[1] is PM2's container;
// pm_exec_path holds the real script path under PM2.
const entryScript = process.env.pm_exec_path || process.argv[1];
const isDirectRun =
  entryScript &&
  import.meta.url === pathToFileURL(resolve(entryScript)).href;

export default app;

if (isDirectRun) {
  app.listen(PORT, HOST, () => {
    console.log(`[fourcast-miner] Telegraph miner listening on ${HOST}:${PORT}`);
    console.log(`[fourcast-miner] Intents: ${SUPPORTED_INTENTS.join(', ')}`);
    console.log(`[fourcast-miner] TxLINE origin: ${process.env.TXLINE_API_ORIGIN || 'https://txline.txodds.com'}`);
    console.log(`[fourcast-miner] Token configured: ${Boolean(process.env.TXLINE_API_TOKEN)}`);
  });
}
