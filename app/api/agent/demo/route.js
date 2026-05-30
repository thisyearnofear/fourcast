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
        { title: 'Will Bitcoin exceed $120K by June 30?', platform: 'polymarket' },
        { title: 'Will the Fed cut rates in June 2025?', platform: 'kalshi' },
        { title: 'Will SpaceX Starship complete orbital flight by July?', platform: 'polymarket' },
      ],
    },
  },

  // Phase 3: Forecast #1 - Bitcoin market with full Bright Data pipeline
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceed $120K by June 30?', marketID: 'demo-btc-120k' },
    message: 'Deep scanning with Bright Data intelligence...',
    index: 0,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceed $120K by June 30?', marketID: 'demo-btc-120k' },
    message: 'Deep research via Scraping Browser: CoinDesk...',
    index: 0,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceed $120K by June 30?', marketID: 'demo-btc-120k' },
    message: 'Extracted 23 evidence sentences (14,820 chars). Synthesizing...',
    index: 0,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will Bitcoin exceeds $120K by June 30?', marketID: 'demo-btc-120k' },
    message: 'Gathered 5 sources via SERP + Scraping Browser. Synthesizing with AI...',
    index: 0,
    total: 3,
    data: {
      sources: [
        { title: 'Bitcoin Price Surges Past $110K as Institutional Demand Grows', url: 'https://www.coindesk.com/markets/bitcoin-surge-110k', snippet: 'Bitcoin climbed above $110,000 for the first time, driven by sustained institutional inflows and favorable macroeconomic conditions.', source: 'CoinDesk', rank: 1 },
        { title: 'BTC Price Prediction: Can Bitcoin Reach $120K by Mid-2025?', url: 'https://www.bloomberg.com/crypto/btc-120k-prediction', snippet: 'Analysts at Goldman Sachs and JPMorgan project Bitcoin could reach $120,000-$130,000 by mid-2025 based on ETF inflow models.', source: 'Bloomberg', rank: 2 },
        { title: 'Bitcoin ETF Inflows Hit Record $2.4B in Single Week', url: 'https://www.reuters.com/technology/bitcoin-etf-record-inflows', snippet: 'Spot Bitcoin ETFs attracted $2.4 billion in net inflows last week, the highest weekly figure since their January launch.', source: 'Reuters', rank: 3 },
        { title: 'On-Chain Data Shows Long-Term Holders Accumulating', url: 'https://glassnode.com/insights/accumulation-trend', snippet: 'Glassnode data reveals long-term holder supply has increased by 180,000 BTC over the past 30 days, signaling strong conviction.', source: 'Glassnode', rank: 4 },
        { title: 'Fed Signals Potential Rate Cut, Risk Assets Rally', url: 'https://www.ft.com/content/fed-rate-cut-signals', snippet: 'Federal Reserve officials hinted at possible rate cuts in the coming months, boosting risk appetite across financial markets.', source: 'Financial Times', rank: 5 },
      ],
      deepResearch: {
        title: 'Bitcoin Price Surges Past $110K as Institutional Demand Grows',
        url: 'https://www.coindesk.com/markets/bitcoin-surge-110k',
        charCount: 14820,
        sentenceCount: 23,
        product: 'Scraping Browser',
      },
      productsUsed: { serp: true, scrapingBrowser: true, webUnlocker: false },
    },
  },
  {
    step: 'forecast',
    status: 'complete',
    market: {
      title: 'Will Bitcoin exceed $120K by June 30?',
      marketID: 'demo-btc-120k',
      aiProbability: 0.72,
      currentOdds: { yes: 0.58, no: 0.42 },
      source: 'brightdata+research',
    },
  },

  // Phase 4: Forecast #2 - Fed rates with SERP only
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will the Fed cut rates in June 2025?', marketID: 'demo-fed-rates' },
    message: 'Deep scanning with Bright Data intelligence...',
    index: 1,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will the Fed cut rates in June 2025?', marketID: 'demo-fed-rates' },
    message: 'Gathered 5 sources via SERP + Web Unlocker. Synthesizing with AI...',
    index: 1,
    total: 3,
    data: {
      sources: [
        { title: 'Fed Officials Split on June Rate Cut Decision', url: 'https://www.wsj.com/economy/fed-rate-cut-june', snippet: 'Federal Reserve officials are divided on whether to cut interest rates at the June meeting, with inflation data still above target.', source: 'Wall Street Journal', rank: 1 },
        { title: 'CPI Data Shows Inflation Cooling to 2.8%', url: 'https://www.bls.gov/news.release/cpi.nr0.htm', snippet: 'The Consumer Price Index rose 2.8% year-over-year, down from 3.2% in the prior month, bringing the Fed closer to its 2% target.', source: 'Bureau of Labor Statistics', rank: 2 },
        { title: 'CME FedWatch Tool: 68% Probability of June Cut', url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html', snippet: 'Fed funds futures pricing indicates a 68% probability of a 25 basis point rate cut at the June FOMC meeting.', source: 'CME Group', rank: 3 },
      ],
      deepResearch: {
        title: 'Fed Officials Split on June Rate Cut Decision',
        url: 'https://www.wsj.com/economy/fed-rate-cut-june',
        charCount: 8340,
        sentenceCount: null,
        product: 'Web Unlocker',
      },
      productsUsed: { serp: true, scrapingBrowser: false, webUnlocker: true },
    },
  },
  {
    step: 'forecast',
    status: 'complete',
    market: {
      title: 'Will the Fed cut rates in June 2025?',
      marketID: 'demo-fed-rates',
      aiProbability: 0.65,
      currentOdds: { yes: 0.68, no: 0.32 },
      source: 'brightdata+research',
    },
  },

  // Phase 5: Forecast #3 - SpaceX with SERP only (no deep research)
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will SpaceX Starship complete orbital flight by July?', marketID: 'demo-spacex' },
    message: 'Deep scanning with Bright Data intelligence...',
    index: 2,
    total: 3,
  },
  {
    step: 'forecast',
    status: 'running',
    market: { title: 'Will SpaceX Starship complete orbital flight by July?', marketID: 'demo-spacex' },
    message: 'Gathered 4 sources via SERP. Synthesizing with AI...',
    index: 2,
    total: 3,
    data: {
      sources: [
        { title: 'SpaceX Starship IFT-6 Success Paves Way for Orbital Attempt', url: 'https://www.spacenews.com/starship-ift-6-success', snippet: 'SpaceX successfully completed its sixth integrated flight test, achieving key milestones needed for an orbital attempt.', source: 'SpaceNews', rank: 1 },
        { title: 'FAA Clears SpaceX for Accelerated Starship Launch Cadence', url: 'https://www.faa.gov/spacex-starship-license', snippet: 'The FAA has granted SpaceX a modified license allowing up to 12 Starship launches per year from Boca Chica.', source: 'FAA', rank: 2 },
        { title: 'Musk: Orbital Flight Attempt Targeted for Q2 2025', url: 'https://twitter.com/elonmusk/starship-orbital', snippet: 'Elon Musk confirmed SpaceX is targeting an orbital flight attempt in Q2 2025, pending successful booster recovery.', source: 'X/Twitter', rank: 3 },
      ],
      productsUsed: { serp: true, scrapingBrowser: false, webUnlocker: false },
    },
  },
  {
    step: 'forecast',
    status: 'complete',
    market: {
      title: 'Will SpaceX Starship complete orbital flight by July?',
      marketID: 'demo-spacex',
      aiProbability: 0.45,
      currentOdds: { yes: 0.38, no: 0.62 },
      source: 'brightdata+llm',
    },
  },

  // Phase 6: Edge detection
  {
    step: 'edge',
    status: 'running',
    message: 'Calculating edges...',
  },
  {
    step: 'edge',
    status: 'complete',
    message: '3 recommendations generated',
    data: {
      recommendations: [
        { title: 'Will Bitcoin exceed $120K by June 30?', direction: 'BUY YES', edge: 0.14, confidence: 'HIGH' },
        { title: 'Will the Fed cut rates in June 2025?', direction: 'BUY NO', edge: -0.03, confidence: 'LOW' },
        { title: 'Will SpaceX Starship complete orbital flight by July?', direction: 'BUY YES', edge: 0.07, confidence: 'MEDIUM' },
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
