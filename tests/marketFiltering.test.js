import { describe, it, expect, vi } from 'vitest';

/**
 * Logic extracted from app/api/markets/route.js for testing
 */
function calculateDaysToResolution(resolutionDate, now) {
  if (!resolutionDate) return null;
  const resDate = new Date(resolutionDate);
  if (isNaN(resDate.getTime())) return null;
  
  // (resDate.getTime() - now) / (1000 * 60 * 60 * 24)
  return (resDate.getTime() - now) / (1000 * 60 * 60 * 24);
}

function shouldKeepMarket(daysToResolution) {
  if (daysToResolution !== null) {
    return daysToResolution > 0;
  }
  return true;
}

describe('Market Filtering Timezone & Date Safety', () => {
  // Use a fixed "now" to avoid flaky tests
  const now = new Date('2026-03-16T12:00:00Z').getTime();

  it('should keep a market resolving in the future', () => {
    const resDate = '2026-03-17T12:00:00Z';
    const days = calculateDaysToResolution(resDate, now);
    expect(days).toBe(1);
    expect(shouldKeepMarket(days)).toBe(true);
  });

  it('should filter out a market that resolved yesterday', () => {
    const resDate = '2026-03-15T12:00:00Z';
    const days = calculateDaysToResolution(resDate, now);
    expect(days).toBe(-1);
    expect(shouldKeepMarket(days)).toBe(false);
  });

  it('should keep a market resolving later today', () => {
    const resDate = '2026-03-16T20:00:00Z';
    const days = calculateDaysToResolution(resDate, now);
    expect(days).toBeGreaterThan(0);
    expect(shouldKeepMarket(days)).toBe(true);
  });

  it('should filter out a market that resolved 1 hour ago', () => {
    const resDate = '2026-03-16T11:00:00Z';
    const days = calculateDaysToResolution(resDate, now);
    expect(days).toBeLessThan(0);
    expect(shouldKeepMarket(days)).toBe(false);
  });

  it('should handle null resolution dates by keeping them (better to show than hide if unknown)', () => {
    const days = calculateDaysToResolution(null, now);
    expect(days).toBe(null);
    expect(shouldKeepMarket(days)).toBe(true);
  });

  it('should handle invalid date formats by keeping them', () => {
    const days = calculateDaysToResolution('invalid-date', now);
    expect(days).toBe(null);
    expect(shouldKeepMarket(days)).toBe(true);
  });

  it('should be safe for markets expiring at the very end of the current minute', () => {
    const nearFuture = now + 1000; // 1 second in future
    const resDate = new Date(nearFuture).toISOString();
    const days = calculateDaysToResolution(resDate, now);
    expect(days).toBeGreaterThan(0);
    expect(shouldKeepMarket(days)).toBe(true);
  });
});
