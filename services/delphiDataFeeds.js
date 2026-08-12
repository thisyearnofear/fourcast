/**
 * Delphi Data Feeds — deterministic public-data intelligence.
 *
 * Some prediction markets resolve to published public numbers (SILSO sunspot
 * number, NSIDC sea-ice extent, official weather observations). For those,
 * the correct "forecast" is a lookup, not a model opinion: near resolution
 * the answer is often already public while the market still prices it at
 * 0.85 — that gap is the cleanest edge available to this agent.
 *
 * Feeds LToS (last-to-settle mapping):
 * - sunspot/silso        → SILSO EISN daily file (Royal Observatory of Belgium)
 * - sea ice/nsidc        → NSIDC Sea Ice Index v4 daily CSV
 * - airport/°C weather   → Open-Meteo hourly (observed past days + forecast)
 *
 * Every feed returns null when the question doesn't parse or data is
 * unavailable — the caller falls back to the LLM router. Deterministic
 * (published-value) answers return confidence HIGH; extrapolations MEDIUM.
 */

if (typeof window !== 'undefined') {
  throw new Error('delphiDataFeeds is server-only');
}

// ─── Tiny HTTP cache ────────────────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchText(url, { rangeBytes, ttlMs = CACHE_TTL_MS } = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.text;
  const headers = rangeBytes ? { Range: `bytes=-${rangeBytes}` } : {};
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok && res.status !== 206) throw new Error(`fetch ${url} -> ${res.status}`);
  const text = await res.text();
  cache.set(url, { ts: Date.now(), text });
  return text;
}

// ─── Math helpers ───────────────────────────────────────────────────────────

/** Normal CDF via Abramowitz & Stegun 7.1.26 erf approximation. */
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z / Math.SQRT2));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

const clamp = (p, lo = 0.01, hi = 0.99) => Math.min(hi, Math.max(lo, p));

// ─── Question parsing ───────────────────────────────────────────────────────

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Extracts 'YYYY-MM-DD' from "2026-08-12" or "Aug 13, 2026" style text. */
function extractDateISO(question) {
  const iso = question.match(/(20\d\d)-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const nat = question.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(20\d\d)/);
  if (nat) return `${nat[3]}-${String(MONTHS[nat[1]]).padStart(2, '0')}-${nat[2].padStart(2, '0')}`;
  return null;
}

/** Extracts { value, comparator } from threshold phrasings. */
function extractCondition(question) {
  const q = question.toLowerCase();
  let m = q.match(/exactly\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { value: Number(m[1]), comparator: 'exact' };
  m = q.match(/below\s*(-?\d+(?:\.\d+)?)/) || q.match(/under\s*(-?\d+(?:\.\d+)?)/) || q.match(/less than\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { value: Number(m[1]), comparator: 'lt' };
  m = q.match(/(-?\d+(?:\.\d+)?)\s*or\s*(?:higher|greater|more)/) || q.match(/at least\s*(-?\d+(?:\.\d+)?)/) || q.match(/above\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { value: Number(m[1]), comparator: 'gte' };
  return null;
}

/** Build Yes/No probabilities for a binary market; null for multi-outcome. */
function binaryProbabilities(market, pYes) {
  if (market.outcomes.length !== 2) return null;
  const idx = market.outcomes.findIndex((o) => /^(yes|true)$/i.test(typeof o === 'string' ? o : o.name || ''));
  const yesIdx = idx === -1 ? 0 : idx;
  const out = new Array(2);
  out[yesIdx] = pYes;
  out[1 - yesIdx] = 1 - pYes;
  return out;
}

// ─── Source fetchers ────────────────────────────────────────────────────────

/**
 * SILSO EISN daily sunspot numbers. Format: year month day yearfrac EISN std N1 N2
 * Returns map 'YYYY-MM-DD' -> number.
 */
async function getSunspotNumbers() {
  const text = await fetchText('https://www.sidc.be/SILSO/DATA/EISN/EISN_current.txt');
  const map = new Map();
  for (const line of text.trim().split('\n')) {
    const c = line.trim().split(/\s+/);
    if (c.length < 5 || !/^20\d\d$/.test(c[0])) continue;
    const v = Number(c[4]);
    if (Number.isFinite(v) && v >= 0) map.set(`${c[0]}-${c[1].padStart(2, '0')}-${c[2].padStart(2, '0')}`, v);
  }
  return map;
}

/**
 * NSIDC Sea Ice Index v4 daily (northern hemisphere). CSV rows:
 * year, month, day, extent, missing, source-files
 * Returns map 'YYYY-MM-DD' -> extent (million km²).
 */
async function getSeaIceExtent() {
  const text = await fetchText(
    'https://noaadata.apps.nsidc.org/NOAA/G02135/north/daily/data/N_seaice_extent_daily_v4.0.csv',
    { ttlMs: 60 * 60 * 1000 } // big file (~2MB), slow-moving — hourly cache
  );
  const map = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(20\d\d),\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d+\.\d+)/);
    if (m) map.set(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, Number(m[4]));
  }
  return map;
}

