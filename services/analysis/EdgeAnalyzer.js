/**
 * EdgeAnalyzer - Generic Analysis Pattern
 * 
 * Abstract base class and standard implementation for domain-specific analysis.
 * This pattern ensures all domains (Weather, Sentiment, Mobility, On-chain)
 * produce consistent, verifiable signals for the Movement network.
 */

export class EdgeAnalyzer {
  constructor(config = {}) {
    this.name = config.name || 'GenericAnalyzer';
    this.version = config.version || '1.0.0';
    this.model = config.model || 'llama-3.3-70b';
    this.confidenceThreshold = config.confidenceThreshold || 'MEDIUM';
  }

  /**
   * Main analysis pipeline
   * 1. Validate input context
   * 2. Fetch external data (if needed)
   * 3. Construct prompt
   * 4. Call LLM/Analysis Engine
   * 5. (Agent mode) Superforecaster probability estimation
   * 6. (Agent mode) Edge assessment vs market odds
   * 7. Format Output
   */
  async analyze(context) {
    try {
      this.validateContext(context);
      
      const enrichedContext = await this.enrichContext(context);
      const prompt = this.constructPrompt(enrichedContext);
      const rawAnalysis = await this.executeAnalysis(prompt);

      if (context.agentMode) {
        const forecast = await this.forecastProbability(enrichedContext);
        const edge = this.assessEdge(forecast, enrichedContext);
        const signal = this.formatSignal(rawAnalysis, enrichedContext);
        return { ...signal, forecast, edge };
      }
      
      return this.formatSignal(rawAnalysis, enrichedContext);
    } catch (error) {
      console.error(`[${this.name}] Analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Validate that the input context has necessary fields
   * @param {Object} context - Raw input (e.g., market details)
   */
  validateContext(context) {
    if (!context || !context.marketID || !context.title) {
      throw new Error('Invalid context: marketID and title are required');
    }
  }

  /**
   * Fetch external data (Override in subclasses)
   * @param {Object} context 
   */
  async enrichContext(context) {
    // Default: Return context as-is
    return context;
  }

  /**
   * Construct the specific prompt for this domain
   * @param {Object} context 
   */
  constructPrompt(context) {
    throw new Error('constructPrompt must be implemented by subclass');
  }

  /**
   * Execute the actual analysis (Simulated or Real LLM call)
   * @param {String} prompt 
   */
  async executeAnalysis(prompt) {
    // In a real implementation, this calls Venice.ai or OpenAI
    // For now, we delegate to the existing API route or mock it
    
    // Check if we are in browser or server
    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
        // Browser: Delegate to server API
        const response = await fetch('/api/analyze/generic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: this.model })
        });
        return response.json();
    } else {
        // Server: Mock or direct call (to be implemented)
        return {
            digest: "Analysis logic should be handled by the specific implementation or API route.",
            confidence: "UNKNOWN",
            oddsEfficiency: "UNKNOWN"
        };
    }
  }

  /**
   * Format the final signal object conforming to Move contract
   * @param {Object} analysisResult 
   * @param {Object} context 
   */
  formatSignal(analysisResult, context) {
    return {
      eventId: context.marketID || context.event_id,
      marketTitle: context.title,
      venue: context.venue || context.location || 'Global',
      eventTime: context.eventDate ? new Date(context.eventDate).getTime() / 1000 : 0,
      marketSnapshotHash: this.generateHash(context),
      weatherHash: context.weatherHash || '', // Domain specific
      aiDigest: analysisResult.digest || '',
      confidence: analysisResult.confidence || 'UNKNOWN',
      oddsEfficiency: analysisResult.oddsEfficiency || 'UNKNOWN',
      timestamp: Date.now()
    };
  }

  /**
   * Superforecaster-style probability estimation
   * Decomposes the question, considers base rates, and outputs a numeric probability.
   * Subclasses can override to add domain-specific reasoning.
   * @param {Object} enrichedContext - Context after enrichment
   * @returns {Promise<{probability: number, reasoning: string}>}
   */
  async forecastProbability(enrichedContext) {
    const currentOdds = enrichedContext.currentOdds?.yes ?? 0.5;
    const prompt = `You are a superforecaster estimating the probability of an event.

QUESTION: "${enrichedContext.title}"

CURRENT MARKET ODDS: ${(currentOdds * 100).toFixed(1)}% YES

Follow this structured reasoning process:
1. DECOMPOSE: Break the question into key sub-questions and factors.
2. BASE RATES: What do historical base rates suggest for events like this?
3. EVIDENCE: What specific evidence shifts the probability from the base rate?
4. SYNTHESIS: Weigh the evidence and arrive at a final probability.

Rules:
- Think probabilistically, not in binary yes/no terms.
- Be calibrated: use the full range from 0.01 to 0.99.
- Avoid anchoring too heavily on the current market odds.
- State your reasoning clearly before giving your final number.

Respond in this exact JSON format:
{
  "reasoning": "<your step-by-step reasoning>",
  "probability": <number between 0 and 1>
}`;

    const result = await this.executeAnalysis(prompt);

    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      const probability = parseFloat(parsed.probability);
      if (isNaN(probability) || probability < 0 || probability > 1) {
        return { probability: 0.5, reasoning: 'Failed to parse probability from LLM response' };
      }
      return { probability, reasoning: parsed.reasoning || '' };
    } catch {
      return { probability: 0.5, reasoning: result.digest || 'Unable to extract structured forecast' };
    }
  }

  /**
   * Assess the edge between AI forecast probability and current market odds.
   * Compares the forecast against market prices to detect mispricing.
   * @param {Object} forecast - Output from forecastProbability ({ probability, reasoning })
   * @param {Object} enrichedContext - Must include currentOdds.yes
   * @returns {{ edge: number, direction: string, confidence: string, recommendation: string }}
   */
  assessEdge(forecast, enrichedContext) {
    const marketOdds = enrichedContext.currentOdds?.yes ?? 0.5;
    const aiProbability = forecast.probability ?? 0.5;

    // Edge = AI probability minus market odds (positive = market underpricing YES)
    const edge = aiProbability - marketOdds;
    const edgePct = Math.abs(edge) * 100;

    const direction = edge > 0 ? 'YES_UNDERPRICED' : edge < 0 ? 'NO_UNDERPRICED' : 'FAIR';

    let confidence;
    if (edgePct >= 15) {
      confidence = 'HIGH';
    } else if (edgePct >= 5) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    let recommendation;
    if (confidence === 'LOW') {
      recommendation = 'NO_TRADE';
    } else if (edge > 0) {
      recommendation = 'BUY_YES';
    } else {
      recommendation = 'BUY_NO';
    }

    return {
      edge: parseFloat(edge.toFixed(4)),
      edgePct: parseFloat(edgePct.toFixed(2)),
      direction,
      confidence,
      recommendation,
      details: {
        aiProbability,
        marketOdds,
      }
    };
  }

  /**
   * Generate a simple hash of the market state
   */
  generateHash(data) {
    // Simple mock hash
    return '0x' + Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 16);
  }
}
