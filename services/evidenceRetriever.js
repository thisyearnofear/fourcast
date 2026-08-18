/**
 * Evidence Retriever — web search as the forecaster's grounding layer.
 *
 * Two backends, tried in order:
 *   1. Vercel AI Gateway Exa search (free through Aug 31 2026) — uses the
 *      AI SDK's gateway.tools.exaSearch() provider-executed tool via
 *      generateText. No direct Exa API key needed; the gateway handles
 *      auth and execution server-side.
 *   2. Direct Exa REST API (EXA_API_KEY) — fallback if gateway unavailable
 *      or rate-limited.
 *
 * A 6h per-question cache caps spend (hourly agent cycles → ≤4 refreshes/question/day).
 */

if (typeof window !== 'undefined') {
  throw new Error('evidenceRetriever is server-only');
}

import { withRateLimit } from './gatewayRateLimiter.js';

const EXA_ENDPOINT = 'https://api.exa.ai/search';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_SIZE = 50;
const cache = new Map();

/**
 * LRU cache wrapper: promotes keys on access, evicts oldest when full.
 * Replaces the plain Map so memory stays bounded even across thousands of questions.
 */
function getFromLRUCache(key) {
  if (!cache.has(key)) return null;
  // Promote to most recently used (delete + re-add at end)
  const entry = cache.get(key);
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function setLRUCache(key, value) {
  // Evict least recently used if full
  while (cache.size >= CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, value);
}

// ─── Gateway-based Exa search (free tier) ──────────────────────────────────

let _sdk = null;

async function loadAiSdk(apiKey) {
  if (!_sdk) {
    const ai = await import('ai');
    const gw = ai.createGateway({ apiKey });
    _sdk = {
      generateText: ai.generateText,
      stepCountIs: ai.stepCountIs,
      gateway: gw,
    };
  }
  return _sdk;
}

/**
 * Perform web search via Vercel AI Gateway's built-in Exa tool.
 * Uses generateText with the provider-executed exaSearch tool.
 * The model calls the tool; the gateway executes the search server-side.
 * We extract raw results from the tool response.
 */
async function retrieveEvidenceViaGateway(question, { numResults = 5, maxCharacters = 700 } = {}) {
  const apiKey = process.env.VERCEL_GATEWAY_API_KEY;
  if (!apiKey) return null;

  try {
    const { generateText, stepCountIs, gateway } = await loadAiSdk(apiKey);
    const model = process.env.VERCEL_GATEWAY_MODEL || 'zai/glm-4.7-flash';

    const result = await withRateLimit(() =>
      generateText({
        model: gateway.languageModel(model),
        prompt: `Search the web for recent information about: "${question}". Use the exa_search tool to find relevant results.`,
        tools: {
          exa_search: gateway.tools.exaSearch({
            numResults,
            contents: {
              text: { maxCharacters },
              highlights: { query: question, maxCharacters: 300 },
            },
          }),
        },
        toolChoice: 'required',
        stopWhen: stepCountIs(2),
        maxOutputTokens: 100,
      })
    );

    // Extract search results from tool execution steps
    for (const step of result.steps || []) {
      for (const tr of step.toolResults || []) {
        if (tr.toolName === 'exa_search' && tr.output?.results) {
          const snippets = tr.output.results
            .map((r) => ({
              title: r.title || '',
              url: r.url || '',
              publishedDate: r.publishedDate || null,
              text: buildSnippetText(r),
            }))
            .filter((s) => s.text.length > 40);
          if (snippets.length > 0) return snippets;
        }
      }
    }
    return null;
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('rate') || msg.includes('429') || msg.includes('Unauthenticated')) {
      console.warn(`[evidenceRetriever] gateway search rate-limited/auth: ${msg.slice(0, 100)}`);
    } else {
      console.warn(`[evidenceRetriever] gateway search failed: ${msg.slice(0, 150)}`);
    }
    return null;
  }
}

/**
 * Build snippet text from an Exa result object.
 * Prefers full text; falls back to highlights joined.
 */
function buildSnippetText(result) {
  if (result.text && result.text.length > 40) {
    return result.text.replace(/\s+/g, ' ').trim();
  }
  if (result.highlights && result.highlights.length > 0) {
    return result.highlights.join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

// ─── Direct Exa API (fallback) ──────────────────────────────────────────────

async function retrieveEvidenceDirectExa(question, { numResults = 5, maxCharacters = 700 } = {}) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(EXA_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: question,
        type: 'auto',
        numResults,
        contents: { text: { maxCharacters } },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[evidenceRetriever] exa-direct ${res.status}: ${body.slice(0, 120)}`);
      return null;
    }

    const data = await res.json();
    const snippets = (data.results || [])
      .map((r) => ({
        title: r.title || '',
        url: r.url || '',
        publishedDate: r.publishedDate || null,
        text: (r.text || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((s) => s.text.length > 40);

    return snippets.length > 0 ? snippets : null;
  } catch (err) {
    console.warn(`[evidenceRetriever] exa-direct failed: ${err.message.slice(0, 100)}`);
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Retrieve web evidence for a market question.
 * Tries Vercel AI Gateway Exa search (free) first, falls back to direct Exa API.
 *
 * @param {string} question
 * @param {{ numResults?: number, maxCharacters?: number }} opts
 * @returns {Promise<{ query: string, snippets: Array<{title: string, url: string,
 *           publishedDate: string|null, text: string}> } | null>}
 */
export async function retrieveEvidence(question, { numResults = 5, maxCharacters = 700 } = {}) {
  if (!question) return null;

  const key = `${question.toLowerCase().trim()}|${numResults}`;
  const hit = getFromLRUCache(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.value;

  let snippets = null;

  // 1. Try Vercel AI Gateway Exa search (free through Aug 31)
  if (process.env.VERCEL_GATEWAY_API_KEY) {
    snippets = await retrieveEvidenceViaGateway(question, { numResults, maxCharacters });
  }

  // 2. Fallback to direct Exa API
  if (!snippets && process.env.EXA_API_KEY) {
    snippets = await retrieveEvidenceDirectExa(question, { numResults, maxCharacters });
  }

  if (!snippets) return null;

  const value = { query: question, snippets };
  setLRUCache(key, { ts: Date.now(), value });
  return value;
}

export default { retrieveEvidence };
