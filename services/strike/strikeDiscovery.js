/**
 * Strike market discovery — the read-only half of the venue adapter.
 *
 * Public market data only (no auth): exchangeInfo defines the tradable
 * universe and its filter rules; ticker/mark/klines/open-interest supply
 * the per-symbol stats the edge machinery scores on. Everything here works
 * with zero credentials — `strikePublic` never signs.
 */

import { strikePublic } from './strikeClient.js';

/** exchangeInfo → normalized per-symbol trading rules (filters flattened). */
export function normalizeSymbolInfo(raw) {
  const filters = {};
  for (const f of raw?.filters || []) {
    if (!f?.filterType) continue;
    if (f.filterType === 'PRICE_FILTER') {
      filters.tickSize = f.tickSize;
      filters.minPrice = f.minPrice;
      filters.maxPrice = f.maxPrice;
    } else if (f.filterType === 'LOT_SIZE') {
      filters.stepSize = f.stepSize;
      filters.minQty = f.minQty;
      filters.maxQty = f.maxQty;
    } else if (f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL') {
      filters.minNotional = f.notional;
    }
  }
  return {
    symbol: raw?.symbol,
    status: raw?.status,
    contractType: raw?.contractType,
    baseAsset: raw?.baseAsset,
    quoteAsset: raw?.quoteAsset,
    marginAsset: raw?.marginAsset,
    pricePrecision: raw?.pricePrecision,
    quantityPrecision: raw?.quantityPrecision,
    orderTypes: raw?.orderType || [],
    filters,
  };
}

/** The tradable universe: symbol → rules. Throws Strike errors through. */
export async function getUniverse(opts = {}) {
  const data = await strikePublic('/v2/exchangeInfo', opts);
  const symbols = (data?.symbols || [])
    .map(normalizeSymbolInfo)
    .filter((s) => s.symbol && s.status === 'trading');
  return { serverTime: data?.serverTime ?? null, symbols };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Per-symbol snapshot: price, 24h stats, funding, positioning, and a simple
 * volatility read from the last N hourly klines. Every field is sourced;
 * anything the API didn't give stays null — never zero-filled into evidence.
 */
export async function getSymbolSnapshot(symbol, { klineInterval = '1h', klineLimit = 48, ...opts } = {}) {
  const [ticker, mark, oi, klines] = await Promise.all([
    strikePublic('/v2/ticker/24hr', { params: { symbol }, ...opts }).catch(() => null),
    strikePublic('/v2/markPrice', { params: { symbol }, ...opts }).catch(() => null),
    strikePublic('/v2/openInterest', { params: { symbol }, ...opts }).catch(() => null),
    strikePublic('/v2/klines', { params: { symbol, interval: klineInterval, limit: String(klineLimit) }, ...opts }).catch(() => null),
  ]);

  const t = Array.isArray(ticker) ? ticker[0] : ticker;
  const closes = Array.isArray(klines) ? klines.map((k) => num(k[4])).filter((n) => n != null) : [];
  // Volatility: mean absolute hourly return over the window, in percent.
  let volatilityPct = null;
  if (closes.length > 2) {
    const rets = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) rets.push(Math.abs(closes[i] / closes[i - 1] - 1));
    }
    if (rets.length) volatilityPct = (rets.reduce((a, b) => a + b, 0) / rets.length) * 100;
  }

  return {
    symbol,
    lastPrice: num(t?.lastPrice ?? t?.price),
    priceChangePct24h: num(t?.priceChangePercent),
    quoteVolume24h: num(t?.quoteVolume),
    volume24h: num(t?.volume),
    high24h: num(t?.highPrice),
    low24h: num(t?.lowPrice),
    // markPrice answers in compact update shape: {p: mark, i: index, r: funding}
    markPrice: num(mark?.markPrice ?? mark?.p),
    indexPrice: num(mark?.indexPrice ?? mark?.i),
    fundingRate: num(mark?.lastFundingRate ?? mark?.fundingRate ?? mark?.r),
    openInterest: num(oi?.openInterest),
    volatilityPct,
    klines: closes.length,
    at: new Date().toISOString(),
  };
}

/**
 * Candidate universe for the edge machinery: one row per tradable symbol
 * with the stats the loop sorts on. `minQuoteVolume` drops dead books.
 */
export async function buildCandidates({ minQuoteVolume = 0, ...opts } = {}) {
  const { symbols } = await getUniverse(opts);
  const snapshots = await Promise.all(
    symbols.map((s) => getSymbolSnapshot(s.symbol, opts).catch(() => null)),
  );
  const bySymbol = new Map(snapshots.filter(Boolean).map((s) => [s.symbol, s]));

  return symbols.map((s) => {
    const snap = bySymbol.get(s.symbol) || {};
    return {
      marketID: `strike:${s.symbol}`,
      symbol: s.symbol,
      platform: 'strike',
      venue: 'strike',
      title: `${s.symbol} perpetual`,
      contractType: s.contractType,
      tradingRules: s,
      markPrice: snap.markPrice ?? null,
      lastPrice: snap.lastPrice ?? null,
      fundingRate: snap.fundingRate ?? null,
      volume24h: snap.quoteVolume24h ?? null,
      openInterest: snap.openInterest ?? null,
      volatilityPct: snap.volatilityPct ?? null,
      eligible: (snap.quoteVolume24h ?? 0) >= minQuoteVolume,
    };
  });
}
