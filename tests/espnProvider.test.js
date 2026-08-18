import { describe, it, expect } from 'vitest';
import {
  americanToProbability,
  normalize1x2,
  classifyLeague,
} from '../services/txline/espnProvider.js';

describe('americanToProbability', () => {
  it('converts negative (favorite) American odds', () => {
    expect(americanToProbability(-155)).toBeCloseTo(155 / 255, 6);
    expect(americanToProbability('-550')).toBeCloseTo(550 / 650, 6);
  });

  it('converts positive (underdog) American odds', () => {
    expect(americanToProbability(650)).toBeCloseTo(100 / 750, 6);
    expect(americanToProbability('+310')).toBeCloseTo(100 / 410, 6);
  });

  it('returns null for non-finite / zero', () => {
    expect(americanToProbability(0)).toBeNull();
    expect(americanToProbability('abc')).toBeNull();
    expect(americanToProbability(null)).toBeNull();
    expect(americanToProbability('n/a')).toBeNull();
  });
});

describe('normalize1x2', () => {
  it('de-vigs a 3-way moneyline into a distribution summing to 1', () => {
    const p = normalize1x2(-155, 310, 340);
    const closeHome = 155 / 255;
    const closeDraw = 100 / 410;
    const closeAway = 100 / 440;
    const total = closeHome + closeDraw + closeAway;
    expect(p.home).toBeCloseTo(closeHome / total, 6);
    expect(p.draw).toBeCloseTo(closeDraw / total, 6);
    expect(p.away).toBeCloseTo(closeAway / total, 6);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 6);
  });

  it('returns null when any side is missing/zero', () => {
    expect(normalize1x2(-155, null, 340)).toBeNull();
    expect(normalize1x2(-155, 0, 340)).toBeNull();
  });
});

describe('classifyLeague', () => {
  it('routes EPL / MLS / NFL by hints', () => {
    expect(classifyLeague('Will Arsenal beat Chelsea?')?.slug).toBe('eng.1');
    expect(classifyLeague('Will Inter Miami win at home?')?.slug).toBe('usa.1');
    expect(classifyLeague('Super Bowl 2026 winner: Chiefs vs Eagles')?.slug).toBe('nfl');
  });

  it('returns null when no league is recognizable', () => {
    expect(classifyLeague('Will Bitcoin close above $120k by Friday?')).toBeNull();
  });
});