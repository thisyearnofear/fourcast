/**
 * Prediction-market settlement — the non-sports leg of EVENT_OUTCOME_RESOLUTION.
 *
 * The intent asks "did the event resolve, and which way?" For questions that
 * are not sports fixtures, settled prediction-market state is one oracle:
 * Polymarket's Gamma API (free text search + direct lookups) and Kalshi's
 * public API (direct ticker/event/series lookups — Kalshi has no public text
 * search, and this module says so rather than pretending).
 *
 * Settlement rules come from services/markets/outcomeSettlement.js — the same
 * strict `deriveOutcome` the forecast resolver uses: a market answers only on
 * an unambiguous terminal state. A market that is still trading answers
 * "not resolved" (status 'open'), which is itself the useful answer for a
 * conditional escrow. A question no market matches is absent — never a
 * confident answer about a different market.
 *
 * `verified` stays false on every market answer: a platform's own settlement
 * record is evidence, not a Merkle proof.
 */

import { track } from './observe.js';
import { deriveOutcome, parseMaybeJson } from '../../services/markets/outcomeSettlement.js';
import { RECONCILE_STATUS } from '../../services/txline/reconciliationService.js';

const GAMMA = 'https://gamma-api.polymarket.com';
// The intent's catalogue target is under 5 seconds end-to-end — a hanging
// upstream must never spend the whole budget.
const TIMEOUT_MS = Number(process.env.MARKET_LOOKUP_TIMEOUT_MS || 4000);
const SEARCH_EVENT_LIMIT = 10;
const CANDIDATE_LIMIT = 15;

const kalshiBase = () =>
  process.env.KALSHI_BASE_URL || 'https://api.elections.kalshi.com/trade-api/v2';

