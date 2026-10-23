import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/llmRouter.js', () => ({
  chatCompletion: vi.fn(),
  listConfiguredProviders: vi.fn(() => []),
}));

vi.mock('../services/polymarketService.js', () => ({
  polymarketService: {
    getTopWeatherSensitiveMarkets: vi.fn(),
  },
}));

vi.mock('../services/kalshiService.js', () => ({
  kalshiService: {
    getMarketsByCategory: vi.fn(async () => []),
  },
}));

vi.mock('../services/redisService.js', () => ({
  getRedisClient: vi.fn(async () => null),
}));

import { chatCompletion } from '../services/llmRouter.js';
import { polymarketService } from '../services/polymarketService.js';
import { runAgentLoop } from '../services/aiAgentLoop.js';
import { execute, query, migrationsReady, saveForecast } from '../services/db.js';

const MARKET = {
  marketID: 'pm-loop-test',
  title: 'Will it rain in NYC tomorrow?',
  platform: 'polymarket',
  description: 'test market',
  currentOdds: { yes: 0.4, no: 0.6 },
  volume24h: 50000,
  liquidity: 1000,
  resolutionDate: new Date(Date.now() + 3 * 864e5).toISOString(),
  eventType: 'Weather',
  tags: [],
};

async function drain(gen) {
  const events = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

beforeEach(async () => {
  await migrationsReady;
  await execute(`DELETE FROM agent_forecasts`);
  vi.clearAllMocks();
  polymarketService.getTopWeatherSensitiveMarkets.mockResolvedValue({ markets: [MARKET] });
});

describe('runAgentLoop via llmRouter', () => {
  it('records nothing when no provider answers', async () => {
    chatCompletion.mockResolvedValue(null);
    const events = await drain(runAgentLoop({ categories: ['all'], maxMarkets: 1, minVolume: 1000, maxDaysOut: 30 }));
    expect(events.some((e) => e.step === 'forecast' && e.status === 'complete')).toBe(true);
    const rows = await query(`SELECT * FROM agent_forecasts`);
    expect(rows).toHaveLength(0);
  });

  it('saves a forecast and records the answering provider in source', async () => {
    chatCompletion.mockResolvedValue({
      content: '{"probability":0.65,"reasoning":"test","key_factors":["a"],"confidence":"MEDIUM"}',
      provider: 'nvidia',
      model: 'meta/llama-3.3-70b-instruct',
      webSearchUsed: false,
    });
    const events = await drain(runAgentLoop({ categories: ['all'], maxMarkets: 1, minVolume: 1000, maxDaysOut: 30 }));
    const rows = await query(`SELECT market_id, ai_probability FROM agent_forecasts`);
    expect(rows).toHaveLength(1);
    expect(rows[0].market_id).toBe('pm-loop-test');
    expect(rows[0].ai_probability).toBeCloseTo(0.65);
    const done = events.find((e) => e.step === 'forecast' && e.status === 'complete');
    expect(done.market.source).toContain('nvidia');
  });
});

describe('saveForecast probability guard', () => {
  const base = { id: 'g1', marketID: 'm', title: 't', platform: 'polymarket', marketOdds: 0.5, edge: 0, confidence: 'LOW' };

  it('rejects null, NaN, and out-of-range probabilities without inserting', async () => {
    for (const [i, bad] of [null, NaN, 1.5, -0.1].entries()) {
      const res = await saveForecast({ ...base, id: `bad-${i}`, aiProbability: bad });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/aiProbability/);
    }
    expect((await query(`SELECT * FROM agent_forecasts WHERE id LIKE 'bad-%'`)).length).toBe(0);
  });

  it('accepts boundary probabilities 0 and 1', async () => {
    expect((await saveForecast({ ...base, id: 'ok-0', aiProbability: 0 })).success).toBe(true);
    expect((await saveForecast({ ...base, id: 'ok-1', aiProbability: 1 })).success).toBe(true);
  });
});
