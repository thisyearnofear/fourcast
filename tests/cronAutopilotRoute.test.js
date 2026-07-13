import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../app/api/cron/autopilot/route';

vi.mock('../services/db.js', () => ({
  getAutopilotSchedule: vi.fn(),
  recordAutopilotRun: vi.fn(),
}));

vi.mock('../services/scheduler.js', () => ({
  getDefaultAutopilotConfig: vi.fn(() => ({ autopilot: true })),
  runAutopilotOnce: vi.fn(),
}));

import { getAutopilotSchedule, recordAutopilotRun } from '../services/db.js';
import { runAutopilotOnce } from '../services/scheduler.js';

function mockRequest({ headers = {} } = {}) {
  return {
    headers: new Map(Object.entries(headers)),
  };
}

describe('/api/cron/autopilot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-token';
    delete process.env.POLYMARKET_PRIVATE_KEY;
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;

    const req = mockRequest({ headers: { authorization: 'Bearer cron-token' } });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('returns 401 when authorization header is invalid', async () => {
    const req = mockRequest({ headers: { authorization: 'Bearer wrong-token' } });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('skips when autopilot is disabled', async () => {
    getAutopilotSchedule.mockResolvedValue({
      success: true,
      schedule: { enabled: false, intervalMinutes: 60, updatedAt: 1 },
    });

    const req = mockRequest({ headers: { authorization: 'Bearer cron-token' } });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('disabled');
    expect(runAutopilotOnce).not.toHaveBeenCalled();
  });

  it('skips when interval has not elapsed', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const lastRunAt = nowSec - 30 * 60;
    getAutopilotSchedule.mockResolvedValue({
      success: true,
      schedule: {
        enabled: true,
        intervalMinutes: 60,
        lastRunAt,
        dryRun: true,
        dailyCapPct: 0.5,
        updatedAt: 1,
      },
    });
    process.env.POLYMARKET_PRIVATE_KEY = '0xabc';

    const req = mockRequest({ headers: { authorization: 'Bearer cron-token' } });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('too soon');
    expect(json.nextRunAt).toBe(lastRunAt + 3600);
    expect(json.intervalMinutes).toBe(60);
    expect(runAutopilotOnce).not.toHaveBeenCalled();
    expect(recordAutopilotRun).not.toHaveBeenCalled();
  });

  it('skips when POLYMARKET_PRIVATE_KEY is missing', async () => {
    getAutopilotSchedule.mockResolvedValue({
      success: true,
      schedule: { enabled: true, intervalMinutes: 60, updatedAt: 1 },
    });

    const req = mockRequest({ headers: { authorization: 'Bearer cron-token' } });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('missing private key');
    expect(runAutopilotOnce).not.toHaveBeenCalled();
  });

  it('runs autopilot and returns metrics when enabled and key is present', async () => {
    process.env.POLYMARKET_PRIVATE_KEY = '0xabc';
    getAutopilotSchedule.mockResolvedValue({
      success: true,
      schedule: { enabled: true, intervalMinutes: 60, updatedAt: 1 },
    });
    runAutopilotOnce.mockResolvedValue({
      success: true,
      executed: 2,
      failed: 1,
      marketsScanned: 10,
      candidatesFiltered: 4,
      forecastsMade: 3,
    });

    const req = mockRequest({ headers: { authorization: 'Bearer cron-token' } });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.executed).toBe(2);
    expect(json.failed).toBe(1);
    expect(json.marketsScanned).toBe(10);
    expect(json.candidatesFiltered).toBe(4);
    expect(json.forecastsMade).toBe(3);
    expect(runAutopilotOnce).toHaveBeenCalled();
    expect(recordAutopilotRun).toHaveBeenCalled();
  });

  it('records run before invoking runAutopilotOnce', async () => {
    process.env.POLYMARKET_PRIVATE_KEY = '0xabc';
    getAutopilotSchedule.mockResolvedValue({
      success: true,
      schedule: { enabled: true, intervalMinutes: 60, updatedAt: 1 },
    });
    runAutopilotOnce.mockImplementation(async () => ({
      success: true,
      executed: 0,
      failed: 0,
      marketsScanned: 1,
      candidatesFiltered: 0,
      forecastsMade: 0,
    }));

    const req = mockRequest({ headers: { authorization: 'Bearer cron-token' } });
    await GET(req);

    expect(recordAutopilotRun).toHaveBeenCalled();
    expect(runAutopilotOnce).toHaveBeenCalled();
    expect(recordAutopilotRun.mock.invocationCallOrder[0]).toBeLessThan(
      runAutopilotOnce.mock.invocationCallOrder[0]
    );
  });

  it('returns 500 when runAutopilotOnce reports failure', async () => {
    process.env.POLYMARKET_PRIVATE_KEY = '0xabc';
    getAutopilotSchedule.mockResolvedValue({
      success: true,
      schedule: { enabled: true, intervalMinutes: 60, updatedAt: 1 },
    });
    runAutopilotOnce.mockResolvedValue({
      success: false,
      error: 'market service unavailable',
    });

    const req = mockRequest({ headers: { authorization: 'Bearer cron-token' } });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('market service unavailable');
  });
});
