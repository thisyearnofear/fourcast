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
   * 5. Format Output
   */
  async analyze(context) {
    try {
      this.validateContext(context);
      
      const enrichedContext = await this.enrichContext(context);
      const prompt = this.constructPrompt(enrichedContext);
      const rawAnalysis = await this.executeAnalysis(prompt);
      
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
   * Generate a simple hash of the market state
   */
  generateHash(data) {
    // Simple mock hash
    return '0x' + Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 16);
  }
}
