import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../app/api/agent/schedule/route';

vi.mock('../services/db.js', () => ({
  getAutopilotSchedule: vi.fn(),
  setAutopilotSchedule: vi.fn(),
}));

import { getAutopilotSchedule, setAutopilotSchedule } from '../services/db.js';

function mockRequest({ body, headers = {} } = {}) {
  return {
    json: async () => body,
    headers: new Map(Object.entries(headers)),
  };
}

describe('/api/agent/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_SECRET;
    process.env.NODE_ENV = 'development';
  });

  describe('GET', () => {
    it('returns the current schedule', async () => {
      getAutopilotSchedule.mockResolvedValue({
        success: true,
        schedule: { enabled: false, intervalMinutes: 60, updatedAt: 123 },
      });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.schedule).toEqual({ enabled: false, intervalMinutes: 60, updatedAt: 123 });
    });

    it('returns 500 when the DB read fails', async () => {
      getAutopilotSchedule.mockResolvedValue({
        success: false,
        error: 'db down',
      });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST', () => {
    it('rejects invalid interval values', async () => {
      const req = mockRequest({ body: { enabled: true, intervalMinutes: 45 } });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects missing boolean enabled', async () => {
      const req = mockRequest({ body: { intervalMinutes: 60 } });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('allows writes in development when ADMIN_SECRET is unset', async () => {
      process.env.NODE_ENV = 'development';

      setAutopilotSchedule.mockResolvedValue({
        success: true,
        schedule: { enabled: true, intervalMinutes: 15, updatedAt: 456 },
      });

      const req = mockRequest({ body: { enabled: true, intervalMinutes: 15 } });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.schedule.intervalMinutes).toBe(15);
    });

    it('rejects writes in production when ADMIN_SECRET is unset', async () => {
      process.env.NODE_ENV = 'production';

      const req = mockRequest({ body: { enabled: true, intervalMinutes: 15 } });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('allows writes when x-admin-secret matches ADMIN_SECRET', async () => {
      process.env.ADMIN_SECRET = 'super-secret';

      setAutopilotSchedule.mockResolvedValue({
        success: true,
        schedule: { enabled: false, intervalMinutes: 120, updatedAt: 789 },
      });

      const req = mockRequest({
        body: { enabled: false, intervalMinutes: 120 },
        headers: { 'x-admin-secret': 'super-secret' },
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.schedule.enabled).toBe(false);
    });

    it('rejects writes when x-admin-secret does not match ADMIN_SECRET', async () => {
      process.env.ADMIN_SECRET = 'super-secret';

      const req = mockRequest({
        body: { enabled: true, intervalMinutes: 60 },
        headers: { 'x-admin-secret': 'wrong-secret' },
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });
  });
});
