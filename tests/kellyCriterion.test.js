/**
 * Unit tests for calculateKellySizing
 * Tests the fractional Kelly Criterion position sizing math
 */
import { describe, it, expect } from 'vitest';
import { calculateKellySizing } from '../utils/kellySizing.js';

describe('calculateKellySizing', () => {
  // ── Edge cases: null/invalid inputs ──

  it('returns NO TRADE for null aiProb', () => {
    const result = calculateKellySizing(null, 0.5);
    expect(result).toMatchObject({ sizePct: 0, direction: 'NO TRADE', actionable: false });
  });

  it('returns NO TRADE for null marketYesOdds', () => {
    const result = calculateKellySizing(0.6, null);
    expect(result).toMatchObject({ sizePct: 0, direction: 'NO TRADE', actionable: false });
  });

  it('returns NO TRADE for marketYesOdds <= 0', () => {
    const result = calculateKellySizing(0.6, 0);
    expect(result).toMatchObject({ sizePct: 0, direction: 'NO TRADE', actionable: false });
  });

  it('returns NO TRADE for marketYesOdds >= 1', () => {
    const result = calculateKellySizing(0.6, 1);
    expect(result).toMatchObject({ sizePct: 0, direction: 'NO TRADE', actionable: false });
  });

  // ── Actionability: edge threshold (5%) ──

  it('returns NO TRADE when edge <= 5%', () => {
    const result = calculateKellySizing(0.52, 0.50);
    expect(result).toMatchObject({ actionable: false, direction: 'NO TRADE' });
    expect(result.edge).toBeCloseTo(0.02);
  });

  it('returns actionable=true when edge > 5%', () => {
    const result = calculateKellySizing(0.60, 0.50);
    expect(result.actionable).toBe(true);
    expect(result.direction).toBe('BUY YES');
    expect(result.edge).toBeCloseTo(0.1);
  });

  // ── Direction detection ──

  it('detects BUY YES when aiProb > marketOdds', () => {
    const result = calculateKellySizing(0.65, 0.50);
    expect(result.direction).toBe('BUY YES');
  });

  it('detects BUY NO when aiProb < marketOdds', () => {
    const result = calculateKellySizing(0.35, 0.50);
    expect(result.direction).toBe('BUY NO');
  });

  // ── Kelly sizing math ──

  it('computes positive kellyPct for BUY YES with edge', () => {
    // aiProb=0.65, marketYesOdds=0.50, direction=BUY YES
    // p = 0.65, odds = 0.50, b = 0.5/0.5 = 1
    // kelly = (0.65*1 - 0.35) / 1 = 0.30
    const result = calculateKellySizing(0.65, 0.50, 0.5, 'HIGH');
    expect(result.kellyPct).toBeCloseTo(0.3, 2);
    // With riskTolerance=0.5, confidenceMultiplier=1.0 (HIGH)
    // fractionalKelly = 0.3 * (0.5 * 0.25) * 1.0 = 0.3 * 0.125 = 0.0375
    expect(result.sizePct).toBeCloseTo(0.04, 2); // rounded
    expect(result.actionable).toBe(true);
  });

  it('computes kellyPct for BUY NO direction', () => {
    // aiProb=0.30, marketYesOdds=0.50 => BUY NO
    // p = 0.70 (prob NO is true), odds = 0.50 (NO price), b = 0.5/0.5 = 1
    // kelly = (0.70*1 - 0.30) / 1 = 0.40
    const result = calculateKellySizing(0.30, 0.50, 0.5, 'HIGH');
    expect(result.direction).toBe('BUY NO');
    expect(result.kellyPct).toBeCloseTo(0.4, 2);
  });

  // ── Confidence multipliers ──

  it('applies HIGH confidence multiplier = 1.0', () => {
    const high = calculateKellySizing(0.65, 0.50, 0.5, 'HIGH');
    const med = calculateKellySizing(0.65, 0.50, 0.5, 'MEDIUM');
    const low = calculateKellySizing(0.65, 0.50, 0.5, 'LOW');
    // HIGH should have the largest size
    expect(high.sizePct).toBeGreaterThan(med.sizePct);
    expect(med.sizePct).toBeGreaterThan(low.sizePct);
  });

  it('applies SynthData source boost', () => {
    const synth = calculateKellySizing(0.65, 0.50, 0.5, 'MEDIUM', 'synthdata+llm');
    const plain = calculateKellySizing(0.65, 0.50, 0.5, 'MEDIUM', 'llm');
    expect(synth.sizePct).toBeGreaterThanOrEqual(plain.sizePct);
  });

  // ── Risk tolerance scaling ──

  it('scales size with riskTolerance', () => {
    const conservative = calculateKellySizing(0.65, 0.50, 0.25, 'HIGH');
    const aggressive = calculateKellySizing(0.65, 0.50, 0.75, 'HIGH');
    expect(aggressive.sizePct).toBeGreaterThan(conservative.sizePct);
  });

  // ── Capping at 25% ──

  it('caps sizePct at 0.25 (25%)', () => {
    // Very high probability, very favorable odds => large kelly
    // aiProb=0.95, marketYesOdds=0.40, HIGH confidence, riskTol=1.0
    const result = calculateKellySizing(0.95, 0.40, 1.0, 'HIGH');
    expect(result.sizePct).toBeLessThanOrEqual(0.25);
  });

  // ── Default parameters ──

  it('uses defaults riskTolerance=0.5, confidence=LOW, source=llm', () => {
    const result = calculateKellySizing(0.65, 0.50);
    expect(result.actionable).toBe(true);
    expect(result.direction).toBe('BUY YES');
    expect(result.sizePct).toBeGreaterThan(0);
  });

  // ── Edge computation ──

  it('reports correct edge value', () => {
    const result = calculateKellySizing(0.70, 0.55);
    expect(result.edge).toBeCloseTo(0.15, 3);
  });

  // ── Phase 2: calibration-aware shrinkage ──

  it('passes through when no bucketCalibration provided', () => {
    const baseline = calculateKellySizing(0.70, 0.50, 0.5, 'HIGH');
    expect(baseline.calibrationFactor).toBeUndefined();
  });

  it('shrinks HIGH sizing when observed hit-rate is below nominal', () => {
    // HIGH nominal = 0.75. Observed 0.60 → shrink to 0.60/0.75 = 0.8×
    const full = calculateKellySizing(0.70, 0.50, 0.5, 'HIGH');
    const shrunk = calculateKellySizing(0.70, 0.50, 0.5, 'HIGH', 'llm', 0.05, { HIGH: 0.60 });
    expect(shrunk.calibrationFactor).toBeCloseTo(0.8, 2);
    expect(shrunk.sizePct).toBeLessThan(full.sizePct);
  });

  it('expands LOW sizing when observed hit-rate beats nominal', () => {
    // LOW nominal = 0.35. Observed 0.50 → expand to 0.50/0.35 ≈ 1.43×
    const baseline = calculateKellySizing(0.55, 0.45, 0.5, 'LOW');
    const expanded = calculateKellySizing(0.55, 0.45, 0.5, 'LOW', 'llm', 0.05, { LOW: 0.50 });
    expect(expanded.calibrationFactor).toBeCloseTo(1.43, 1);
    expect(expanded.sizePct).toBeGreaterThan(baseline.sizePct);
  });

  it('caps shrinkage factor at 0.25 (floor)', () => {
    // HIGH nominal = 0.75. Observed 0.05 → raw 0.067, clamped to 0.25
    const result = calculateKellySizing(0.70, 0.50, 0.5, 'HIGH', 'llm', 0.05, { HIGH: 0.05 });
    expect(result.calibrationFactor).toBe(0.25);
  });

  it('caps shrinkage factor at 1.5 (ceiling)', () => {
    // MEDIUM nominal = 0.55. Observed 1.00 → raw 1.82, clamped to 1.5
    const result = calculateKellySizing(0.65, 0.50, 0.5, 'MEDIUM', 'llm', 0.05, { MEDIUM: 1.0 });
    expect(result.calibrationFactor).toBe(1.5);
  });

  it('ignores bucketCalibration entries that are not numbers', () => {
    const withGarbage = calculateKellySizing(0.70, 0.50, 0.5, 'HIGH', 'llm', 0.05, { HIGH: 'hot' });
    const without = calculateKellySizing(0.70, 0.50, 0.5, 'HIGH');
    expect(withGarbage.calibrationFactor).toBeUndefined();
    expect(withGarbage.sizePct).toBe(without.sizePct);
  });
});
