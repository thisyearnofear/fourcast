import { describe, it, expect, vi } from 'vitest';
import { getDefaultAutopilotConfig, runAutopilotOnce } from '../services/scheduler';

vi.mock('../services/aiAgentLoop.js', () => ({
  runAgentLoop: vi.fn(),
}));

import { runAgentLoop } from '../services/aiAgentLoop.js';

function makeAsyncGenerator(updates) {
  return async function* () {
    for (const update of updates) {
      yield update;
    }
  };
}

describe('scheduler', () => {
  describe('getDefaultAutopilotConfig', () => {
    it('returns the expected default config', () => {
      const config = getDefaultAutopilotConfig();
      expect(config).toEqual({
        categories: ['all'],
        maxMarkets: 5,
        minVolume: 10000,
        maxDaysOut: 30,
        riskTolerance: 0.5,
        autopilot: true,
      });
    });
  });

  describe('runAutopilotOnce', () => {
    it('aggregates metrics from the agent loop', async () => {
      const updates = [
        { step: 'discover', status: 'complete', data: { total: 42 } },
        { step: 'filter', status: 'complete', data: { candidates: [{}, {}] } },
        { step: 'forecast', status: 'complete', market: { title: 'M1' } },
        { step: 'forecast', status: 'complete', market: { title: 'M2' } },
        { step: 'forecast', status: 'skipped', market: { title: 'M3' } },
        { step: 'execute', status: 'complete', data: { executed: 1, failed: 0, trades: [{ marketID: 'm1' }] } },
      ];
      runAgentLoop.mockReturnValue(makeAsyncGenerator(updates)());

      const result = await runAutopilotOnce(getDefaultAutopilotConfig());

      expect(result.success).toBe(true);
      expect(result.marketsScanned).toBe(42);
      expect(result.candidatesFiltered).toBe(2);
      expect(result.forecastsMade).toBe(2);
      expect(result.executed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.trades).toHaveLength(1);
    });

    it('returns error summary when the loop throws', async () => {
      runAgentLoop.mockReturnValue((async function* () { // eslint-disable-line require-yield
        throw new Error('loop exploded');
      })());

      const result = await runAutopilotOnce(getDefaultAutopilotConfig());

      expect(result.success).toBe(false);
      expect(result.error).toBe('loop exploded');
    });

    it('starts from zero when no complete steps are yielded', async () => {
      runAgentLoop.mockReturnValue(makeAsyncGenerator([])());

      const result = await runAutopilotOnce(getDefaultAutopilotConfig());

      expect(result.success).toBe(true);
      expect(result.marketsScanned).toBe(0);
      expect(result.candidatesFiltered).toBe(0);
      expect(result.forecastsMade).toBe(0);
      expect(result.executed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.trades).toEqual([]);
    });
  });
});
