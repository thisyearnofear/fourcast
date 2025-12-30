// Market data validation and processing utilities

export class MarketDataProcessor {
  /**
   * Validate and normalize market data
   * @param {Object} market - Raw market data
   * @returns {Object|null} Validated market data or null if invalid
   */
  static validateMarket(market) {
    if (!market || !market.id || !market.question) {
      return null;
    }

    return {
      marketID: market.id,
      title: market.question,
      description: market.description || '',
      currentOdds: {
        yes: market.outcomePrices?.[0] || 0.5,
        no: market.outcomePrices?.[1] || 0.5
      },
      volume24h: market.volume24h || 0,
      liquidity: market.liquidity || 0,
      tags: market.tags || [],
      resolutionDate: market.resolutionDate || market.endDate,
      eventType: this.detectEventType(market.question, market.tags),
      teams: this.extractTeams(market.question),
      isWeatherSensitive: this.isWeatherSensitive(market.question, market.tags)
    };
  }

  /**
   * Detect event type from market data
   * @param {string} question - Market question
   * @param {Array} tags - Market tags
   * @returns {string} Detected event type
   */
  static detectEventType(question, tags = []) {
    const lowerQuestion = question.toLowerCase();
    const lowerTags = tags.map(tag => tag.toLowerCase());

    if (lowerTags.includes('sports') || lowerTags.includes('soccer') || 
        lowerTags.includes('football') || lowerTags.includes('nfl') || 
        lowerTags.includes('nba')) {
      return 'Sports';
    }

    if (lowerTags.includes('weather') || 
        lowerQuestion.includes('rain') || 
        lowerQuestion.includes('temperature') ||
        lowerQuestion.includes('weather')) {
      return 'Weather';
    }

    if (lowerTags.includes('politics')) {
      return 'Politics';
    }

    if (lowerTags.includes('economics') || lowerTags.includes('financial')) {
      return 'Economics';
    }

    return 'Other';
  }

  /**
   * Extract team names from sports market questions
   * @param {string} question - Market question
   * @returns {Array} Array of team names
   */
  static extractTeams(question) {
    const teamRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:vs|versus)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/;
    const match = question.match(teamRegex);
    
    if (match) {
      return [match[1], match[2]];
    }
    
    // Try to find team names in parentheses or brackets
    const bracketRegex = /[($$](.*?)[$$)]/g;
    const teams = [];
    let match;
    
    while ((match = bracketRegex.exec(question)) !== null) {
      const team = match[1].trim();
      if (team.length > 2 && !teams.includes(team)) {
        teams.push(team);
      }
    }
    
    return teams;
  }

  /**
   * Determine if market is weather sensitive
   * @param {string} question - Market question
   * @param {Array} tags - Market tags
   * @returns {boolean} True if weather sensitive
   */
  static isWeatherSensitive(question, tags = []) {
    const weatherKeywords = ['rain', 'snow', 'temperature', 'weather', 'storm', 'precipitation'];
    const lowerQuestion = question.toLowerCase();
    const lowerTags = tags.map(tag => tag.toLowerCase());

    return weatherKeywords.some(keyword => 
      lowerQuestion.includes(keyword) || lowerTags.includes(keyword)
    );
  }

  /**
   * Calculate market efficiency score
   * @param {Object} market - Market data with odds and volume
   * @returns {number} Efficiency score (0-1)
   */
  static calculateEfficiency(market) {
    const { currentOdds, volume24h, liquidity } = market;
    
    // Base efficiency on odds balance (closer to 0.5 = more efficient)
    const oddsBalance = 1 - Math.abs(currentOdds.yes - 0.5);
    
    // Volume factor (higher volume = more efficient)
    const volumeFactor = Math.min(volume24h / 100000, 1);
    
    // Liquidity factor
    const liquidityFactor = Math.min(liquidity / 50000, 1);
    
    return (oddsBalance * 0.4 + volumeFactor * 0.3 + liquidityFactor * 0.3);
  }
}