import { describe, it, expect } from 'vitest';
import {
  confidenceLabel,
  confidenceTint,
  directionFor,
  signalFor,
  countEdges,
  EDGE_THRESHOLD_HIGH,
  EDGE_THRESHOLD_MED,
} from '@/utils/marketEdge';

describe('marketEdge', () => {
  describe('confidenceLabel', () => {
    it('returns HIGH for |edge| >= 0.15', () => {
      expect(confidenceLabel(0.16)).toBe('HIGH');
      expect(confidenceLabel(-0.15)).toBe('HIGH');
      expect(confidenceLabel(0.99)).toBe('HIGH');
    });

    it('returns MED for 0.08 <= |edge| < 0.15', () => {
      expect(confidenceLabel(0.08)).toBe('MED');
      expect(confidenceLabel(-0.12)).toBe('MED');
      expect(confidenceLabel(0.14)).toBe('MED');
    });

    it('returns LOW for |edge| < 0.08', () => {
      expect(confidenceLabel(0.07)).toBe('LOW');
      expect(confidenceLabel(-0.04)).toBe('LOW');
      expect(confidenceLabel(0)).toBe('LOW');
    });

    it('returns "—" for null/undefined/NaN', () => {
      expect(confidenceLabel(null)).toBe('—');
      expect(confidenceLabel(undefined)).toBe('—');
      expect(confidenceLabel(NaN)).toBe('—');
    });
  });

  describe('confidenceTint', () => {
    it('returns the matching fc-status class', () => {
      expect(confidenceTint(0.16)).toBe('fc-status--positive');
      expect(confidenceTint(0.08)).toBe('fc-status--sealed');
      expect(confidenceTint(0.02)).toBe('fc-status--review');
    });
  });

  describe('directionFor', () => {
    it('returns BUY YES for edge >= 0', () => {
      expect(directionFor(0.16)).toBe('BUY YES');
      expect(directionFor(0)).toBe('BUY YES');
    });

    it('returns BUY NO for edge < 0', () => {
      expect(directionFor(-0.16)).toBe('BUY NO');
    });

    it('returns "—" for null/undefined/NaN', () => {
      expect(directionFor(null)).toBe('—');
      expect(directionFor(undefined)).toBe('—');
      expect(directionFor(NaN)).toBe('—');
    });
  });

  describe('signalFor', () => {
    it('derives a signal string from a real market edge', () => {
      const m = { title: 'Will Bitcoin exceed $150K?', platform: 'polymarket', edgeScore: 0.16 };
      const sig = signalFor(m);
      expect(sig).toContain('EDGE');
      expect(sig).toContain('POLYMARKET');
      expect(sig).toContain('+16.0%');
    });

    it('returns null when |edge| < 0.05', () => {
      expect(signalFor({ title: 'x', edgeScore: 0.04 })).toBeNull();
      expect(signalFor({ title: 'x', edgeScore: -0.02 })).toBeNull();
    });

    it('returns null for missing edge', () => {
      expect(signalFor({ title: 'x' })).toBeNull();
      expect(signalFor({ title: 'x', edgeScore: null })).toBeNull();
    });
  });

  describe('countEdges', () => {
    it('counts markets with |edgeScore| >= 0.05', () => {
      const markets = [
        { edgeScore: 0.16 },
        { edgeScore: 0.03 },
        { edgeScore: -0.08 },
        { edgeScore: undefined },
      ];
      expect(countEdges(markets)).toBe(2);
    });

    it('returns 0 for empty array', () => {
      expect(countEdges([])).toBe(0);
    });
  });

  describe('threshold constants', () => {
    it('exposes the canonical thresholds', () => {
      expect(EDGE_THRESHOLD_HIGH).toBe(0.15);
      expect(EDGE_THRESHOLD_MED).toBe(0.08);
    });
  });
});
