/**
 * MCP (Model Context Protocol) Server endpoint.
 * Exposes Fourcast's Bright Data intelligence pipeline as MCP tools,
 * allowing AI agents (Claude, Cursor, LangChain, CrewAI) to query
 * live web data and market intelligence directly.
 *
 * Tools exposed:
 *  - search_web: Bright Data SERP API for structured search results
 *  - scrape_page: Bright Data Scraping Browser for JS-rendered pages
 *  - analyze_market: Full intelligence pipeline (SERP + scrape + AI synthesis)
 *  - get_market_odds: Live prediction market odds from Polymarket/Kalshi
 */

export const runtime = 'nodejs';

const TOOLS = [
  {
    name: 'search_web',
    description: 'Search the live web via Bright Data SERP API. Returns structured Google results with organic listings, knowledge panels, and People Also Ask data. Bypasses rate limits and bot detection.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        country: { type: 'string', description: 'Country code (default: us)', default: 'us' },
      },
      required: ['query'],
    },
  },
  {
    name: 'scrape_page',
    description: 'Scrape a JavaScript-rendered web page via Bright Data Scraping Browser. Handles CAPTCHAs, bot detection, and geo-blocks. Returns extracted text content with informative sentences.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to scrape' },
      },
      required: ['url'],
    },
  },
  {
    name: 'analyze_market',
    description: 'Run the full Fourcast intelligence pipeline on a prediction market question. Uses Bright Data SERP API + Scraping Browser + Web Unlocker to gather evidence, then synthesizes with AI to produce a probability estimate and edge detection.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Market question to analyze (e.g., "Will Bitcoin exceed $150K by August 2026?")' },
        market_odds: { type: 'number', description: 'Current market probability (0-1) to compare against', default: null },
      },
      required: ['question'],
    },
  },
  {
    name: 'get_market_odds',
    description: 'Get live prediction market odds from Polymarket and Kalshi. Returns current prices, volume, and market metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for finding markets' },
        platform: { type: 'string', enum: ['polymarket', 'kalshi', 'both'], default: 'both' },
      },
      required: ['query'],
    },
  },
];

async function handleInitialize() {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'fourcast-intelligence',
      version: '1.0.0',
      description: 'Prediction market intelligence powered by Bright Data live web scraping',
    },
  };
}

async function handleToolsList() {
  return { tools: TOOLS };
}

