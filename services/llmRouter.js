/**
 * LLM Router — chat completions across multiple OpenAI-compatible providers
 * with ordered failover. Built for the Delphi agent's forecaster; generic
 * enough for other services to adopt later.
 *
 * Chain order (default "openrouter,nvidia,venice") via DELPHI_AGENT_LLM_PROVIDERS.
 * Only providers whose API key is configured are attempted; auth failures
 * (401/402/403), rate limits (429), timeouts and 5xx all roll over to the
 * next provider. Returns null when no provider answers.
 *
 * Why this order (overridable):
 * - openrouter: one key → many models incl. free ":free" variants for
 *   zero-cost testing, cheap paid llama-3.3-70b, optional ":online" web
 *   models for news-driven markets later.
 * - nvidia: free tier (build.nvidia.com), quality instruct models, decent
 *   rate limits.
 * - venice: privacy-focused, existing integration — final fallback.
 */

if (typeof window !== 'undefined') {
  throw new Error('llmRouter is server-only');
}

import OpenAI from 'openai';
import { withRateLimit } from './gatewayRateLimiter.js';

// ─── Provider Registry ──────────────────────────────────────────────────────

const PROVIDERS = {
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    timeout: 60_000,
    attempts: (model) => (model.endsWith(':free') ? 1 : 2), // :free 429s are persistent — don't burn 30s/market retrying
    defaultHeaders: {
      'X-Title': 'Fourcast Delphi Agent',
    },
  },
  nvidia: {
    baseURL: 'https://integrate.api.nvidia.com/v1',
    keyEnv: 'NVIDIA_API_KEY',
    modelEnv: 'NVIDIA_MODEL',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    timeout: 120_000, // free tier is slow on long prompts (>30s observed)
    attempts: 3, // 503s intersperse with wins — worth retrying
  },
  venice: {
    baseURL: 'https://api.venice.ai/api/v1',
    keyEnv: 'VENICE_API_KEY',
    modelEnv: 'DELPHI_AGENT_VENICE_MODEL', // legacy name, keep working
    defaultModel: 'llama-3.3-70b',
    attempts: 2,
  },
  vercel: {
    // Vercel AI Gateway (OpenAI-compatible). Free tier: zai/glm-4.7-flash
    // accessible but burst-rate-limited (429 recovers in minutes).
    // Exa web search is free through Aug 31 via gateway.tools.exaSearch()
    // (handled in evidenceRetriever.js, not here).
    // Rate limiter (gatewayRateLimiter.js) serializes calls to stay within
    // free-tier limits.
    baseURL: 'https://ai-gateway.vercel.sh/v1',
    keyEnv: 'VERCEL_GATEWAY_API_KEY',
    modelEnv: 'VERCEL_GATEWAY_MODEL',
    defaultModel: 'zai/glm-4.7-flash',
    timeout: 90_000,
    attempts: 3,
  },
};

const DEFAULT_ORDER = 'vercel,venice,nvidia,openrouter';

// ─── Client Cache ───────────────────────────────────────────────────────────

const clients = new Map();

function getClient(name) {
  if (clients.has(name)) return clients.get(name);
  const cfg = PROVIDERS[name];
  if (!cfg) return null;
  const apiKey = process.env[cfg.keyEnv];
  if (!apiKey) return null;
  const client = new OpenAI({
    apiKey,
    baseURL: cfg.baseURL,
    defaultHeaders: cfg.defaultHeaders,
    timeout: cfg.timeout || 60_000,
    maxRetries: 0, // failover, not retry — a different provider is a better retry
  });
  clients.set(name, client);
  return client;
}

/** Names of providers that currently have an API key configured, in chain order. */
export function listConfiguredProviders(providerOrder) {
  return parseOrder(providerOrder).filter((name) => getClient(name) != null);
}

