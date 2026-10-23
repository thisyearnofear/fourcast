import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the OpenAI client — llmRouter news it per provider and calls
// client.chat.completions.create(payload). The mock records the model on
// each call and returns scripted results per provider+model.
const calls = [];
const behavior = new Map(); // `${providerBaseURL}|${model}` -> array of results/errors

const BASE_URLS = {
  vercel: 'https://ai-gateway.vercel.sh/v1',
  bai: 'https://api.b.ai/v1',
  venice: 'https://api.venice.ai/api/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

class APIError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'APIError'; }
}

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor(opts) { this.opts = opts; this.chat = { completions: { create: vi.fn(async (payload) => {
      const key = `${opts.baseURL}|${payload.model}`;
      calls.push(key);
      const script = behavior.get(key) || [];
      const next = script.length > 1 ? script.shift() : script[0];
      if (!next) throw new APIError(500, 'unscripted');
      if (next instanceof Error) throw next;
      return { choices: [{ message: { content: next } }] };
    }) } }; }
  },
}));

vi.mock('../services/gatewayRateLimiter.js', () => ({
  withRateLimit: async (fn) => fn(),
}));

import { chatCompletion } from '../services/llmRouter.js';

const KEYS = {
  VERCEL_GATEWAY_API_KEY: 'k', BAI_API_KEY: 'k', VENICE_API_KEY: 'k',
  NVIDIA_API_KEY: 'k', OPENROUTER_API_KEY: 'k',
};

const GOOD = '{"probability":0.5,"reasoning":"x","key_factors":[],"confidence":"LOW"}';

beforeEach(() => {
  calls.length = 0;
  behavior.clear();
  for (const [k, v] of Object.entries(KEYS)) process.env[k] = v;
  delete process.env.NVIDIA_MODEL;
  delete process.env.OPENROUTER_MODEL;
});

afterEach(() => {
  for (const k of Object.keys(KEYS)) delete process.env[k];
});

const ask = (opts = {}) => chatCompletion({ system: 's', user: 'u', temperature: 0.3, maxTokens: 8, ...opts });

describe('chatCompletion model fallback', () => {
  it('410 on first model advances to the provider\'s next model and reports it', async () => {
    // Only openrouter configured; first defaultModel 410s, second answers.
    for (const k of ['VERCEL_GATEWAY_API_KEY', 'BAI_API_KEY', 'VENICE_API_KEY', 'NVIDIA_API_KEY']) delete process.env[k];
    const [m1, m2] = ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'];
    behavior.set(`${BASE_URLS.openrouter}|${m1}`, [new APIError(404, 'Provider returned error')]);
    behavior.set(`${BASE_URLS.openrouter}|${m2}`, [GOOD]);
    const res = await ask();
    expect(res.provider).toBe('openrouter');
    expect(res.model).toBe(m2);
    expect(calls).toEqual([`${BASE_URLS.openrouter}|${m1}`, `${BASE_URLS.openrouter}|${m2}`]);
  });

  it('model env var pins a single model', async () => {
    for (const k of ['VERCEL_GATEWAY_API_KEY', 'BAI_API_KEY', 'VENICE_API_KEY', 'NVIDIA_API_KEY']) delete process.env[k];
    process.env.OPENROUTER_MODEL = 'some/pinned:free';
    behavior.set(`${BASE_URLS.openrouter}|some/pinned:free`, [GOOD]);
    const res = await ask();
    expect(res.model).toBe('some/pinned:free');
    expect(calls).toHaveLength(1);
  });

  it('429 retries the same model before moving on', async () => {
    for (const k of ['VERCEL_GATEWAY_API_KEY', 'BAI_API_KEY', 'VENICE_API_KEY', 'OPENROUTER_API_KEY']) delete process.env[k];
    const model = 'z-ai/glm-5.3'; // nvidia defaultModels[0], attempts=3
    const key = `${BASE_URLS.nvidia}|${model}`;
    behavior.set(key, [new APIError(429, 'slow'), new APIError(429, 'slow'), GOOD]);
    const res = await ask();
    expect(res.provider).toBe('nvidia');
    expect(res.model).toBe(model);
    expect(calls.filter((c) => c === key)).toHaveLength(3);
  }, 60000); // router waits 10s+20s between congestion retries

  it('non-model 401 fails over to the next provider, not the next model', async () => {
    for (const k of ['VERCEL_GATEWAY_API_KEY', 'BAI_API_KEY', 'NVIDIA_API_KEY']) delete process.env[k];
    // venice 401s, openrouter answers on its first model
    behavior.set(`${BASE_URLS.venice}|llama-3.3-70b`, [new APIError(401, 'bad key'), new APIError(401, 'bad key')]);
    behavior.set(`${BASE_URLS.openrouter}|nvidia/nemotron-3-ultra-550b-a55b:free`, [GOOD]);
    const res = await ask({ providerOrder: 'venice,openrouter' });
    expect(res.provider).toBe('openrouter');
    // 401 is fatal on the first attempt (not congestion); openrouter never saw model 2
    expect(calls.filter((c) => c.startsWith(BASE_URLS.venice))).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith(BASE_URLS.openrouter))).toHaveLength(1);
  });
});
