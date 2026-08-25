import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  teamFromQuery,
  inferIntent,
  normalizeQueryRequest,
  signalFieldsFromAnswer,
  parseNaturalLanguage,
} from '../src/query.js';

describe('parseNaturalLanguage', () => {
  it('extracts Premier League from query', () => {
    const got = parseNaturalLanguage('Premier League scores this weekend');
    assert.equal(got.competition, 'Premier League');
  });

  it('extracts team name via teamFromQuery via normalize', () => {
    const got = normalizeQueryRequest({ query: 'who won Manchester City this weekend' });
    assert.equal(got.ok, true);
    assert.equal(got.params.team, 'Manchester City');
  });

  it('infers GAME_RESULT for winner queries', () => {
    const got = normalizeQueryRequest({ query: 'who won Liverpool this weekend' });
    assert.equal(got.ok, true);
    assert.equal(got.intent, 'GAME_RESULT');
  });
});

describe('teamFromQuery', () => {
  it('pulls a team name out of a natural-language score question', () => {
    assert.equal(teamFromQuery('What is the Inter Miami score?'), 'Inter Miami');
  });

  it('keeps the first side of an X vs Y question', () => {
    assert.equal(teamFromQuery('Who won Inter Miami vs Atlanta United?'), 'Inter Miami');
  });
});

describe('inferIntent', () => {
  it('defaults to SPORTS_SCORE', () => {
    assert.equal(inferIntent('Inter Miami score'), 'SPORTS_SCORE');
  });

  it('uses GAME_RESULT for winner/final phrasing', () => {
    assert.equal(inferIntent('Who won Inter Miami last night?'), 'GAME_RESULT');
    assert.equal(inferIntent('final result for fixture 12'), 'GAME_RESULT');
  });
});

describe('normalizeQueryRequest', () => {
  it('passes the envelope through', () => {
    const got = normalizeQueryRequest({
      intent: 'SPORTS_SCORE',
      params: { team: 'Inter Miami' },
      request_id: 'abc',
    });
    assert.deepEqual(got, {
      ok: true,
      intent: 'SPORTS_SCORE',
      params: { team: 'Inter Miami' },
      request_id: 'abc',
    });
  });

  it('accepts a flat auto-routed body without intent', () => {
    const got = normalizeQueryRequest({
      query: 'What is the Inter Miami score?',
      context: { agent: 'alexandria' },
    });
    assert.equal(got.ok, true);
    assert.equal(got.intent, 'SPORTS_SCORE');
    assert.equal(got.params.team, 'Inter Miami');
  });

  it('accepts top-level team / fixture_id', () => {
    const got = normalizeQueryRequest({
      intent: 'GAME_RESULT',
      fixture_id: '123456',
    });
    assert.equal(got.ok, true);
    assert.equal(got.params.fixture_id, '123456');
  });

  it('does not let a flat field overwrite params', () => {
    const got = normalizeQueryRequest({
      intent: 'SPORTS_SCORE',
      params: { team: 'FromParams' },
      team: 'FromFlat',
    });
    assert.equal(got.params.team, 'FromParams');
  });

  it('infers intent from query when declared intent is unsupported', () => {
    // When the auto-router misfires with an unsupported intent, try parsing
    // the query text — "Inter Miami" should infer SPORTS_SCORE.
    const got = normalizeQueryRequest({
      intent: 'WEB_SEARCH',
      query: 'Inter Miami',
    });
    assert.equal(got.ok, true);
    assert.equal(got.intent, 'SPORTS_SCORE');
    assert.equal(got.params.team, 'Inter Miami');
  });

  it('returns graceful 200 when intent is unsupported and query is not parseable', () => {
    // "what can you offer" has no parseable sports signal — graceful 200.
    const got = normalizeQueryRequest({
      intent: 'unsupported',
      query: 'what can you offer',
    });
    assert.equal(got.ok, false);
    assert.equal(got.status, 200); // graceful, not a 400
    assert.equal(got.error, 'unsupported_intent');
    assert.match(got.message, /SPORTS_SCORE/);
  });

  it('400s an empty body', () => {
    const got = normalizeQueryRequest({});
    assert.equal(got.ok, false);
    assert.equal(got.error, 'missing_intent');
  });
});

describe('signalFieldsFromAnswer', () => {
  it('builds scalars for a final score', () => {
    const got = signalFieldsFromAnswer({
      home_team: 'Inter Miami',
      away_team: 'Atlanta United',
      home_score: 2,
      away_score: 1,
      status: 'final',
      result: 'home_win',
      proof_available: true,
    });
    assert.equal(got.score, '2-1');
    assert.equal(got.label, 'final');
    assert.equal(got.winner, 'Inter Miami');
    assert.equal(got.proof_available, true);
    assert.match(got.reason, /Inter Miami vs Atlanta United/);
  });

  it('returns empty score when there is no fixture', () => {
    const got = signalFieldsFromAnswer(null);
    assert.equal(got.score, '');
    assert.equal(got.label, 'unknown');
    assert.equal(got.winner, '');
  });
});
