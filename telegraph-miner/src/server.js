/**
 * Fourcast Telegraph Miner
 *
 * Serves SPORTS_SCORE and GAME_RESULT to the Telegraph network.
 *
 *   POST /query                      the scored endpoint (envelope or flat body)
 *   GET  /health                     ok | degraded, with the upstream ledger
 *   GET  /status                     sources, coverage, key state
 *   GET  /api/asked                  what the network actually asked, and how we answered
 *   GET  /.well-known/fourcast-miner.json   signing key + how to verify
 *
 * Every /query answer carries two independent kinds of evidence, never merged:
 *   metadata.attestation   Ed25519 signature over the settle fields — proves
 *                          this miner said it
 *   answer.proof           TxLINE Solana Merkle proof, when one is published —
 *                          proves the data. ESPN-sourced answers have none and
 *                          say `verified: false`.
 */

import 'dotenv/config';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { handleSportsScore } from './intents/sportsScore.js';
import { handleGameResult } from './intents/gameResult.js';
import { getMinerStatus } from './status.js';
import { SUPPORTED_INTENTS, normalizeQueryRequest } from './query.js';
import { signalFieldsFromAnswer } from './answer.js';
import { recordAsk, askedReport, upstreamReport } from './observe.js';
import { txline } from './txline.js';
import { txlineCompetitionId, txlineRenewal } from './utils.js';
import { attest, settleFields, publicKey, keyIsPersistent, SIGNED_FIELDS, ALGORITHM } from './attest.js';

const app = express();
app.use(express.json({ limit: '64kb' }));

// A malformed JSON body is the caller's fault, not a server fault — answer 400
// with the same shape as every other refusal instead of Express's HTML page.
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    recordAsk({ body: {}, outcome: 'bad_request', reason: 'invalid JSON body', userAgent: req.headers['user-agent'] });
    return res.status(400).json({ error: 'invalid_json', message: 'Request body is not valid JSON' });
  }
  return next(err);
});

const PORT = Number(process.env.PORT) || 8402;
const HOST = process.env.HOST || '0.0.0.0';
const SITE = process.env.MINER_PUBLIC_URL || 'https://miner.sportwarren.com';

const INTENT_HANDLERS = {
  SPORTS_SCORE: handleSportsScore,
  GAME_RESULT: handleGameResult,
};

// A miner that stops answering is deregistered; one bad upstream body must
// drop one request, not the process.
process.on('unhandledRejection', (err) => {
  console.error('[miner] unhandled rejection (request dropped, miner stays up):', err);
});