function parseOrder(providerOrder) {
  return (providerOrder || process.env.DELPHI_AGENT_LLM_PROVIDERS || DEFAULT_ORDER)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// ─── Chat Completion With Failover ─────────────────────────────────────────

/**
 * @param {{ system: string, user: string, temperature?: number, maxTokens?: number,
 *           model?: string, providerOrder?: string, webSearch?: boolean }} params
 *          webSearch: openrouter uses the web plugin, venice uses
 *          venice_parameters.enable_web_search; unsupported elsewhere.
 * @returns {Promise<{ content: string, provider: string, model: string,
 *           webSearchUsed: boolean } | null>}
 */
export async function chatCompletion({
  system,
  user,
  temperature = 0.3,
  maxTokens = 500,
  model: modelOverride,
  providerOrder,
  webSearch = false,
}) {
  const order = parseOrder(providerOrder);
  const failures = [];

  for (const name of order) {
    const cfg = PROVIDERS[name];
    if (!cfg) {
      failures.push(`${name}: unknown provider`);
      continue;
    }
    const client = getClient(name);
    if (!client) continue; // no key configured — skip quietly

    const model = modelOverride || process.env[cfg.modelEnv] || cfg.defaultModel;

    const webSupported = name === 'openrouter' || name === 'venice';
    // Congestion retries are per-provider (persistent :free 429s get no
    // retries; nvidia 503s get a few — they intersperse with wins).
    const maxAttempts = typeof cfg.attempts === 'function' ? cfg.attempts(model) : (cfg.attempts ?? 2);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const payload = {
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature,
          max_tokens: maxTokens,
        };
        if (webSearch && name === 'openrouter') payload.plugins = [{ id: 'web', max_results: 5 }];
        if (webSearch && name === 'venice') payload.venice_parameters = { enable_web_search: 'auto' };

        let res;
        try {
          // Vercel free tier is burst-limited (~1 req / 5 min per model) —
          // serialize all gateway calls through the shared rate limiter.
          if (name === 'vercel') {
            res = await withRateLimit(() => client.chat.completions.create(payload));
          } else {
            res = await client.chat.completions.create(payload);
          }
        } catch (err) {
          // Web search is an enhancement, not a requirement: if it fails
          // (unsupported, unpayable) retry once without it before failing over.
          if (webSearch && webSupported && (err.status === 400 || err.status === 402)) {
            console.warn(`[llmRouter] ${name}/${model} web search failed (${err.status}) — retrying without web`);
            const fallbackPayload = { ...payload };
            delete fallbackPayload.plugins;
            delete fallbackPayload.venice_parameters;
            res = name === 'vercel'
              ? await withRateLimit(() => client.chat.completions.create(fallbackPayload))
              : await client.chat.completions.create(fallbackPayload);
            payload.__webDropped = true;
          } else {
            throw err;
          }
        }
        const content = res.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('empty completion');
        if (failures.length) {
          console.log(`[llmRouter] fell back to ${name}/${model} after: ${failures.join(' | ')}`);
        }
        return { content, provider: name, model, webSearchUsed: webSearch && webSupported && !payload.__webDropped };
      } catch (err) {
        const status = err.status || err.code || 'ERR';
        if ((status === 429 || status === 503) && attempt < maxAttempts) {
          const retryAfterMs = Number(err.headers?.get?.('retry-after')) * 1000;
          const waitMs = Math.max(10_000 * attempt, Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
          console.warn(`[llmRouter] ${name}/${model} congestion (${status}) — retry ${attempt}/${maxAttempts - 1} in ${Math.round(waitMs / 1000)}s`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        const detail = `${err.name || 'Error'}: ${String(err.message || err).slice(0, 140)}`;
        failures.push(`${name}: ${status} (${err.name})`);
        console.warn(`[llmRouter] ${name}/${model} failed (${status}: ${detail}) — trying next provider`);
      }
    }
  }

  const anyConfigured = order.some((name) => PROVIDERS[name] && process.env[PROVIDERS[name].keyEnv]);
  if (!anyConfigured) {
    console.warn(`[llmRouter] no LLM provider keys configured (tried: ${order.join(', ')}) — set VERCEL_GATEWAY_API_KEY / VENICE_API_KEY / NVIDIA_API_KEY / OPENROUTER_API_KEY`);
  } else if (failures.length) {
    console.warn(`[llmRouter] all providers failed: ${failures.join(' | ')}`);
  }
  return null;
}

export default { chatCompletion, listConfiguredProviders };
