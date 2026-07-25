/**
 * Contextual Data Service — free macro/sentiment data feeds that
 * contextualise the prediction markets shown on the landing page.
 *
 * Tier 1 (no API key required):
 *   - Fear & Greed Index (alternative.me)
 *   - CoinGecko spot prices (free, no key)
 *   - DeFiLlama TVL / stablecoin supply (free, no key)
 *
 * Tier 2 (free, API key required):
 *   - FRED economic indicators (Fed funds rate, CPI, treasury yields)
 *
 * All calls go through fetchWithBudget for timeout, retries, circuit
 * breaker, and in-memory caching. No data is invented — if a source is
 * unreachable, its slot is simply omitted.
 *
 * The service maps a market title to relevant contextual data points so
 * the landing page strip shows data that actually relates to the
 * currently-cycling market.
 */

import { fetchWithBudget } from '@/services/infra/http.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Asset detection (reuses SynthData's keyword map) ─────────────────────

const ASSET_KEYWORDS = [
  { asset: 'BTC', keywords: ['bitcoin', 'btc', '₿'] },
  { asset: 'ETH', keywords: ['ethereum', 'eth', 'ether'] },
  { asset: 'SOL', keywords: ['solana', 'sol'] },
  { asset: 'XAU', keywords: ['gold', 'xau'] },
  { asset: 'SPY', keywords: ['s&p 500', 's&p500', 'spy', 'sp500'] },
  { asset: 'NVDA', keywords: ['nvidia', 'nvda'] },
  { asset: 'TSLA', keywords: ['tesla', 'tsla'] },
  { asset: 'AAPL', keywords: ['apple', 'aapl'] },
  { asset: 'GOOGL', keywords: ['google', 'googl', 'alphabet'] },
];

const COINGECKO_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
};

function detectAsset(title) {
  const text = (title || '').toLowerCase();
  for (const { asset, keywords } of ASSET_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw))) return asset;
  }
  return null;
}

function isFedRelated(title) {
  const text = (title || '').toLowerCase();
  return text.includes('fed ') || text.includes('interest rate') || text.includes('rate cut') || text.includes('federal reserve');
}

function isCryptoRelated(title) {
  const text = (title || '').toLowerCase();
  return text.includes('bitcoin') || text.includes('btc') || text.includes('ethereum') || text.includes('eth') || text.includes('crypto') || text.includes('solana') || text.includes('sol');
}

function isDeFiRelated(title) {
  const text = (title || '').toLowerCase();
  return text.includes('defi') || text.includes('stablecoin') || text.includes('tvl') || text.includes('usdc') || text.includes('usdt') || text.includes('depeg');
}

// ── Tier 1: Fear & Greed Index (alternative.me, free, no key) ────────────

async function fetchFearGreed() {
  try {
    const { data } = await fetchWithBudget(
      'https://api.alternative.me/fng/?limit=1',
      { provider: 'fear-greed', timeoutMs: 5000, retries: 1, cacheTtlMs: CACHE_TTL },
    );
    const entry = data?.data?.[0];
    if (!entry) return null;
    const value = parseInt(entry.value, 10);
    return {
      label: 'Crypto Fear & Greed',
      value: `${value} · ${entry.value_classification}`,
      raw: value,
      classification: entry.value_classification,
    };
  } catch {
    return null;
  }
}

// ── Tier 1: CoinGecko spot price (free, no key) ───────────────────────────