app.post('/query', async (req, res) => {
  const start = Date.now();
  const body = req.body;
  const ua = req.headers['user-agent'];
  const parsed = normalizeQueryRequest(body);

  if (!parsed.ok) {
    const outcome = parsed.status === 200 ? 'unsupported' : 'bad_request';
    recordAsk({ body, outcome, reason: parsed.error, latencyMs: Date.now() - start, userAgent: ua });
    return res.status(parsed.status).json({
      request_id: body?.request_id ?? null,
      intent: null,
      score: '',
      label: outcome === 'unsupported' ? 'unsupported' : 'bad_request',
      winner: '',
      reason:
        parsed.message ||
        'This miner serves SPORTS_SCORE and GAME_RESULT. Ask about a specific team, fixture, or competition.',
      answer: null,
      metadata: {
        error: parsed.error,
        supported_intents: parsed.extra?.supported_intents || SUPPORTED_INTENTS,
        source: null,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const { intent, params, request_id } = parsed;

  try {
    const result = await INTENT_HANDLERS[intent](params || {});
    const answer = result.answer ?? null;
    const signals = signalFieldsFromAnswer(answer, result.metadata?.message);
    const issuedAt = new Date().toISOString();
    const latencyMs = Date.now() - start;

    recordAsk({
      body,
      intent,
      params,
      outcome: answer ? 'answered' : 'no_result',
      source: answer?.source ?? null,
      reason: signals.reason,
      latencyMs,
      userAgent: ua,
    });

    return res.json({
      request_id: request_id ?? null,
      intent,
      score: signals.score,
      label: signals.label,
      winner: signals.winner,
      reason: signals.reason,
      answer,
      metadata: {
        ...result.metadata,
        source: answer?.source ?? result.metadata?.source ?? null,
        verification: answer?.proof?.verifiable ? 'solana-merkle-proof' : 'none',
        provider: 'fourcast',
        latency_ms: latencyMs,
        timestamp: issuedAt,
        attestation: attest(settleFields({ intent, request_id, answer, signals, issuedAt })),
      },
    });
  } catch (err) {
    console.error(`[miner] ${intent} error:`, err.message);
    recordAsk({ body, intent, params, outcome: 'error', reason: err.message, latencyMs: Date.now() - start, userAgent: ua });
    return res.status(500).json({
      error: 'handler_error',
      message: err.message,
      intent,
      request_id: request_id ?? null,
    });
  }
});

// Health with enough in it to act on. Always 200: the node's liveness check
// reads `status`, and a 503 for an upstream outage gets a miner deregistered.
app.get('/health', (_req, res) => {
  const { calls, degraded } = upstreamReport();
  res.json({
    status: degraded ? 'degraded' : 'ok',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    upstream: calls,
    txline_renewal: txlineRenewal(),
    signing_key_persistent: keyIsPersistent,
  });
});

app.get('/status', async (_req, res) => {
  res.json(await getMinerStatus());
});

// What the network actually sends. Read this before reasoning about what a
// scorer sees — the docs and the tournament have disagreed before.
app.get('/api/asked', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(askedReport());
});

app.get('/.well-known/fourcast-miner.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    name: 'fourcast-sports-intelligence',
    intents: SUPPORTED_INTENTS,
    signing: {
      algorithm: ALGORITHM,
      public_key: publicKey,
      public_key_encoding: 'base64 raw 32-byte Ed25519 public key',
      persistent: keyIsPersistent,
      signed_fields: SIGNED_FIELDS,
      canonical_form: 'JSON of the signed fields, keys sorted, no whitespace (metadata.attestation.canonical)',
      verify_node:
        "nacl.sign.detached.verify(new TextEncoder().encode(att.canonical), Buffer.from(att.signature,'base64'), Buffer.from(PUBLIC_KEY,'base64')) // tweetnacl",
      verify_cli: 'node telegraph-miner/scripts/verify.mjs --url ' + SITE + ' --team "Inter Miami" --intent GAME_RESULT',
    },
    evidence: {
      attestation: 'Proves this miner issued the values. Present on every answer.',
      proof: 'TxLINE Solana Merkle proof. Present only when answer.source is "txline" and TxLINE published one; answer.verified is true only then.',
      espn: 'answer.source "espn" is a free public scoreboard: signed, not independently verifiable.',
    },
    source: 'https://github.com/thisyearnofear/fourcast/tree/main/telegraph-miner',
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Fourcast Telegraph Miner',
    description:
      'Sports scores and final results. TxLINE with Solana Merkle proofs where published; ESPN public scoreboards otherwise. Every answer is Ed25519-signed.',
    intents: [...SUPPORTED_INTENTS],
    sources: {
      txline: 'professional feed; Merkle-proof verifiable when a proof is published',
      espn: 'free public scoreboards; signed, not independently verifiable',
    },
    endpoints: {
      query: 'POST /query',
      health: 'GET /health',
      status: 'GET /status',
      asked: 'GET /api/asked',
      keys: 'GET /.well-known/fourcast-miner.json',
    },
  });
});

// PM2 forks via ProcessContainerFork.js, so argv[1] is PM2's container;
// pm_exec_path holds the real script path under PM2.
const entryScript = process.env.pm_exec_path || process.argv[1];
const isDirectRun = entryScript && import.meta.url === pathToFileURL(resolve(entryScript)).href;

export default app;

if (isDirectRun) {
  app.listen(PORT, HOST, () => {
    console.log(`[fourcast-miner] listening on ${HOST}:${PORT} — intents ${SUPPORTED_INTENTS.join(', ')}`);
    console.log(`[fourcast-miner] TxLINE token configured: ${Boolean(process.env.TXLINE_API_TOKEN)}`);
    console.log(`[fourcast-miner] signing key ${keyIsPersistent ? 'persistent' : 'EPHEMERAL (set MINER_SIGNING_KEY)'}: ${publicKey}`);
  });

  // The unfiltered TxLINE fixture snapshot is ~29 MB / ~4 s and the NFL one
  // another beat; the first ask after a restart used to pay that bill (6.5 s
  // measured). Warm the two cache keys the handlers use so the network never
  // sees a cold start. Failures are logged only — the cache serves stale and
  // the handlers fall back to ESPN on their own.
  if (process.env.TXLINE_API_TOKEN && process.env.TXLINE_WARMUP !== 'off') {
    const warm = (label, id) =>
      txline
        .getFixtures(id)
        .then((f) => console.log(`[fourcast-miner] warmed TxLINE ${label}: ${Array.isArray(f) ? f.length : 0} fixtures`))
        .catch((err) => console.error(`[fourcast-miner] TxLINE warm ${label} failed: ${err.message}`));
    warm('snapshot', undefined);
    warm('NFL', txlineCompetitionId('nfl'));
  }
}
