/**
 * Demo endpoint for hackathon presentations.
 * Streams a realistic pre-recorded agent run showing the full Bright Data
 * intelligence pipeline: SERP API -> Scraping Browser -> Web Unlocker -> AI synthesis.
 *
 * Works without any API keys. Use for live demos, screenshots, or video recordings.
 *
 * Usage: POST /api/agent/demo  (no body required)
 */

export const runtime = 'nodejs';

const DEMO_DELAY_MS = 800; // Pause between steps for visual effect

const DEMO_MARKET_SUMMARY = {
  market: {
    title: 'Will Bitcoin exceed $150K by August 2026?',
    marketID: 'demo-btc-150k',
    platform: 'Polymarket',
    currentProbability: 0.42,
    fairProbability: 0.58,
    edge: 0.16,
    direction: 'BUY YES',
    confidence: 'HIGH',
    source: 'brightdata+research',
  },
  venues: [
    { name: 'Polymarket', price: 0.42, depth: '$1.8M', status: 'primary fill' },
    { name: 'Kalshi', price: 0.46, depth: '$920K', status: 'cross-check' },
  ],
  evidence: [
    { label: 'ETF inflows', value: 'record $3.1B weekly flow', source: 'Reuters via Bright Data SERP' },
    { label: 'Institutional demand', value: 'spot bid holding above $130K', source: 'CoinDesk via Scraping Browser' },
    { label: 'Macro setup', value: 'rate-cut cycle supporting risk assets', source: 'Financial Times via Web Unlocker' },
  ],
  stats: [
    { value: '24', label: 'markets scanned' },
    { value: '5', label: 'candidates found' },
    { value: '1', label: 'trade ready' },
  ],
  productsUsed: ['SERP API', 'Scraping Browser', 'Web Unlocker', 'AI synthesis'],
  updatedAt: 'demo',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Realistic demo data showing a prediction market intelligence workflow
const DEMO_STEPS = [
  // Phase 1: Discovery
  {
    step: 'discover',
    status: 'running',
    message: 'Scanning Polymarket and Kalshi for active markets...',
  },
  {
    step: 'discover',
    status: 'complete',
    message: 'Found 24 active markets across both platforms',
    data: { polymarket: 18, kalshi: 6 },
  },

  // Phase 2: Filtering
  {
    step: 'filter',
    status: 'running',
    message: 'Filtering by volume and relevance...',
  },
  {
    step: 'filter',
    status: 'complete',
    message: '5 high-conviction candidates identified',
    data: {
      candidates: [
        { title: 'Will Bitcoin exceed $150K by August 2026?', platform: 'polymarket' },
        { title: 'Will the Fed cut rates in July 2026?', platform: 'kalshi' },
        { title: 'Will SpaceX Starship complete Mars cargo mission by Q4 2026?', platform: 'polymarket' },
      ],
    },
  },

  // Phase 3: Forecast #1 - Bitcoin market with full Bright Data pipeline
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceed $150K by August 2026?', marketID: 'demo-btc-150k' },
    message: 'Querying Bright Data SERP API for live market intelligence...',
    index: 0,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceed $150K by August 2026?', marketID: 'demo-btc-150k' },
    message: 'Deep research via Bright Data Scraping Browser: rendering CoinDesk JS page...',
    index: 0,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceed $150K by August 2026?', marketID: 'demo-btc-150k' },
    message: 'Extracted 27 evidence sentences (16,420 chars) from Scraping Browser. Synthesizing...',
    index: 0,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceed $150K by August 2026?', marketID: 'demo-btc-150k' },
    message: 'Gathered 5 sources via SERP API + Scraping Browser. Synthesizing with AI...',
    index: 0,
    total: 3,
    data: {
      sources: [
        { title: 'Bitcoin Rallies Past $130K as ETF Demand Accelerates', url: 'https://www.coindesk.com/markets/bitcoin-rally-130k', snippet: 'Bitcoin surged above $130,000 as spot ETF inflows reached $3.1B in a single week, with institutional allocators increasing targets.', source: 'CoinDesk', rank: 1 },
        { title: 'BTC Price Outlook: $150K Target in Sight for Summer 2026', url: 'https://www.bloomberg.com/crypto/btc-150k-outlook', snippet: 'Analysts at major banks project Bitcoin could reach $150,000-$170,000 by mid-2026 based on sustained demand and halving supply dynamics.', source: 'Bloomberg', rank: 2 },
        { title: 'Bitcoin ETF Inflows Hit Record $3.1B in Single Week', url: 'https://www.reuters.com/technology/bitcoin-etf-record-inflows-2026', snippet: 'Spot Bitcoin ETFs attracted $3.1 billion in net inflows last week, the highest weekly figure since inception.', source: 'Reuters', rank: 3 },
        { title: 'On-Chain Data Shows Accumulation Trend Strengthening', url: 'https://glassnode.com/insights/accumulation-2026', snippet: 'Glassnode data reveals long-term holder supply has increased by 220,000 BTC over the past 30 days, signaling record conviction.', source: 'Glassnode', rank: 4 },
        { title: 'Fed Rate-Cut Cycle Boosting Risk Assets Across the Board', url: 'https://www.ft.com/content/fed-rate-cut-cycle-2026', snippet: 'The Federal Reserve\'s ongoing rate-cut cycle has boosted risk appetite, with crypto and equities reaching new highs.', source: 'Financial Times', rank: 5 },
      ],
      deepResearch: {
        title: 'Bitcoin Rallies Past $130K as ETF Demand Accelerates',
        url: 'https://www.coindesk.com/markets/bitcoin-rally-130k',
        charCount: 16420,
        sentenceCount: 27,
        product: 'Scraping Browser',
      },
      productsUsed: { serp: true, scrapingBrowser: true, webUnlocker: false },
    },
  },
  {
    step: 'forecast',
    status: 'complete',
    market: {
      title: 'Will Bitcoin exceed $150K by August 2026?',
      marketID: 'demo-btc-150k',
      aiProbability: 0.58,
      currentOdds: { yes: 0.42, no: 0.58 },
      source: 'brightdata+research',
    },
  },

  // Phase 4: Forecast #2 - Fed rates with SERP + Web Unlocker
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will the Fed cut rates in July 2026?', marketID: 'demo-fed-rates' },
    message: 'Querying Bright Data SERP API for Fed policy intelligence...',
    index: 1,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will the Fed cut rates in July 2026?', marketID: 'demo-fed-rates' },
    message: 'WSJ blocked standard access — bypassing via Bright Data Web Unlocker...',
    index: 1,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will the Fed cut rates in July 2026?', marketID: 'demo-fed-rates' },
    message: 'Gathered 5 sources via SERP API + Web Unlocker. Synthesizing with AI...',
    index: 1,
    total: 3,
    data: {
      sources: [
        { title: 'Fed Officials Signal Further Easing in Q3 2026', url: 'https://www.wsj.com/economy/fed-rate-cut-july-2026', snippet: 'Federal Reserve officials signaled another quarter-point cut is likely at the July meeting, citing sustained progress on inflation.', source: 'Wall Street Journal', rank: 1 },
        { title: 'CPI Data Shows Inflation at 2.1%, Nearing Target', url: 'https://www.bls.gov/news.release/cpi.nr0.htm', snippet: 'The Consumer Price Index rose 2.1% year-over-year, the lowest reading since 2021, solidifying rate-cut expectations.', source: 'Bureau of Labor Statistics', rank: 2 },
        { title: 'CME FedWatch Tool: 74% Probability of July Cut', url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html', snippet: 'Fed funds futures pricing indicates a 74% probability of a 25 basis point rate cut at the July 2026 FOMC meeting.', source: 'CME Group', rank: 3 },
      ],
      deepResearch: {
        title: 'Fed Officials Signal Further Easing in Q3 2026',
        url: 'https://www.wsj.com/economy/fed-rate-cut-july-2026',
        charCount: 9120,
        sentenceCount: 18,
        product: 'Web Unlocker',
      },
      productsUsed: { serp: true, scrapingBrowser: false, webUnlocker: true },
    },
  },
  {
    step: 'forecast',
    status: 'complete',
    market: {
      title: 'Will the Fed cut rates in July 2026?',
      marketID: 'demo-fed-rates',
      aiProbability: 0.71,
      currentOdds: { yes: 0.74, no: 0.26 },
      source: 'brightdata+research',
    },
  },

  // Phase 5: Forecast #3 - SpaceX with SERP only
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will SpaceX Starship complete Mars cargo mission by Q4 2026?', marketID: 'demo-spacex' },
    message: 'Querying Bright Data SERP API for SpaceX launch intelligence...',
    index: 2,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will SpaceX Starship complete Mars cargo mission by Q4 2026?', marketID: 'demo-spacex' },
    message: 'Gathered 4 sources via SERP API. Synthesizing with AI...',
    index: 2,
    total: 3,
    data: {
      sources: [
        { title: 'SpaceX Confirms Mars Cargo Window for Late 2026', url: 'https://www.spacenews.com/starship-mars-cargo-2026', snippet: 'SpaceX confirmed it is targeting the October 2026 Mars transfer window for its first uncrewed Starship cargo mission.', source: 'SpaceNews', rank: 1 },
        { title: 'FAA Grants SpaceX Extended Starship Launch License', url: 'https://www.faa.gov/spacex-starship-2026-license', snippet: 'The FAA has expanded SpaceX\'s launch license to include interplanetary mission profiles from Boca Chica.', source: 'FAA', rank: 2 },
        { title: 'Musk: Mars Cargo Mission on Track After IFT-9 Success', url: 'https://x.com/elonmusk/status/starship-mars', snippet: 'Elon Musk confirmed the Mars cargo timeline remains on track following the successful ninth integrated flight test.', source: 'X/Twitter', rank: 3 },
      ],
      productsUsed: { serp: true, scrapingBrowser: false, webUnlocker: false },
    },
  },
  {
    step: 'forecast',
    status: 'complete',
    market: {
      title: 'Will SpaceX Starship complete Mars cargo mission by Q4 2026?',
      marketID: 'demo-spacex',
      aiProbability: 0.32,
      currentOdds: { yes: 0.25, no: 0.75 },
      source: 'brightdata+llm',
    },
  },

  // Phase 6: Edge detection
  {
    step: 'edge',
    status: 'running',
    message: 'Calculating edges across all Bright Data-enriched forecasts...',
  },
  {
    step: 'edge',
    status: 'complete',
    message: '3 recommendations generated from live web intelligence',
    data: {
      recommendations: [
        { title: 'Will Bitcoin exceed $150K by August 2026?', direction: 'BUY YES', edge: 0.16, confidence: 'HIGH', brightDataProducts: ['SERP API', 'Scraping Browser'] },
        { title: 'Will the Fed cut rates in July 2026?', direction: 'BUY NO', edge: -0.03, confidence: 'LOW', brightDataProducts: ['SERP API', 'Web Unlocker'] },
        { title: 'Will SpaceX Starship complete Mars cargo mission by Q4 2026?', direction: 'BUY YES', edge: 0.07, confidence: 'MEDIUM', brightDataProducts: ['SERP API'] },
      ],
    },
  },

  // Phase 7: Execution
  {
    step: 'execute',
    status: 'running',
    message: 'Executing trades...',
  },
  {
    step: 'execute',
    status: 'complete',
    message: 'Agent run complete',
    data: { executed: 1, failed: 0, skipped: 2 },
  },
];

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const step of DEMO_STEPS) {
        controller.enqueue(encoder.encode(JSON.stringify(step) + '\n'));
        await sleep(DEMO_DELAY_MS);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET() {
  return Response.json(DEMO_MARKET_SUMMARY, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