async function fetchCoinGeckoPrice(asset) {
  const geckoId = COINGECKO_ID[asset];
  if (!geckoId) return null;
  try {
    const { data } = await fetchWithBudget(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`,
      { provider: 'coingecko', timeoutMs: 5000, retries: 1, cacheTtlMs: CACHE_TTL },
    );
    const price = data?.[geckoId]?.usd;
    const change = data?.[geckoId]?.usd_24h_change;
    if (price == null) return null;
    const changeStr = change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '';
    return {
      label: `${asset} spot`,
      value: `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${changeStr}`.trim(),
      raw: price,
      change,
    };
  } catch {
    return null;
  }
}

// ── Tier 1: DeFiLlama stablecoin supply (free, no key) ─────────────────────

async function fetchStablecoinSupply() {
  try {
    const { data } = await fetchWithBudget(
      'https://stablecoins.llama.fi/stablecoincharts/all',
      { provider: 'defillama', timeoutMs: 6000, retries: 1, cacheTtlMs: CACHE_TTL },
    );
    const latest = data?.data?.slice(-1)?.[0];
    if (!latest) return null;
    const total = latest.totalCirculating?.USD;
    if (total == null) return null;
    const billions = (total / 1e9).toFixed(1);
    return {
      label: 'Stablecoin supply',
      value: `$${billions}B`,
      raw: total,
    };
  } catch {
    return null;
  }
}

// ── Tier 1: DeFiLlama total TVL (free, no key) ────────────────────────────

async function fetchDefiTvl() {
  try {
    const { data } = await fetchWithBudget(
      'https://api.llama.fi/v2/histo/totaltvl',
      { provider: 'defillama-tvl', timeoutMs: 6000, retries: 1, cacheTtlMs: CACHE_TTL },
    );
    const latest = Array.isArray(data) ? data[data.length - 1] : null;
    if (!latest?.tvl) return null;
    const billions = (latest.tvl / 1e9).toFixed(1);
    return {
      label: 'DeFi TVL',
      value: `$${billions}B`,
      raw: latest.tvl,
    };
  } catch {
    return null;
  }
}

// ── Tier 2: FRED economic indicators (free, key required) ─────────────────

const FRED_SERIES = {
  fedFunds: 'FEDFUNDS',
  cpi: 'CPIAUCSL',
  treasury10Y: 'DGS10',
  treasury2Y: 'DGS2',
};

async function fetchFredSeries(seriesId) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;
  try {
    const { data } = await fetchWithBudget(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`,
      { provider: 'fred', timeoutMs: 6000, retries: 1, cacheTtlMs: 10 * 60 * 1000 },
    );
    const obs = data?.observations?.[0];
    if (!obs) return null;
    return { date: obs.date, value: parseFloat(obs.value) };
  } catch {
    return null;
  }
}

async function fetchFedContext() {
  const [fedFunds, cpi, treasury10Y, treasury2Y] = await Promise.all([
    fetchFredSeries(FRED_SERIES.fedFunds),
    fetchFredSeries(FRED_SERIES.cpi),
    fetchFredSeries(FRED_SERIES.treasury10Y),
    fetchFredSeries(FRED_SERIES.treasury2Y),
  ]);

  const items = [];
  if (fedFunds) {
    items.push({
      label: 'Fed funds rate',
      value: `${fedFunds.value.toFixed(2)}%`,
      raw: fedFunds.value,
    });
  }
  if (cpi) {
    items.push({
      label: 'CPI (latest)',
      value: `${cpi.value.toFixed(1)}`,
      raw: cpi.value,
    });
  }
  if (treasury10Y && treasury2Y) {
    const spread = treasury10Y.value - treasury2Y.value;
    items.push({
      label: '2Y/10Y spread',
      value: `${spread.toFixed(2)}%`,
      raw: spread,
    });
  }
  return items.length > 0 ? items : null;
}

// ── Public API: getContextualData(marketTitle) ─────────────────────────────

/**
 * Returns 2-4 contextual data points relevant to the given market title.
 * Each point is { label, value, raw? }. If no data is available (all
 * sources unreachable), returns an empty array — never invents data.
 *
 * @param {string} marketTitle - the title of the currently displayed market
 * @returns {Promise<Array<{label: string, value: string, raw?: number}>>}
 */
export async function getContextualData(marketTitle) {
  if (!marketTitle) return [];

  const asset = detectAsset(marketTitle);
  const isCrypto = isCryptoRelated(marketTitle) || !!COINGECKO_ID[asset];
  const isFed = isFedRelated(marketTitle);
  const isDeFi = isDeFiRelated(marketTitle);

  const tasks = [];

  // Crypto context: spot price + Fear & Greed
  if (isCrypto) {
    if (COINGECKO_ID[asset]) tasks.push(fetchCoinGeckoPrice(asset));
    tasks.push(fetchFearGreed());
  }

  // DeFi context: TVL + stablecoin supply
  if (isDeFi) {
    tasks.push(fetchDefiTvl());
    tasks.push(fetchStablecoinSupply());
  }

  // Fed context: Fed funds rate, CPI, yield curve spread
  if (isFed) {
    tasks.push(fetchFedContext());
  }

  // If nothing matched, fall back to Fear & Greed as a general crypto
  // sentiment indicator — it's relevant to most prediction markets.
  if (tasks.length === 0) {
    tasks.push(fetchFearGreed());
  }

  const results = await Promise.allSettled(tasks);
  const items = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const value = result.value;
    if (Array.isArray(value)) {
      items.push(...value);
    } else if (value) {
      items.push(value);
    }
  }

  return items.slice(0, 4);
}

export { detectAsset, isCryptoRelated, isFedRelated, isDeFiRelated };
