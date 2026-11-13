/**
 * EVENT_OUTCOME_RESOLUTION — the market-settlement leg.
 *
 * Polymarket (Gamma) and Kalshi are stubbed; TxLINE is unconfigured and the
 * ESPN/OpenLigaDB paths fast-fail without a team, so non-sports asks land on
 * the market leg. No network: every upstream URL is either matched or gets an
 * empty body.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.TELEGRAPH_INTENT_EVENT_OUTCOME = 'true';
delete process.env.TXLINE_API_TOKEN;
delete process.env.TXLINE_GUEST_JWT;
delete process.env.MINER_SIGNING_KEY;

const { resolveFromMarkets, hasMarketLookup, marketSearchText } = await import('../src/marketResolution.js');
const { handleEventOutcomeResolution } = await import('../src/intents/eventOutcomeResolution.js');
const { normalizeQueryRequest } = await import('../src/query.js');

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const FED_RESOLVED = {
  id: 520210,
  question: 'Will the Fed cut rates in October 2026?',
  slug: 'fed-october-2026',
  outcomes: '["Yes","No"]',
  outcomePrices: '["1","0"]',
  closed: true,
  active: false,
  umaResolutionStatus: 'resolved',
  endDate: '2026-10-29T00:00:00Z',
};
const FED_OPEN = {
  ...FED_RESOLVED,
  id: 520211,
  closed: false,
  active: true,
  outcomePrices: '["0.62","0.38"]',
};
const FED_VOID = { ...FED_RESOLVED, id: 520212, outcomePrices: '["0.5","0.5"]' };
const FED_PROPOSED = { ...FED_RESOLVED, id: 520213, umaResolutionStatus: 'proposed' };
const FED_NONTERMINAL = {
  ...FED_RESOLVED,
  id: 520214,
  outcomePrices: '["0.9","0.1"]',
  umaResolutionStatus: undefined,
};
const FED_MULTI_RESOLVED = {
  ...FED_RESOLVED,
  id: 520215,
  question: 'What did the Fed do in October 2026?',
  outcomes: '["Cut 25","Hold","Hike"]',
  outcomePrices: '["0","1","0"]',
};
const KALSHI_SETTLED = {
  market: { ticker: 'KXFEDDECISION-26OCT', title: 'Fed cuts rates in October', status: 'settled', result: 'yes' },
};
const KALSHI_OPEN = {
  market: { ticker: 'KXFEDDECISION-26NOV', title: 'Fed cuts rates in November', status: 'open', result: '' },
};
const KALSHI_PENDING = {
  market: { ticker: 'KXFEDDECISION-26DEC', title: 'Fed cuts rates in December', status: 'closed', result: '' },
};
const KALSHI_VOIDED = {
  market: { ticker: 'KXFEDDECISION-26JAN', title: 'Fed cuts rates in January', status: 'settled', result: 'voided' },
};

let realFetch;
/** Each [match, body] pair answers any URL containing match; unmatched URLs get an empty body. */
function stubFetch(handlers) {
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    for (const [match, body] of handlers) {
      if (u.includes(match)) return json(typeof body === 'function' ? body(u) : body);
    }
    return json({});
  };
}
function unstub() {
  globalThis.fetch = realFetch;
}

describe('lookup detection', () => {
  it('named-market params count as a lookup; a bare question does not', () => {
    assert.equal(hasMarketLookup({ market_id: '520210' }), true);
    assert.equal(hasMarketLookup({ ticker: 'KXFED' }), true);
    assert.equal(hasMarketLookup({ market_url: 'https://polymarket.com/event/fed-october-2026' }), true);
    assert.equal(hasMarketLookup({ question: 'did the fed cut rates' }), false);
    assert.equal(hasMarketLookup({ team: 'Arsenal' }), false);
  });

  it('synthesizes search text from a sports ask when no question exists', () => {
    assert.equal(marketSearchText({ question: 'did X happen' }), 'did X happen');
    assert.equal(marketSearchText({ team: 'Arsenal', opponent: 'Chelsea' }), 'Arsenal Chelsea');
    assert.equal(marketSearchText({}), '');
  });
});

