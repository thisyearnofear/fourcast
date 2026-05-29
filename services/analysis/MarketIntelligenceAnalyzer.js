import { EdgeAnalyzer } from './EdgeAnalyzer.js';
import { brightDataService } from '../brightDataService.js';
import OpenAI from 'openai';

/**
 * MarketIntelligenceAnalyzer - Uses Bright Data to gather deep "ground truth"
 * for high-conviction forecasting.
 */
export class MarketIntelligenceAnalyzer extends EdgeAnalyzer {
  constructor() {
    super({
      name: 'MarketIntelligenceAnalyzer',
      version: '1.0.0',
      model: 'llama-3.3-70b'
    });
    
    this.openai = new OpenAI({
      apiKey: process.env.VENICE_API_KEY,
      baseURL: "https://api.venice.ai/api/v1",
    });
  }

  /**
   * Enrich context with Bright Data search results and scraping
   */
  async enrichContext(context) {
    if (!brightDataService.isAvailable()) {
      return context;
    }

    const query = `${context.title} ${context.description || ''} status resolution data`;
    console.log(`[MarketIntelligence] Searching Bright Data for: "${query}"`);

    try {
      const searchData = await brightDataService.search(query);
      
      // Extract organic results
      const organicResults = searchData.organic_results || [];
      const topResults = organicResults.slice(0, 5).map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet
      }));

      // Enhancement: If we have a very relevant looking link, we could scrape it
      // For this hackathon demo, we'll focus on the search snippets first
      
      return {
        ...context,
        intelligenceData: {
          query,
          results: topResults,
          source: 'Bright Data SERP API'
        }
      };
    } catch (error) {
      console.error('[MarketIntelligence] Search failed:', error.message);
      return context;
    }
  }

  /**
   * Construct prompt using search intelligence
   */
  constructPrompt(context) {
    const { title, intelligenceData, currentOdds } = context;
    
    let intelligenceContext = "No external intelligence gathered.";
    if (intelligenceData && intelligenceData.results.length > 0) {
      intelligenceContext = intelligenceData.results.map((r, i) => 
        `[${i+1}] ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`
      ).join('\n\n');
    }

    return `
      You are a Market Intelligence Agent specializing in high-conviction forecasting.
      Your goal is to evaluate the following prediction market using the provided search intelligence.

      MARKET: "${title}"
      DESCRIPTION: ${context.description || 'N/A'}
      CURRENT ODDS: Yes ${currentOdds?.yes || 0.5} | No ${currentOdds?.no || 0.5}

      SEARCH INTELLIGENCE (via Bright Data):
      ${intelligenceContext}

      TASK:
      1. Analyze the search results for evidence supporting a YES or NO outcome.
      2. Identify any information asymmetry (things the market might be missing).
      3. Evaluate the credibility of the sources.
      4. Estimate the "True Probability" based on this intelligence.

      Provide:
      - Digest: Summary of findings (max 250 chars)
      - Confidence: HIGH/MEDIUM/LOW
      - Odds Efficiency: EFFICIENT/INEFFICIENT
      - Probability Estimate (0.0 - 1.0)
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
          { role: "system", content: "You are a professional superforecaster." },
          { role: "user", content: prompt + "\n\nRespond in JSON format: { \"probability\": 0.XX, \"reasoning\": \"...\", \"key_factors\": [] }" }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      return {
        probability: parsed.probability,
        reasoning: parsed.reasoning,
        keyFactors: parsed.key_factors || []
      };
    } catch (error) {
      console.error('[MarketIntelligence] LLM forecast failed:', error.message);
      return super.forecastProbability(enrichedContext);
    }
  }
}
