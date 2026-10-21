/**
 * Machine-readable surfaces for agents: OpenAPI 3 doc + llms.txt.
 *
 * Telegraph P5. Both are generated from the registry — the intent enum an
 * agent reads here is the same list /status and telegraph.yaml show — so an
 * integrating agent can never be documented an intent we do not serve.
 *
 * The social card reuses the main app's OG renderer
 * (fourcastapp.vercel.app/api/og) — read-only consumption, the miner does
 * not render images.
 */

import { INTENT_REGISTRY, registeredIntentNames } from './intents/index.js';

// The calibration OG card — the product story rendered as an image. It takes
// its numbers as query params (resolved, brier, logloss, buckets, source,
// schema); bare, it renders NA honestly rather than inventing a score.
const OG_CARD = 'https://fourcastapp.vercel.app/api/og?type=calibration';

export function socialCardUrl() {
  return OG_CARD;
}

export function openApiDocument(baseUrl = 'https://miner.sportwarren.com') {
  const intents = registeredIntentNames();
  return {
    openapi: '3.0.3',
    info: {
      title: 'Fourcast Telegraph Miner',
      version: '1.1.0',
      description:
        'Sports scores and final results. TxLINE professional bookmaker consensus ' +
        'with Solana Merkle proofs where published; ESPN and OpenLigaDB public ' +
        'scoreboards otherwise. Every answer is Ed25519-signed; verified:true ' +
        'appears only with a real Merkle root.',
      'x-social-card': OG_CARD,
      'x-intents-registered': intents,
      'x-intents-compiled': INTENT_REGISTRY.map((i) => i.name),
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/query': {
        post: {
          operationId: 'query',
          summary: 'Ask for a score or a result',
          description:
            'Accepts the Telegraph envelope {intent, params, request_id} or a ' +
            'flatter auto-routed body ({query, team, fixture_id, …}). Intents ' +
            'outside the registered set are gracefully declined, never errored.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    intent: { type: 'string', enum: intents },
                    params: { $ref: '#/components/schemas/QueryParams' },
                    request_id: { type: 'string' },
                    query: { type: 'string', description: 'Natural-language ask (auto-routed form)' },
                    team: { type: 'string' },
                    fixture_id: { type: 'string' },
                    competition: { type: 'string' },
                    date: { type: 'string', description: 'YYYY-MM-DD' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Answer (or a graceful unsupported/no-result)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/QueryResponse' } } },
            },
            '400': { description: 'Missing or malformed request' },
          },
        },
      },
      '/health': {
        get: {
          operationId: 'health',
          summary: 'Liveness with the upstream ledger and TxLINE renewal state',
          responses: { '200': { description: 'ok | degraded' } },
        },
      },
      '/status': {
        get: {
          operationId: 'status',
          summary: 'Sources, coverage, signing-key state, registered intents',
          responses: { '200': { description: 'Miner status' } },
        },
      },
      '/api/asked': {
        get: {
          operationId: 'asked',
          summary: 'What the network actually asked and how we answered',
          responses: { '200': { description: 'Last 50 asks + outcome counters' } },
        },
      },
      '/.well-known/fourcast-miner.json': {
        get: {
          operationId: 'wellKnown',
          summary: 'Signing key + how to verify an attestation',
          responses: { '200': { description: 'Key and verification recipe' } },
        },
      },
      '/llms.txt': {
        get: {
          operationId: 'llmsTxt',
          summary: 'This miner, for agents',
          responses: { '200': { description: 'text/plain agent brief' } },
        },
      },
    },
    components: {
      schemas: {
        QueryParams: {
          type: 'object',
          properties: {
            team: { type: 'string' },
            opponent: { type: 'string' },
            fixture_id: { type: 'string' },
            competition: { type: 'string' },
            league: { type: 'string', description: 'Alias for competition' },
            date: { type: 'string' },
            home_team: { type: 'string' },
            away_team: { type: 'string' },
          },
        },
        QueryResponse: {
          type: 'object',
          required: ['intent', 'score', 'label', 'reason'],
          properties: {
            request_id: { type: 'string', nullable: true },
            intent: { type: 'string', enum: intents },
            score: { type: 'string', description: 'Canonical "2-1"; empty when unavailable' },
            label: { type: 'string', description: 'scheduled | live | final | no_result | unsupported' },
            winner: { type: 'string' },
            reason: { type: 'string' },
            answer: { type: 'object', nullable: true },
            metadata: { type: 'object' },
          },
        },
      },
    },
  };
}

export function llmsTxt(baseUrl = 'https://miner.sportwarren.com') {
  const intents = INTENT_REGISTRY.filter((i) => i.registered);
  return `# Fourcast Telegraph Miner

> Verified sports scores and match results. TxLINE professional bookmaker
> consensus with Solana Merkle proofs where published; ESPN and OpenLigaDB
> public scoreboards otherwise. Every answer is Ed25519-signed; verified:true
> appears only with a real Merkle root — never "we believe it".

Base URL: ${baseUrl}
Social card: ${OG_CARD}

## Intents (registered on-chain)

${intents.map((i) => `- ${i.name} — ${i.description}`).join('\n')}

The on-chain intent set is closed; only registered intents are advertised or
reachable through /query. Absent is never zero: a missing score is null, a
fixture we cannot find is answer:null with a reason.

## Endpoints

- [POST /query](${baseUrl}/query) — {intent, params, request_id} or flat {query, team, fixture_id}
- [GET /health](${baseUrl}/health) — liveness + upstream ledger + TxLINE renewal
- [GET /status](${baseUrl}/status) — sources, coverage, signing-key state
- [GET /api/asked](${baseUrl}/api/asked) — what the network asked, what we answered
- [GET /.well-known/fourcast-miner.json](${baseUrl}/.well-known/fourcast-miner.json) — signing key + verify recipe
- [GET /openapi.json](${baseUrl}/openapi.json) — OpenAPI 3 document

## Evidence

- metadata.attestation — Ed25519 signature over the settle fields; proves this miner said it.
- answer.proof — TxLINE Solana Merkle proof when published; proves the data.
- answer.source "espn" | "openligadb" — signed, not independently verifiable; verified:false.
`;
}
