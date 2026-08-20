import { describe, it, expect } from 'vitest';
import {
  americanToProbability,
  normalize1x2,
  classifyLeague,
  mergeScoreboardEvents,
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

  it('treats a null draw as a 2-way line and de-vigs home/away', () => {
    // NFL/NBA/MLB have no draw — null drawAmerican is a valid 2-way line.
    const p = normalize1x2(-155, null, 340);
    expect(p).not.toBeNull();
    expect(p.draw).toBe(0);
    expect(p.home + p.away).toBeCloseTo(1, 6);
    expect(p.home).toBeGreaterThan(p.away); // home favorite
  });

  it('returns null when a draw is present but missing/zero, or any side is invalid', () => {
    expect(normalize1x2(-155, 0, 340)).toBeNull();
    expect(normalize1x2(0, 200, 340)).toBeNull();   // home missing
    expect(normalize1x2(-155, 200, 'n/a')).toBeNull(); // away unparseable
  });
});

describe('mergeScoreboardEvents', () => {
  const ev = (id) => ({ id });

  it('concatenates groups and de-duplicates by event id', () => {
    const merged = mergeScoreboardEvents([ev('1'), ev('2')], [ev('2'), ev('3')]);
    expect(merged.map((e) => e.id)).toEqual(['1', '2', '3']);
  });

  it('keeps live/dated games even when the dated group is an empty array', () => {
    // Regression: ESPN's `dates=YYYYMMDD` query for today can return an empty
    // events array while the no-date scoreboard carries the same fixtures under
    // a UTC-day boundary. A truthy-but-empty dated group must not shadow the
    // default window's events.
    const merged = mergeScoreboardEvents([ev('phi-mia')], []);
    expect(merged.map((e) => e.id)).toEqual(['phi-mia']);
  });

  it('skips events without an id', () => {
    expect(mergeScoreboardEvents([ev('1'), {}], [ev('1')]).map((e) => e.id)).toEqual(['1']);
  });

  it('returns [] for empty/undefined groups', () => {
    expect(mergeScoreboardEvents(undefined, null, [])).toEqual([]);
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