async function handleToolCall(name, args) {
  switch (name) {
    case 'search_web': {
      const { brightDataService } = await import('@/services/brightDataService.js');
      if (!brightDataService.isAvailable()) {
        return { content: [{ type: 'text', text: 'Bright Data SERP API not configured. Set BRIGHT_DATA_API_KEY and BRIGHT_DATA_SERP_ZONE.' }], isError: true };
      }
      const results = await brightDataService.search(args.query, { gl: args.country || 'us' });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: args.query,
            results: (results.organic || []).slice(0, 8).map(r => ({
              title: r.title,
              url: r.link,
              snippet: r.description,
              source: r.source,
            })),
            knowledge: results.knowledge || null,
            people_also_ask: results.people_also_ask || [],
            powered_by: 'Bright Data SERP API',
          }, null, 2),
        }],
      };
    }

    case 'scrape_page': {
      const { brightDataService } = await import('@/services/brightDataService.js');
      if (!brightDataService.sbrEnabled && !brightDataService.unlockerEnabled) {
        return { content: [{ type: 'text', text: 'Bright Data Scraping Browser / Web Unlocker not configured.' }], isError: true };
      }

      let result;
      if (brightDataService.sbrEnabled) {
        result = await brightDataService.scrapeWithBrowser(args.url);
      } else {
        result = await brightDataService.fetchWithUnlocker(args.url);
      }

      if (!result) {
        return { content: [{ type: 'text', text: `Failed to scrape ${args.url}` }], isError: true };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            url: result.url || args.url,
            title: result.title || null,
            content: (result.text || result.content || '').slice(0, 12000),
            charCount: result.charCount || (result.content || '').length,
            sentenceCount: result.sentenceCount || null,
            powered_by: brightDataService.sbrEnabled ? 'Bright Data Scraping Browser' : 'Bright Data Web Unlocker',
          }, null, 2),
        }],
      };
    }

    case 'analyze_market': {
      const { MarketIntelligenceAnalyzer } = await import('@/services/analysis/MarketIntelligenceAnalyzer.js');
      const analyzer = new MarketIntelligenceAnalyzer();

      const context = {
        title: args.question,
        description: args.question,
        currentOdds: args.market_odds ? { yes: args.market_odds } : null,
      };

      const enriched = await analyzer.enrichContext(context);
      let aiResult = null;

      if (enriched.intelligenceData) {
        try {
          aiResult = await analyzer.forecastProbability(enriched);
        } catch {
          // AI synthesis optional — return web data even if LLM fails
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            question: args.question,
            market_odds: args.market_odds || null,
            web_intelligence: enriched.intelligenceData ? {
              sources: enriched.intelligenceData.topResults || [],
              deep_research: enriched.intelligenceData.deepResearch ? {
                title: enriched.intelligenceData.deepResearch.title,
                url: enriched.intelligenceData.deepResearch.url,
                charCount: enriched.intelligenceData.deepResearch.charCount,
              } : null,
              product_used: enriched.intelligenceData.deepResearchProduct || 'SERP API',
            } : { error: 'Bright Data not configured' },
            ai_forecast: aiResult ? {
              probability: aiResult.probability,
              confidence: aiResult.confidence,
              edge: aiResult.edge,
              reasoning: aiResult.reasoning,
            } : null,
            powered_by: 'Bright Data SERP API + Scraping Browser + Web Unlocker + AI synthesis',
          }, null, 2),
        }],
      };
    }

    case 'get_market_odds': {
      const { polymarketService } = await import('@/services/polymarketService.js');
      const { kalshiService } = await import('@/services/kalshiService.js');

      const results = { polymarket: [], kalshi: [] };
      const platform = args.platform || 'both';

      if (platform === 'polymarket' || platform === 'both') {
        try {
          const markets = await polymarketService.getAllMarkets();
          const filtered = (markets || [])
            .filter(m => (m.question || m.title || '').toLowerCase().includes(args.query.toLowerCase()))
            .slice(0, 5);
          results.polymarket = filtered.map(m => ({
            title: m.question || m.title,
            price_yes: m.outcomePrices?.[0] || m.yes_price,
            price_no: m.outcomePrices?.[1] || m.no_price,
            volume: m.volume,
            end_date: m.end_date_iso || m.endDate,
          }));
        } catch { /* polymarket unavailable */ }
      }

      if (platform === 'kalshi' || platform === 'both') {
        try {
          const markets = await kalshiService.getMarketsByCategory('all', 50);
          const filtered = (markets || [])
            .filter(m => (m.title || '').toLowerCase().includes(args.query.toLowerCase()))
            .slice(0, 5);
          results.kalshi = filtered.map(m => ({
            title: m.title,
            price_yes: m.yes_price || m.last_price,
            price_no: m.no_price,
            volume: m.volume,
            end_date: m.expiration_time,
          }));
        } catch { /* kalshi unavailable */ }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: args.query,
            ...results,
            total_markets: results.polymarket.length + results.kalshi.length,
          }, null, 2),
        }],
      };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { method, params, id } = body;

    let result;

    switch (method) {
      case 'initialize':
        result = await handleInitialize();
        break;
      case 'tools/list':
        result = await handleToolsList();
        break;
      case 'tools/call':
        result = await handleToolCall(params.name, params.arguments || {});
        break;
      default:
        return Response.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
    }

    return Response.json({
      jsonrpc: '2.0',
      id,
      result,
    });
  } catch (err) {
    return Response.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: err.message },
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    name: 'fourcast-intelligence',
    version: '1.0.0',
    description: 'MCP Server for prediction market intelligence powered by Bright Data',
    protocol: 'MCP 2024-11-05',
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
    bright_data_products: ['SERP API', 'Scraping Browser', 'Web Unlocker'],
    usage: 'POST JSON-RPC requests to this endpoint. Compatible with Claude, Cursor, LangChain, and CrewAI MCP clients.',
  });
}