describe('resolveFromMarkets', () => {
  it('resolves a named Polymarket market', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520210', FED_RESOLVED]]);
    try {
      const out = await resolveFromMarkets({ market_id: '520210' });
      assert.equal(out.answer.status, 'resolved');
      assert.equal(out.answer.resolved, true);
      assert.equal(out.answer.winner, 'Yes');
      assert.equal(out.answer.result, 'yes');
      assert.equal(out.answer.source, 'polymarket');
      assert.equal(out.answer.verified, false);
      assert.equal(out.answer.proof, null);
      assert.equal(out.answer.resolution.status, 'settled');
      assert.match(out.answer.summary, /resolved Yes on Polymarket/);
      assert.equal(out.metadata.resolution_status, 'settled');
      assert.equal(out.metadata.settlement_source, 'polymarket');
    } finally { unstub(); }
  });

  it('answers "still trading" for an open market — an honest no, not an absence', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520211', FED_OPEN]]);
    try {
      const out = await resolveFromMarkets({ market_id: '520211' });
      assert.equal(out.answer.status, 'open');
      assert.equal(out.answer.resolved, false);
      assert.equal(out.answer.winner, null);
      assert.deepEqual(out.answer.prices, [0.62, 0.38]);
      assert.equal(out.answer.resolution.status, 'pending');
    } finally { unstub(); }
  });

  it('reports a finalized split as void — never a guessed winner', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520212', FED_VOID]]);
    try {
      const out = await resolveFromMarkets({ market_id: '520212' });
      assert.equal(out.answer.status, 'void');
      assert.equal(out.answer.resolved, false);
      assert.equal(out.answer.winner, null);
      assert.equal(out.answer.result, 'void');
      assert.match(out.answer.reason, /equal terminal prices/);
      assert.equal(out.answer.resolution.status, 'void');
      assert.equal(out.metadata.resolution_status, 'void');
    } finally { unstub(); }
  });

  it('holds on a proposed UMA resolution — pending_resolution, not resolved', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520213', FED_PROPOSED]]);
    try {
      const out = await resolveFromMarkets({ market_id: '520213' });
      assert.equal(out.answer.status, 'pending_resolution');
      assert.equal(out.answer.resolved, false);
      assert.match(out.answer.reason, /umaResolutionStatus=proposed/);
      assert.equal(out.answer.resolution.status, 'pending');
      assert.equal(out.answer.market.uma_resolution_status, 'proposed');
    } finally { unstub(); }
  });

  it('holds on a closed market with non-terminal prices', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520214', FED_NONTERMINAL]]);
    try {
      const out = await resolveFromMarkets({ market_id: '520214' });
      assert.equal(out.answer.status, 'pending_resolution');
      assert.match(out.answer.reason, /non-terminal outcomePrices/);
    } finally { unstub(); }
  });

  it('resolves a multi-outcome market when exactly one price is 1', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520215', FED_MULTI_RESOLVED]]);
    try {
      const out = await resolveFromMarkets({ market_id: '520215' });
      assert.equal(out.answer.status, 'resolved');
      assert.equal(out.answer.winner, 'Hold');
      assert.equal(out.answer.outcome_index, 1);
      assert.deepEqual(out.answer.outcomes, ['Cut 25', 'Hold', 'Hike']);
    } finally { unstub(); }
  });

  it('refuses to pick a winner when a slug names several markets', async () => {
    stubFetch([['gamma-api.polymarket.com/events?slug=fed-decisions', [{
      id: 'e1', slug: 'fed-decisions', title: 'Fed decisions',
      markets: [FED_RESOLVED, FED_OPEN],
    }]]]);
    try {
      const out = await resolveFromMarkets({ slug: 'fed-decisions' });
      assert.equal(out.answer, null);
      assert.equal(out.metadata.error, 'ambiguous_market');
      assert.equal(out.metadata.candidates.length, 2);
      assert.equal(out.metadata.candidates[0].platform, 'polymarket');
    } finally { unstub(); }
  });

  it('two handles naming the same market dedupe, not refuse', async () => {
    stubFetch([
      ['gamma-api.polymarket.com/markets/520210', FED_RESOLVED],
      ['gamma-api.polymarket.com/events?slug=fed-october-2026', [{ slug: 'fed-october-2026', markets: [FED_RESOLVED] }]],
    ]);
    try {
      const out = await resolveFromMarkets({ market_id: '520210', slug: 'fed-october-2026' });
      assert.equal(out.answer.status, 'resolved');
    } finally { unstub(); }
  });

  it('carries the venue resolution source and a rules excerpt', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520210', {
      ...FED_RESOLVED,
      resolutionSource: 'https://federalreserve.gov',
      description: 'Resolves Yes if the FOMC cuts the target rate. '.repeat(20),
    }]]);
    try {
      const out = await resolveFromMarkets({ market_id: '520210' });
      assert.equal(out.answer.market.resolution_source, 'https://federalreserve.gov');
      assert.ok(out.answer.market.rules_excerpt.startsWith('Resolves Yes'));
      assert.ok(out.answer.market.rules_excerpt.length <= 241);
    } finally { unstub(); }
  });

  it('looks up a Polymarket event by slug', async () => {
    stubFetch([['gamma-api.polymarket.com/events?slug=fed-decisions', [{ id: 'e1', slug: 'fed-decisions', title: 'Fed decisions', markets: [FED_RESOLVED] }]]]);
    try {
      const out = await resolveFromMarkets({ slug: 'fed-decisions' });
      assert.equal(out.answer.status, 'resolved');
      assert.equal(out.answer.market.url, 'https://polymarket.com/event/fed-october-2026');
    } finally { unstub(); }
  });

  it('settles a Kalshi ticker', async () => {
    stubFetch([['kalshi.com', KALSHI_SETTLED]]);
    try {
      const out = await resolveFromMarkets({ ticker: 'KXFEDDECISION-26OCT' });
      assert.equal(out.answer.status, 'resolved');
      assert.equal(out.answer.winner, 'yes');
      assert.equal(out.answer.result, 'yes');
      assert.equal(out.answer.source, 'kalshi');
      assert.equal(out.answer.market.kalshi_result, 'yes');
    } finally { unstub(); }
  });

  it('reports a trading Kalshi market as open', async () => {
    stubFetch([['kalshi.com', KALSHI_OPEN]]);
    try {
      const out = await resolveFromMarkets({ ticker: 'KXFEDDECISION-26NOV' });
      assert.equal(out.answer.status, 'open');
      assert.equal(out.answer.resolved, false);
      assert.equal(out.answer.resolution.status, 'pending');
    } finally { unstub(); }
  });

  it('holds on a closed-but-unsettled Kalshi market', async () => {
    stubFetch([['kalshi.com', KALSHI_PENDING]]);
    try {
      const out = await resolveFromMarkets({ ticker: 'KXFEDDECISION-26DEC' });
      assert.equal(out.answer.status, 'pending_resolution');
      assert.match(out.answer.reason, /status=closed/);
      assert.equal(out.answer.resolution.status, 'pending');
    } finally { unstub(); }
  });

  it('reports a voided Kalshi market as void', async () => {
    stubFetch([['kalshi.com', KALSHI_VOIDED]]);
    try {
      const out = await resolveFromMarkets({ ticker: 'KXFEDDECISION-26JAN' });
      assert.equal(out.answer.status, 'void');
      assert.equal(out.answer.result, 'void');
    } finally { unstub(); }
  });

  it('refuses to pick among several markets under one event_ticker', async () => {
    stubFetch([['kalshi.com', {
      event: { event_ticker: 'KXFEDDECISION', title: 'Fed decisions' },
      markets: [
        { ticker: 'KXFEDDECISION-26OCT', title: 'October cut', status: 'settled', result: 'yes' },
        { ticker: 'KXFEDDECISION-26NOV', title: 'November cut', status: 'open', result: '' },
      ],
    }]]);
    try {
      const out = await resolveFromMarkets({ event_ticker: 'KXFEDDECISION' });
      assert.equal(out.answer, null);
      assert.equal(out.metadata.error, 'ambiguous_market');
      assert.equal(out.metadata.candidates.length, 2);
    } finally { unstub(); }
  });

  it('refuses Kalshi text search honestly — pass a ticker', async () => {
    const out = await resolveFromMarkets({ platform: 'kalshi', question: 'did the fed cut rates' });
    assert.equal(out.answer, null);
    assert.equal(out.metadata.error, 'kalshi_needs_ticker');
  });

  it('searches Polymarket for a free-text question', async () => {
    stubFetch([['gamma-api.polymarket.com/public-search', {
      events: [{ id: 'e1', slug: 'fed-decisions', title: 'Fed decisions', markets: [FED_RESOLVED] }],
      pagination: { hasMore: false },
    }]]);
    try {
      const out = await resolveFromMarkets({ question: 'did the fed cut rates in october' });
      assert.equal(out.answer.status, 'resolved');
      assert.equal(out.answer.source, 'polymarket');
      assert.equal(out.answer.winner, 'Yes');
    } finally { unstub(); }
  });

  it('never answers a question other than the one asked', async () => {
    stubFetch([['gamma-api.polymarket.com/public-search', {
      events: [{ id: 'e2', slug: 'world-cup-winner', title: 'World Cup winner', markets: [{ ...FED_RESOLVED, question: 'Will Argentina win the World Cup?' }] }],
      pagination: {},
    }]]);
    try {
      const out = await resolveFromMarkets({ question: 'did the fed cut rates in october' });
      assert.equal(out.answer, null);
      assert.equal(out.metadata.error, 'absent');
      assert.match(out.metadata.message, /none matched/);
    } finally { unstub(); }
  });

  it('reports absence when nothing matches', async () => {
    stubFetch([['gamma-api.polymarket.com/public-search', { events: [], pagination: { hasMore: false } }]]);
    try {
      const out = await resolveFromMarkets({ question: 'did the zorblax treaty pass' });
      assert.equal(out.answer, null);
      assert.equal(out.metadata.error, 'absent');
    } finally { unstub(); }
  });
});

