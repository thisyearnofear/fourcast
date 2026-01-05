import { EdgeAnalyzer } from './EdgeAnalyzer.js';
import { farcasterService } from '../farcasterService.js';

/**
 * Sentiment-specific implementation of EdgeAnalyzer
 * Analyzes Farcaster social sentiment
 */
export class SentimentAnalyzer extends EdgeAnalyzer {
  constructor() {
    super({
      name: 'SentimentAnalyzer',
      version: '1.0.0',
      model: 'llama-3.3-70b'
    });
  }

  /**
   * Enrich context with social sentiment data
   */
  async enrichContext(context) {
    const topic = context.tags?.[0] || context.title; // Best guess topic
    if (!topic) {
      throw new Error('Sentiment analysis requires a topic or title');
    }

    // Fetch recent casts from Farcaster
    const casts = await farcasterService.searchCasts(topic, 15);
    
    // Simple sentiment aggregation (Simulated for speed, normally would use NLP here)
    const sentimentSummary = this.aggregateSentiment(casts);
    
    return {
      ...context,
      sentimentData: {
        topic,
        castCount: casts.length,
        summary: sentimentSummary,
        casts: casts.map(c => c.text).slice(0, 5) // Top 5 text only for prompt
      },
      sentimentHash: this.generateHash(casts)
    };
  }

  /**
   * Construct a sentiment-specific prompt
   */
  constructPrompt(context) {
    const { title, sentimentData, currentOdds } = context;
    
    return `
      Analyze the social sentiment for this prediction market:
      Market: "${title}"
      Current Odds: Yes ${currentOdds?.yes || 0.5} | No ${currentOdds?.no || 0.5}
      
      Social Chatter (Farcaster):
      - Volume: ${sentimentData.castCount} casts
      - Key Casts:
      ${sentimentData.casts.map(c => `  - "${c}"`).join('\n')}
      
      Does the community sentiment strongly favor one outcome?
      Is there "insider" or "expert" consensus visible in the chatter?
      
      Provide:
      1. Confidence (HIGH/MEDIUM/LOW)
      2. Odds Efficiency (INEFFICIENT/EFFICIENT)
      3. Brief Digest (max 200 chars)
    `;
  }

  /**
   * Simple aggregation of cast data
   */
  aggregateSentiment(casts) {
    if (!casts || casts.length === 0) return "No significant chatter found.";
    
    const likes = casts.reduce((sum, c) => sum + (c.reactions?.likes_count || 0), 0);
    const recasts = casts.reduce((sum, c) => sum + (c.reactions?.recasts_count || 0), 0);
    
    return `${casts.length} casts found with ${likes} total likes and ${recasts} recasts.`;
  }
}
