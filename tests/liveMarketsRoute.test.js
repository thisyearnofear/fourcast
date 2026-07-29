import { describe, expect, it } from 'vitest';
import { isLiveMarket } from '@/app/api/markets/live/route.js';

describe('live markets feed', () => {
  const now = new Date('2026-07-29T12:00:00Z').getTime();

  it('rejects markets whose resolution date has passed', () => {
    expect(isLiveMarket({ resolutionDate: '2025-12-31T23:59:59Z' }, now)).toBe(false);
    expect(isLiveMarket({ resolutionDate: '2026-01-31T23:59:59Z' }, now)).toBe(false);
    expect(isLiveMarket({ resolutionDate: '2026-06-30T23:59:59Z' }, now)).toBe(false);
  });

  it('rejects markets without a trustworthy resolution date', () => {
    expect(isLiveMarket({}, now)).toBe(false);
    expect(isLiveMarket({ resolutionDate: 'not-a-date' }, now)).toBe(false);
  });

  it('rejects markets whose upstream status is not tradable', () => {
    const futureMarket = { resolutionDate: '2026-08-31T23:59:59Z' };

    expect(isLiveMarket({ ...futureMarket, rawMarket: { closed: true } }, now)).toBe(false);
    expect(isLiveMarket({ ...futureMarket, rawMarket: { active: false } }, now)).toBe(false);
    expect(isLiveMarket({ ...futureMarket, rawMarket: { acceptingOrders: false } }, now)).toBe(false);
  });

  it('keeps a future market with an open upstream status', () => {
    expect(isLiveMarket({
      resolutionDate: '2026-08-31T23:59:59Z',
      rawMarket: { closed: false, active: true, acceptingOrders: true },
    }, now)).toBe(true);
  });
});
