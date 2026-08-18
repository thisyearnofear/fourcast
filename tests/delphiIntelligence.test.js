import { describe, it, expect } from 'vitest';
import {
  isGenericBinaryOutcomes,
  mapBinarySportsOutcomes,
  buildOddsEstimate,
} from '../services/delphiIntelligence.js';

const FIXTURE = {
  home: { name: 'Inter Miami' },
  away: { name: 'Toronto FC' },
};

describe('isGenericBinaryOutcomes', () => {
  it('recognizes generic Yes/No labels', () => {
    expect(isGenericBinaryOutcomes(['Yes', 'No'])).toBe(true);
    expect(isGenericBinaryOutcomes(['yes', 'no'])).toBe(true);
    expect(isGenericBinaryOutcomes([{ name: 'Yes' }, { name: 'No' }])).toBe(true);
  });

  it('rejects team-labelled and non-binary outcomes', () => {
    expect(isGenericBinaryOutcomes(['Inter Miami', 'Toronto FC'])).toBe(false);
    expect(isGenericBinaryOutcomes(['Yes', 'No', 'Draw'])).toBe(false);
    expect(isGenericBinaryOutcomes(['Yes'])).toBe(false);
    expect(isGenericBinaryOutcomes(undefined)).toBe(false);
  });
});

describe('mapBinarySportsOutcomes', () => {
  const base = {
    outcomes: ['Yes', 'No'],
    fixture: FIXTURE,
    homeProb: 0.6,
    drawProb: 0.2,
    awayProb: 0.2,
  };

  it('maps "Will X beat Y?" to the subject team win probability', () => {
    const res = mapBinarySportsOutcomes({
      ...base,
      question: 'Will Inter Miami beat Toronto FC?',
    });
    expect(res).toEqual([0.6, 0.4]);
  });

  it('maps "Will X win?" when X is the away side', () => {
    const res = mapBinarySportsOutcomes({
      ...base,
      question: 'Will Toronto FC win their match?',
    });
    expect(res).toEqual([0.2, 0.8]);
  });

  it('returns null when the question cannot be parsed (falls to LLM)', () => {
    expect(
      mapBinarySportsOutcomes({
        ...base,
        question: 'Will Inter Miami score over 2.5 goals?',
      })
    ).toBeNull();
  });

  it('returns null when the subject team is not in the fixture', () => {
    expect(
      mapBinarySportsOutcomes({
        ...base,
        question: 'Will Barcelona beat Real Madrid?',
      })
    ).toBeNull();
  });

  it('returns null for non-generic (team-labelled) outcomes', () => {
    expect(
      mapBinarySportsOutcomes({
        ...base,
        outcomes: ['Inter Miami', 'Toronto FC'],
        question: 'Who wins Inter Miami vs Toronto FC?',
      })
    ).toBeNull();
  });

  it('respects outcome object names', () => {
    const res = mapBinarySportsOutcomes({
      ...base,
      outcomes: [{ name: 'Yes' }, { name: 'No' }],
      question: 'Will Inter Miami beat Toronto FC?',
    });
    expect(res).toEqual([0.6, 0.4]);
  });
});

describe('buildOddsEstimate', () => {
  const fixture = FIXTURE;
  const marketFor = (outcomes, question) => ({ outcomes, question });

  it('maps binary Yes/No to the subject team share from free odds', () => {
    const est = buildOddsEstimate({
      market: marketFor(['Yes', 'No'], 'Will Inter Miami beat Toronto FC?'),
      fixture,
      homeProb: 0.6,
      drawProb: 0.2,
      awayProb: 0.2,
      source: 'espn',
      league: 'MLS',
    });
    expect(est.probabilities).toEqual([0.6, 0.4]);
    expect(est.source).toBe('espn');
    expect(est.confidence).toBe('HIGH');
  });

  it('maps a team-labelled 3-way market to home/draw/away', () => {
    const est = buildOddsEstimate({
      market: marketFor(['Inter Miami', 'Toronto FC', 'Draw'], 'Inter Miami vs Toronto FC'),
      fixture,
      homeProb: 0.6,
      drawProb: 0.2,
      awayProb: 0.2,
      source: 'espn',
    });
    expect(est.probabilities[0]).toBeCloseTo(0.6, 6);
    expect(est.probabilities[1]).toBeCloseTo(0.2, 6);
    expect(est.probabilities[2]).toBeCloseTo(0.2, 6);
  });

  it('returns null for an unparseable generic binary form', () => {
    expect(
      buildOddsEstimate({
        market: marketFor(['Yes', 'No'], 'Will Inter Miami score over 2.5 goals?'),
        fixture,
        homeProb: 0.6,
        drawProb: 0.2,
        awayProb: 0.2,
        source: 'espn',
      })
    ).toBeNull();
  });

  it('returns null when no odds are available (total <= 0)', () => {
    expect(
      buildOddsEstimate({
        market: marketFor(['Yes', 'No'], 'Will Inter Miami beat Toronto FC?'),
        fixture,
        homeProb: 0,
        drawProb: 0,
        awayProb: 0,
        source: 'espn',
      })
    ).toBeNull();
  });
});