describe('handler wiring', () => {
  it('a named market goes straight to the market leg', async () => {
    stubFetch([['gamma-api.polymarket.com/markets/520210', FED_RESOLVED]]);
    try {
      const out = await handleEventOutcomeResolution({ market_id: '520210' });
      assert.equal(out.answer.status, 'resolved');
      assert.equal(out.answer.source, 'polymarket');
    } finally { unstub(); }
  });

  it('a non-sports question falls through the sports leg to the market leg', async () => {
    stubFetch([['gamma-api.polymarket.com/public-search', {
      events: [{ id: 'e1', slug: 'fed-decisions', title: 'Fed decisions', markets: [FED_RESOLVED] }],
    }]]);
    try {
      const out = await handleEventOutcomeResolution({ question: 'did the fed cut rates in october' });
      assert.equal(out.answer.status, 'resolved');
      assert.equal(out.answer.source, 'polymarket');
    } finally { unstub(); }
  });

  it('a question no market can settle stays an absence', async () => {
    stubFetch([['gamma-api.polymarket.com/public-search', { events: [] }]]);
    try {
      const out = await handleEventOutcomeResolution({ question: 'who won the zorblax cup' });
      // The sports leg's absence is what surfaces — market leg found nothing.
      assert.equal(out.answer, null);
      assert.equal(out.metadata.error, 'no_completed_match');
    } finally { unstub(); }
  });

  it('refuses when the kill switch is false', async () => {
    const saved = process.env.TELEGRAPH_INTENT_EVENT_OUTCOME;
    process.env.TELEGRAPH_INTENT_EVENT_OUTCOME = 'false';
    try {
      const out = await handleEventOutcomeResolution({ market_id: '520210' });
      assert.equal(out.answer, null);
      assert.equal(out.metadata.error, 'intent_disabled');
    } finally {
      if (saved === undefined) delete process.env.TELEGRAPH_INTENT_EVENT_OUTCOME;
      else process.env.TELEGRAPH_INTENT_EVENT_OUTCOME = saved;
    }
  });
});

describe('query plumbing', () => {
  it('carries the question text and market handles into params', () => {
    const parsed = normalizeQueryRequest({ query: 'did the fed cut rates', market_id: '520210' });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.params.question, 'did the fed cut rates');
    assert.equal(parsed.params.market_id, '520210');
  });

  it('a structured question field wins over the raw query', () => {
    const parsed = normalizeQueryRequest({ intent: 'GAME_RESULT', query: 'ignored', params: { question: 'kept', team: 'Inter Miami' } });
    assert.equal(parsed.params.question, 'kept');
  });
});
