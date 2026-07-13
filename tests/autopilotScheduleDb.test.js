import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getAutopilotSchedule,
  setAutopilotSchedule,
  updateForecastExecution,
  query,
  execute,
  db,
  migrationsReady,
} from '../services/db';

describe('Autopilot schedule DB helpers', () => {
  beforeAll(async () => {
    await migrationsReady;
  });

  afterAll(() => {
    try { db.close(); } catch (_) { /* ignore */ }
  });

  it('returns a default schedule when none has been set', async () => {
    const result = await getAutopilotSchedule();
    expect(result.success).toBe(true);
    expect(result.schedule).toMatchObject({
      enabled: expect.any(Boolean),
      intervalMinutes: expect.any(Number),
      updatedAt: expect.any(Number),
    });
  });

  it('persists and returns enabled schedule with a 15-minute interval', async () => {
    const setResult = await setAutopilotSchedule(true, 15);
    expect(setResult.success).toBe(true);
    expect(setResult.schedule.enabled).toBe(true);
    expect(setResult.schedule.intervalMinutes).toBe(15);
    expect(setResult.schedule.updatedAt).toBeGreaterThan(0);

    const getResult = await getAutopilotSchedule();
    expect(getResult.success).toBe(true);
    expect(getResult.schedule.enabled).toBe(true);
    expect(getResult.schedule.intervalMinutes).toBe(15);
  });

  it('persists and returns disabled schedule with a 120-minute interval', async () => {
    const setResult = await setAutopilotSchedule(false, 120);
    expect(setResult.success).toBe(true);
    expect(setResult.schedule.enabled).toBe(false);
    expect(setResult.schedule.intervalMinutes).toBe(120);

    const getResult = await getAutopilotSchedule();
    expect(getResult.success).toBe(true);
    expect(getResult.schedule.enabled).toBe(false);
    expect(getResult.schedule.intervalMinutes).toBe(120);
  });

  it('coerces non-boolean enabled values to booleans', async () => {
    await setAutopilotSchedule(1, 60);
    const result = await getAutopilotSchedule();
    expect(result.schedule.enabled).toBe(true);
  });

  describe('updateForecastExecution statuses', () => {
    async function insertForecast(id) {
      await execute(
        `INSERT INTO agent_forecasts (
          id, market_id, market_title, platform, ai_probability, market_odds,
          edge, confidence, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, 'm-' + id, 'Title ' + id, 'POLY', 0.6, 0.5, 0.1, 'MEDIUM', Math.floor(Date.now() / 1000)]
      );
    }

    async function getForecast(id) {
      const rows = await query('SELECT * FROM agent_forecasts WHERE id = ?', [id]);
      return rows[0];
    }

    it('tags dry-run executions as DRY_RUN', async () => {
      const id = `dry-run-forecast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await insertForecast(id);

      const result = await updateForecastExecution(id, {
        success: true,
        dryRun: true,
        sizePct: 0.1,
        kellyPct: 0.05,
        direction: 'BUY YES',
      });

      expect(result.success).toBe(true);
      const row = await getForecast(id);
      expect(row.execution_status).toBe('DRY_RUN');
      expect(row.autopilot_executed).toBe(1);
      expect(row.size_pct).toBe(0.1);
      expect(row.kelly_pct).toBe(0.05);
      expect(row.direction).toBe('BUY YES');
    });

    it('tags non-dry-run successes as SUCCESS', async () => {
      const id = `success-forecast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await insertForecast(id);

      const result = await updateForecastExecution(id, { success: true });
      expect(result.success).toBe(true);
      const row = await getForecast(id);
      expect(row.execution_status).toBe('SUCCESS');
      expect(row.autopilot_executed).toBe(1);
    });

    it('tags failures as FAILED', async () => {
      const id = `failed-forecast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await insertForecast(id);

      const result = await updateForecastExecution(id, { success: false, error: 'market unavailable' });
      expect(result.success).toBe(true);
      const row = await getForecast(id);
      expect(row.execution_status).toBe('FAILED');
      expect(row.execution_response).toBe('market unavailable');
      expect(row.autopilot_executed).toBe(1);
    });
  });
});
