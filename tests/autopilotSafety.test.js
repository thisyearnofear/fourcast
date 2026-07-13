import { describe, it, expect } from 'vitest';
import {
  getExecutionStatus,
  buildTradedTodaySet,
  computeSpentToday,
  shouldSkipDedup,
  shouldSkipCap,
  formatDryRunMessage,
} from '../services/autopilotSafety.js';

describe('autopilotSafety', () => {
  describe('getExecutionStatus', () => {
    it('returns DRY_RUN when dryRun is true', () => {
      expect(getExecutionStatus({ success: true, dryRun: true })).toBe('DRY_RUN');
      expect(getExecutionStatus({ success: false, dryRun: true })).toBe('DRY_RUN');
    });

    it('returns SUCCESS when successful and not dry-run', () => {
      expect(getExecutionStatus({ success: true })).toBe('SUCCESS');
      expect(getExecutionStatus({ success: true, dryRun: false })).toBe('SUCCESS');
    });

    it('returns FAILED when success is false or undefined', () => {
      expect(getExecutionStatus({ success: false, error: 'x' })).toBe('FAILED');
      expect(getExecutionStatus({})).toBe('FAILED');
      expect(getExecutionStatus(undefined)).toBe('FAILED');
    });
  });

  describe('buildTradedTodaySet', () => {
    it('contains only SUCCESS market ids, ignoring DRY_RUN and FAILED', () => {
      const executions = [
        { market_id: 'm1', execution_status: 'SUCCESS' },
        { market_id: 'm2', execution_status: 'DRY_RUN' },
        { market_id: 'm3', execution_status: 'FAILED' },
        { market_id: 'm4', execution_status: 'SUCCESS' },
      ];
      const set = buildTradedTodaySet(executions);
      expect(set.has('m1')).toBe(true);
      expect(set.has('m4')).toBe(true);
      expect(set.has('m2')).toBe(false);
      expect(set.has('m3')).toBe(false);
      expect(set.size).toBe(2);
    });

    it('returns an empty set for empty input', () => {
      expect(buildTradedTodaySet([]).size).toBe(0);
    });
  });

  describe('computeSpentToday', () => {
    it('sums size_pct from SUCCESS rows only', () => {
      const executions = [
        { market_id: 'm1', execution_status: 'SUCCESS', size_pct: 0.1 },
        { market_id: 'm2', execution_status: 'DRY_RUN', size_pct: 0.2 },
        { market_id: 'm3', execution_status: 'FAILED', size_pct: 0.3 },
        { market_id: 'm4', execution_status: 'SUCCESS', size_pct: 0.15 },
      ];
      expect(computeSpentToday(executions)).toBeCloseTo(0.25);
    });

    it('treats null or missing size_pct as 0', () => {
      const executions = [
        { market_id: 'm1', execution_status: 'SUCCESS' },
        { market_id: 'm2', execution_status: 'SUCCESS', size_pct: null },
      ];
      expect(computeSpentToday(executions)).toBe(0);
    });
  });

  describe('shouldSkipDedup', () => {
    it('returns true when the market id is already traded', () => {
      const set = new Set(['m1']);
      expect(shouldSkipDedup({ marketID: 'm1' }, set)).toBe(true);
    });

    it('returns false when the market id has not been traded', () => {
      const set = new Set(['m1']);
      expect(shouldSkipDedup({ marketID: 'm2' }, set)).toBe(false);
    });
  });

  describe('shouldSkipCap', () => {
    it('returns true when adding the record exceeds the cap', () => {
      expect(shouldSkipCap({ sizePct: 0.3 }, 0.25, 0.5)).toBe(true);
    });

    it('returns false when exactly at the cap', () => {
      expect(shouldSkipCap({ sizePct: 0.25 }, 0.25, 0.5)).toBe(false);
    });

    it('returns false when under the cap', () => {
      expect(shouldSkipCap({ sizePct: 0.1 }, 0.25, 0.5)).toBe(false);
    });
  });

  describe('formatDryRunMessage', () => {
    it('includes direction and formatted percentage', () => {
      const rec = { direction: 'BUY YES', sizePct: 0.125 };
      expect(formatDryRunMessage(rec)).toBe('DRY RUN: would execute BUY YES 12.5%');
    });

    it('rounds to one decimal place', () => {
      const rec = { direction: 'SELL', sizePct: 0.12345 };
      expect(formatDryRunMessage(rec)).toBe('DRY RUN: would execute SELL 12.3%');
    });
  });
});
