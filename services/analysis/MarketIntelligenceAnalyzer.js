import { EdgeAnalyzer } from './EdgeAnalyzer.js';
import { brightDataService } from '../brightDataService.js';
import OpenAI from 'openai';

/**
 * MarketIntelligenceAnalyzer - Uses Bright Data to gather deep "ground truth"
 * for high-conviction forecasting.
 *
 * Integration points:
 *  - SERP API: real-time search intelligence with structured organic results
 *  - Scraping Browser: JS-rendered deep research on top sources
 *  - Web Unlocker: fallback for pages that block standard scraping
 *
 * Used by aiService.server.js for non-SynthData markets that benefit from
 * web intelligence (politics, current events, non-asset markets).
 */
export class MarketIntelligenceAnalyzer extends EdgeAnalyzer {
  constructor() {
    super({
      name: 'MarketIntelligenceAnalyzer',
      version: '2.0.0',
      model: 'llama-3.3-70b'
    });

    this.openai = new OpenAI({
      apiKey: process.env.VENICE_API_KEY,
      baseURL: "https://api.venice.ai/api/v1",
    });
  }

  /**
   * Enrich context with Bright Data search results and optional deep research.
   * Uses SERP API for structured search, Scraping Browser for JS-rendered pages,
   * and Web Unlocker as fallback for bot-protected sites.
   */
  async enrichContext(context) {
    if (!brightDataService.isAvailable()) {
      return { ...context, intelligenceData: null };
    }

    const query = `${context.title} ${context.description || ''} status resolution data`;
    console.log(`[MarketIntelligence] Searching Bright Data for: "${query}"`);

    try {
      const searchData = await brightDataService.search(query);

      // Bright Data SERP API returns { organic: [...] } with:
      // link, source, display_link, title, description, rank
      const results = searchData.organic || [];

      const topResults = results.slice(0, 5).map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.description, // Bright Data uses "description", not "snippet"
        source: r.source,
        rank: r.rank,
      }));

      let deepResearch = null;
      let deepResearchProduct = null;

      // Attempt deep research on the top result if Scraping Browser is available
      if (topResults.length > 0 && brightDataService.sbrEnabled) {
        const topUrl = topResults[0].link;
        console.log(`[MarketIntelligence] Deep research via Scraping Browser: ${topUrl}`);

        const scraped = await brightDataService.scrapeWithBrowser(topUrl);
        if (scraped && scraped.text) {
          deepResearch = {
            title: scraped.title,
            url: scraped.url,
            charCount: scraped.charCount,
            sentenceCount: scraped.sentenceCount,
            text: scraped.text,
          };
          deepResearchProduct = 'scrapingBrowser';
        }
      }

      // Fallback: try Web Unlocker if Scraping Browser failed or isn't configured
      if (!deepResearch && topResults.length > 0 && brightDataService.unlockerEnabled) {
        const topUrl = topResults[0].link;
        console.log(`[MarketIntelligence] Web Unlocker fallback: ${topUrl}`);

        const unlocked = await brightDataService.fetchWithUnlocker(topUrl, { data_format: 'markdown' });
        if (unlocked && unlocked.content) {
          deepResearch = {
            title: topResults[0].title,
            url: unlocked.url,
            charCount: unlocked.content.length,
            sentenceCount: null,
            text: unlocked.content.substring(0, 6000),
          };
          deepResearchProduct = 'webUnlocker';
        }
      }

      return {
        ...context,
        intelligenceData: {
          query,
          results: topResults,
          resultCount: results.length,
          deepResearch,
          source: deepResearch ? 'brightdata+research' : (topResults.length > 0 ? 'brightdata+llm' : 'llm'),
          error: searchData.error || null,
          productsUsed: {
            serp: topResults.length > 0,
            scrapingBrowser: deepResearchProduct === 'scrapingBrowser',
            webUnlocker: deepResearchProduct === 'webUnlocker',
          },
        }
      };
    } catch (error) {
      console.error('[MarketIntelligence] Search failed:', error.message);
      return { ...context, intelligenceData: null };
    }
  }

  /**
   * Construct prompt using search intelligence and deep research evidence
   */
  constructPrompt(context) {
    const { title, intelligenceData, currentOdds } = context;

    let intelligenceContext = "No external intelligence gathered.";
    let deepResearchContext = "";

    if (intelligenceData && intelligenceData.results.length > 0) {
      intelligenceContext = intelligenceData.results.map((r, i) =>
        `[${i+1}] ${r.title}\nSource: ${r.source || 'Unknown'}\nURL: ${r.link}\nSnippet: ${r.snippet}`
      ).join('\n\n');
    }

    if (intelligenceData?.deepResearch?.text) {
      const dr = intelligenceData.deepResearch;
      deepResearchContext = `\n\nDEEP RESEARCH (via ${dr.sentenceCount ? 'Scraping Browser' : 'Web Unlocker'}):\nSource: ${dr.title}\nURL: ${dr.url}\nExtracted ${dr.charCount.toLocaleString()} chars:\n${dr.text}`;
    }

    return `
      You are a Market Intelligence Agent specializing in high-conviction forecasting.
      Your goal is to evaluate the following prediction market using the provided search intelligence.

      MARKET: "${title}"
      DESCRIPTION: ${context.description || 'N/A'}
      CURRENT ODDS: Yes ${currentOdds?.yes || 0.5} | No ${currentOdds?.no || 0.5}

      SEARCH INTELLIGENCE (via Bright Data SERP API):
      ${intelligenceContext}
      ${deepResearchContext}

      TASK:
      1. Analyze the search results for evidence supporting a YES or NO outcome.
      2. Identify any information asymmetry (things the market might be missing).
      3. Evaluate the credibility of the sources.
      4. Estimate the "True Probability" based on this intelligence.

      Respond in JSON format:
      { "probability": 0.XX, "reasoning": "...", "key_factors": ["..."], "confidence": "HIGH|MEDIUM|LOW" }
    `;
  }

  /**
   * Override forecastProbability to use the intelligent prompt
   */
  async forecastProbability(enrichedContext) {
    if (!enrichedContext.intelligenceData) {
      return super.forecastProbability(enrichedContext);
    }

    const prompt = this.constructPrompt(enrichedContext);

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: "You are a professional superforecaster with access to real-time web intelligence." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      return {
        probability: parsed.probability,
        reasoning: parsed.reasoning,
        keyFactors: parsed.key_factors || [],
        confidence: parsed.confidence || 'MEDIUM',
      };
    } catch (error) {
      console.error('[MarketIntelligence] LLM forecast failed:', error.message);
      return super.forecastProbability(enrichedContext);
    }
  }
}