async function fetchJson(url, upstream, fetchImpl) {
  return track(upstream, async () => {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${upstream} ${res.status}`);
    return res.json();
  });
}

/** True when the ask names a specific market — one right answer, like fixture_id. */
export function hasMarketLookup(params = {}) {
  return Boolean(
    params.market_id || params.condition_id || params.slug || params.market_url ||
    params.ticker || params.event_ticker || params.series_ticker
  );
}

/** The text to search: an explicit question, or the team/opponent pair a sports ask carried. */
export function marketSearchText(params = {}) {
  const q = typeof params.question === 'string' ? params.question.trim() : '';
  if (q) return q;
  return [params.team, params.opponent].filter(Boolean).join(' ').trim();
}

function noResult(error, message, extra = {}) {
  return { answer: null, metadata: { error, message, ...extra } };
}

// ── Candidate normalisation ──────────────────────────────────────────────

function polyCandidate(market, event) {
  const slug = market?.slug || event?.slug || null;
  return {
    platform: 'polymarket',
    raw: market,
    market_id: market?.id != null ? String(market.id) : null,
    condition_id: market?.conditionId || null,
    question: market?.question || event?.title || null,
    url: slug ? `https://polymarket.com/event/${slug}` : null,
    end: market?.endDate || event?.endDate || null,
  };
}

function kalshiCandidate(market, event) {
  return {
    platform: 'kalshi',
    raw: market,
    market_id: market?.ticker || null,
    question: market?.title || market?.subtitle || event?.title || null,
    url: market?.ticker ? `https://kalshi.com/markets/${market.ticker}` : null,
    end: market?.close_time || market?.expected_expiration_time || null,
  };
}

function slugFromUrl(url) {
  const m = /polymarket\.com\/event\/([A-Za-z0-9-]+)/.exec(String(url || ''));
  return m ? m[1] : null;
}

// ── Relevance: never answer a question other than the one asked ──────────

const STOP = new Set([
  'did', 'will', 'the', 'and', 'for', 'from', 'was', 'were', 'are', 'has',
  'have', 'had', 'not', 'yes', 'win', 'won', 'beat', 'who', 'what', 'how',
  'outcome', 'resolve', 'resolved', 'event', 'market', 'this', 'that',
]);

function questionScore(asked, title) {
  const tokens = String(asked)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  if (!tokens.length || !title) return 0;
  const hay = String(title).toLowerCase();
  return tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
}

// ── Answer construction ──────────────────────────────────────────────────

const platformName = (p) => (p === 'polymarket' ? 'Polymarket' : 'Kalshi');

function marketBlock(c) {
  const raw = c.raw || {};
  return {
    platform: c.platform,
    market_id: c.market_id,
    condition_id: c.condition_id ?? null,
    question: c.question,
    url: c.url,
    end: c.end,
    closed: raw.closed ?? (['settled', 'finalized'].includes(raw.status) ? true : raw.status ?? null),
    uma_resolution_status: raw.umaResolutionStatus ?? null,
    kalshi_result: raw.result ?? null,
  };
}

function resolvedAnswer(c, decision) {
  const label = decision.label ?? (decision.outcome === 1 ? 'Yes' : 'No');
  const lc = String(label).toLowerCase();
  const outcomes =
    c.platform === 'polymarket' ? parseMaybeJson(c.raw.outcomes) : ['yes', 'no'];
  return {
    status: 'resolved',
    resolved: true,
    winner: label,
    result: lc === 'yes' ? 'yes' : lc === 'no' ? 'no' : label,
    outcome_index: decision.outcome,
    outcomes,
    market: marketBlock(c),
    source: c.platform,
    verified: false,
    proof_available: false,
    proof: null,
    summary: `"${c.question}" resolved ${label} on ${platformName(c.platform)}.`,
  };
}

function openAnswer(c) {
  const prices =
    c.platform === 'polymarket'
      ? parseMaybeJson(c.raw.outcomePrices)?.map(Number) ?? null
      : {
          yes_bid: c.raw.yes_bid ?? null,
          yes_ask: c.raw.yes_ask ?? null,
          last: c.raw.last_price ?? null,
        };
  const yesLead =
    c.platform === 'polymarket' && Array.isArray(prices) && prices.length === 2
      ? ` — last traded ${Math.round(prices[0] * 100)}% YES`
      : '';
  return {
    status: 'open',
    resolved: false,
    winner: null,
    result: null,
    market: marketBlock(c),
    prices,
    source: c.platform,
    verified: false,
    proof_available: false,
    proof: null,
    summary: `"${c.question}" has not resolved on ${platformName(c.platform)}${yesLead}.`,
  };
}

function marketEnvelope(answer, upstreamErrors) {
  const status = answer.resolved ? RECONCILE_STATUS.SETTLED : RECONCILE_STATUS.PENDING;
  answer.resolution = {
    status,
    expected_winner: null,
    actual_winner: answer.winner,
    outcome_matches_consensus: null,
    consensus: null,
    cross_venue: null,
    settlement: answer.market,
  };
  return {
    answer,
    metadata: {
      source: answer.source,
      verification: 'none',
      resolution_status: status,
      settlement_source: answer.source,
      expectation_source: null,
      ...(upstreamErrors?.length ? { upstream_errors: upstreamErrors } : {}),
    },
  };
}

// ── Lookups ──────────────────────────────────────────────────────────────

async function kalshiLookups(params, fetchImpl, push, fail) {
  const base = kalshiBase();
  // Each handle is independent — a 404 on one must not silence the others.
  const tryOne = (label, fn) => fn().catch((err) => fail(`kalshi ${label}: ${err.message}`));
  if (params.ticker) {
    await tryOne(`ticker ${params.ticker}`, async () => {
      const d = await fetchJson(`${base}/markets/${encodeURIComponent(params.ticker)}`, 'kalshi', fetchImpl);
      const m = d?.market || d;
      if (m && typeof m === 'object') push(kalshiCandidate(m));
    });
  }
  if (params.event_ticker) {
    await tryOne(`event ${params.event_ticker}`, async () => {
      const d = await fetchJson(`${base}/events/${encodeURIComponent(params.event_ticker)}?with_nested_markets=true`, 'kalshi', fetchImpl);
      const ev = d?.event || null;
      for (const m of d?.markets || ev?.markets || []) push(kalshiCandidate(m, ev));
    });
  }
  if (params.series_ticker) {
    await tryOne(`series ${params.series_ticker}`, async () => {
      const d = await fetchJson(`${base}/markets?series_ticker=${encodeURIComponent(params.series_ticker)}&status=settled&limit=25`, 'kalshi', fetchImpl);
      for (const m of d?.markets || []) push(kalshiCandidate(m));
    });
  }
}

async function polymarketLookups(params, fetchImpl, push, fail) {
  const tryOne = (label, fn) => fn().catch((err) => fail(`polymarket ${label}: ${err.message}`));
  if (params.market_id) {
    await tryOne(`market ${params.market_id}`, async () => {
      const m = await fetchJson(`${GAMMA}/markets/${encodeURIComponent(params.market_id)}`, 'polymarket', fetchImpl);
      if (m && typeof m === 'object') push(polyCandidate(m));
    });
  }
  if (params.condition_id) {
    await tryOne(`condition ${clip(params.condition_id, 20)}`, async () => {
      const rows = await fetchJson(`${GAMMA}/markets?condition_ids=${encodeURIComponent(params.condition_id)}`, 'polymarket', fetchImpl);
      for (const m of Array.isArray(rows) ? rows.slice(0, 3) : []) push(polyCandidate(m));
    });
  }
  const slug = params.slug || slugFromUrl(params.market_url);
  if (slug) {
    await tryOne(`slug ${slug}`, async () => {
      const events = await fetchJson(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`, 'polymarket', fetchImpl);
      for (const ev of Array.isArray(events) ? events : []) {
        for (const m of ev?.markets || []) push(polyCandidate(m, ev));
      }
    });
  }
}

async function polymarketSearch(text, fetchImpl, push) {
  const url = `${GAMMA}/public-search?q=${encodeURIComponent(text)}&limit_per_type=${SEARCH_EVENT_LIMIT}`;
  const d = await fetchJson(url, 'polymarket', fetchImpl);
  let n = 0;
  for (const ev of d?.events || []) {
    for (const m of ev?.markets || []) {
      if (n >= CANDIDATE_LIMIT) return;
      push(polyCandidate(m, ev));
      n++;
    }
  }
}

/**
 * Resolve an ask through settled prediction-market state.
 *
 * @returns {{ answer: object|null, metadata: object }} — answer is null only
 *   when no market was found or none could settle the question; a still-open
 *   market is an answer (status 'open'), not an absence.
 */
export async function resolveFromMarkets(params = {}, { fetchImpl = fetch } = {}) {
  const platform = typeof params.platform === 'string' ? params.platform.toLowerCase() : null;
  const candidates = [];
  const errors = [];
  const push = (c) => { if (c?.raw) candidates.push(c); };

  const fail = (e) => errors.push(e);
  if (platform !== 'polymarket' && (params.ticker || params.event_ticker || params.series_ticker)) {
    await kalshiLookups(params, fetchImpl, push, fail);
  }
  if (platform !== 'kalshi' && (params.market_id || params.condition_id || params.slug || params.market_url)) {
    await polymarketLookups(params, fetchImpl, push, fail);
  }

  const named = candidates.length > 0;
  const text = marketSearchText(params);

  if (!named && text && platform !== 'kalshi') {
    try { await polymarketSearch(text, fetchImpl, push); }
    catch (err) { errors.push(`polymarket-search: ${err.message}`); }
  }

  if (!candidates.length) {
    if (platform === 'kalshi' && text) {
      return noResult(
        'kalshi_needs_ticker',
        'Kalshi has no public text search — pass a ticker, event_ticker, or series_ticker to settle a Kalshi question.',
        { upstream_errors: errors },
      );
    }
    return noResult(
      'no_market',
      `No settled or open market matched${text ? ` "${clip(text)}"` : ' the named market'}.`,
      { upstream_errors: errors },
    );
  }

  // Search hits must share real vocabulary with the ask; a direct lookup is
  // taken on faith because the caller named it.
  const pool = named
    ? candidates
    : candidates
        .map((c) => ({ c, s: questionScore(text, c.question) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c);

  if (!pool.length) {
    return noResult(
      'no_market',
      `Search returned ${candidates.length} market(s) but none matched "${clip(text)}".`,
      { upstream_errors: errors },
    );
  }

  let firstOpen = null;
  const skips = [];
  for (const cand of pool) {
    const decision = deriveOutcome(cand.platform, cand.raw);
    if (decision.outcome != null) return marketEnvelope(resolvedAnswer(cand, decision), errors);
    const stillTrading =
      decision.skip === 'not closed' ||
      (cand.platform === 'kalshi' && /^status=/.test(decision.skip || ''));
    if (stillTrading) { firstOpen ??= cand; continue; }
    skips.push(decision.skip);
  }

  if (firstOpen) return marketEnvelope(openAnswer(firstOpen), errors);

  return noResult(
    'market_unresolved',
    `Markets found but none settle the question unambiguously (${[...new Set(skips)].slice(0, 3).join('; ') || 'no readable payload'}).`,
    { upstream_errors: errors },
  );
}

function clip(s, n = 120) {
  const str = String(s || '');
  return str.length > n ? `${str.slice(0, n)}…` : str;
}