/** Open-Meteo hourly temps for a coordinate over a date (local timezone). */
async function getDailyTempHours(lat, lon, dateISO, timezone) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m&past_days=3&forecast_days=2&timezone=${encodeURIComponent(timezone)}`;
  const data = JSON.parse(await fetchText(url));
  const hours = [];
  (data.hourly?.time || []).forEach((t, i) => {
    if (t.startsWith(dateISO)) hours.push(data.hourly.temperature_2m[i]);
  });
  return hours.filter((v) => typeof v === 'number');
}

// ─── Trend extrapolation ────────────────────────────────────────────────────

/** Extrapolate one series one-ish day: mean drift + per-day sigma → prob of condition. */
function extrapolateProbability(valuesByDate, dateISO, cond) {
  const entries = [...valuesByDate.entries()].sort();
  if (entries.length < 8) return null;
  const recent = entries.slice(-8);
  const target = new Date(dateISO + 'T00:00:00Z').getTime();
  const [lastDate, lastVal] = recent[recent.length - 1];
  const daysAhead = (target - new Date(lastDate + 'T00:00:00Z').getTime()) / 86_400_000;
  if (daysAhead < -1 || daysAhead > 3) return null; // too stale / too far — don't guess

  const deltas = recent.slice(1).map(([, v], i) => v - recent[i][1]);
  const drift = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  const sigma = Math.max(1e-9, Math.sqrt(deltas.reduce((s, d) => s + (d - drift) ** 2, 0) / deltas.length));
  const predicted = lastVal + drift * Math.max(0.5, daysAhead);
  const daySigma = sigma * Math.sqrt(Math.max(0.5, daysAhead));

  let p;
  if (cond.comparator === 'gte') p = 1 - normCdf((cond.value - predicted) / daySigma);
  else if (cond.comparator === 'lt') p = normCdf((cond.value - predicted) / daySigma);
  else p = clamp(Math.exp(-Math.abs(cond.value - predicted) / daySigma) * 0.5, 0.02, 0.6); // exact — inherently low
  return { p: clamp(p), predicted, sigma: daySigma, asOf: lastDate, daysAhead };
}

// ─── Feed estimators ────────────────────────────────────────────────────────

async function sunspotEstimate(market) {
  const dateISO = extractDateISO(market.question);
  const cond = extractCondition(market.question);
  if (!dateISO || !cond) return null;

  const series = await getSunspotNumbers();
  if (series.size === 0) return null;

  const published = series.get(dateISO);
  if (published != null) {
    const yes = cond.comparator === 'gte' ? published >= cond.value : cond.comparator === 'lt' ? published < cond.value : Math.round(published) === cond.value;
    const pYes = yes ? 0.985 : 0.015;
    return {
      probabilities: binaryProbabilities(market, pYes),
      confidence: 'HIGH',
      source: 'datafeed:silso_eisn',
      reasoning: `SILSO EISN for ${dateISO} is already published: ${published} (condition: ${cond.comparator} ${cond.value}) → outcome known.`,
      dataValue: published,
    };
  }

  const ext = extrapolateProbability(series, dateISO, cond);
  if (!ext) return null;
  return {
    probabilities: binaryProbabilities(market, ext.p),
    confidence: 'MEDIUM',
    source: 'datafeed:silso_eisn_extrap',
    reasoning: `SILSO EISN not published for ${dateISO} yet (latest ${ext.asOf}). Extrapolated ${ext.predicted.toFixed(1)} ± ${ext.sigma.toFixed(1)} vs condition ${cond.comparator} ${cond.value} → p(yes)=${ext.p.toFixed(2)}.`,
  };
}

async function seaIceEstimate(market) {
  const dateISO = extractDateISO(market.question);
  const cond = extractCondition(market.question);
  if (!dateISO || !cond) return null;

  const series = await getSeaIceExtent();
  if (series.size === 0) return null;

  const published = series.get(dateISO);
  if (published != null) {
    const yes = cond.comparator === 'gte' ? published >= cond.value : cond.comparator === 'lt' ? published < cond.value : Math.abs(published - cond.value) < 1e-9;
    const pYes = yes ? 0.985 : 0.015;
    return {
      probabilities: binaryProbabilities(market, pYes),
      confidence: 'HIGH',
      source: 'datafeed:nsidc_seaice',
      reasoning: `NSIDC Sea Ice Index v4 for ${dateISO} is already published: ${published} M km² (condition: ${cond.comparator} ${cond.value}) → outcome known.`,
      dataValue: published,
    };
  }

  const ext = extrapolateProbability(series, dateISO, cond);
  if (!ext) return null;
  return {
    probabilities: binaryProbabilities(market, ext.p),
    confidence: 'MEDIUM',
    source: 'datafeed:nsidc_seaice_extrap',
    reasoning: `NSIDC extent not published for ${dateISO} yet (latest ${ext.asOf}: ${[...series.values()].slice(-1)[0]} M km²). Trend → ${ext.predicted.toFixed(3)} ± ${ext.sigma.toFixed(3)} vs ${cond.comparator} ${cond.value} → p(yes)=${ext.p.toFixed(2)}.`,
  };
}

// Known weather stations (ICAO -> coords + timezone); extend as board rotates.
const WEATHER_STATIONS = {
  NZWN: { name: 'Wellington Airport', lat: -41.3272, lon: 174.8053, tz: 'Pacific/Auckland' },
};

async function weatherEstimate(market) {
  const icao = (market.question.match(/\(([A-Z]{4})\)/) || [])[1];
  const station = WEATHER_STATIONS[icao];
  if (!station) return null;
  const dateISO = extractDateISO(market.question);
  const cond = extractCondition(market.question);
  if (!dateISO || !cond) return null;

  const hours = await getDailyTempHours(station.lat, station.lon, dateISO, station.tz);
  if (hours.length === 0) return null;

  const maxTemp = Math.max(...hours);
  const fullDay = hours.length >= 23;
  // Open-Meteo is model/reanalysis on a grid — allow ±1°C station-vs-grid error,
  // so even a "known" day caps at 0.85 for exact-match questions.
  let pYes;
  if (cond.comparator === 'exact') {
    const diff = Math.abs(Math.round(maxTemp) - cond.value);
    pYes = diff === 0 ? (fullDay ? 0.55 : 0.4) : diff === 1 ? 0.12 : 0.02;
  } else if (cond.comparator === 'gte') {
    pYes = maxTemp >= cond.value ? (fullDay ? 0.9 : 0.65) : cond.value - maxTemp <= 0.5 && !fullDay ? 0.35 : 0.05;
  } else {
    pYes = maxTemp < cond.value ? (fullDay ? 0.9 : 0.65) : 0.05;
  }
  return {
    probabilities: binaryProbabilities(market, clamp(pYes)),
    confidence: 'MEDIUM',
    source: 'datafeed:openmeteo',
    reasoning: `${station.name} (${icao}) ${dateISO}: ${fullDay ? 'observed' : 'partial-day'} hourly model max ${maxTemp.toFixed(1)}°C from ${hours.length}h of data vs condition ${cond.comparator} ${cond.value}. Model grid vs station gauge ±1°C uncertainty.`,
    dataValue: maxTemp,
  };
}

// ─── Entry Point ────────────────────────────────────────────────────────────

/**
 * Try to answer a market from deterministic public data.
 * @returns estimate object or null (caller falls back to LLM router)
 */
export async function estimateFromDataFeed(market) {
  const q = (market.question || '').toLowerCase();
  try {
    if (/sunspot|silso/.test(q)) return await sunspotEstimate(market);
    if (/sea ice|nsidc/.test(q)) return await seaIceEstimate(market);
    if (/airport|daily high|°c|°f|weather|temperature/.test(q)) return await weatherEstimate(market);
    // Typhoon/cyclone feeds (JMA/JTWC machine-readable) — TODO: no verified
    // endpoint yet; markets fall through to the LLM router for now.
    return null;
  } catch (err) {
    console.warn(`[datafeeds] feed failed (${err.message.slice(0, 100)}) — falling back to LLM`);
    return null;
  }
}

export default { estimateFromDataFeed };
