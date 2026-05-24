/**
 * Futures Bet Validator - Enhanced market type classification and validation
 * 
 * ENHANCEMENT: Consolidates and extends MarketTypeDetector.js logic
 * CONSOLIDATION: Single source for futures vs single-event classification
 */

import { MarketTypeDetector } from '../marketTypeDetector.js';

export class FuturesBetValidator {
  
  /**
   * Main futures bet validation entry point
   * @param {string} validationType - Type of validation (classification, temporal, risk-assessment)
   * @param {object} marketData - Market data to validate
   * @param {object} context - Additional validation context
   */
  static validateMarketType(validationType, marketData, context = {}) {
    switch (validationType) {
      case 'classification':
        return this.validateMarketClassification(marketData, context);
      case 'temporal':
        return this.validateTemporalConsistency(marketData, context);
      case 'risk-assessment':
        return this.validateRiskProfile(marketData, context);
      case 'weather-compatibility':
        return this.validateWeatherCompatibility(marketData, context);
      default:
        return {
          valid: false,
          errors: [`Unknown futures validation type: ${validationType}`],
          warnings: [],
          category: 'futures-bet'
        };
    }
  }
  
  /**
   * MARKET CLASSIFICATION VALIDATION
   * Enhanced from existing MarketTypeDetector logic
   */
  static validateMarketClassification(marketData, context = {}) {
    const errors = [];
    const warnings = [];
    
    // Use existing MarketTypeDetector for core classification
    const detectionResult = MarketTypeDetector.detectMarketType(marketData);
    
    // VALIDATION 1: Classification confidence
    if (detectionResult.confidence === 'LOW' && detectionResult.totalScore < 2) {
      warnings.push('Market classification has low confidence - may need manual review');
    }
    
    // VALIDATION 2: Signal consistency
    const { signals } = detectionResult;
    const signalTypes = signals.map(s => s.signal);
    
    // Check for conflicting signals
    const hasTimeSignal = signalTypes.includes('resolution_date');
    const hasLanguageSignal = signalTypes.includes('language_patterns');
    
    if (hasTimeSignal && hasLanguageSignal) {
      const timeSignal = signals.find(s => s.signal === 'resolution_date');
      const langSignal = signals.find(s => s.signal === 'language_patterns');
      
      // If time suggests single event but language suggests futures, flag it
      if (timeSignal.score <= 1 && langSignal.score >= 2) {
        warnings.push('Conflicting signals: short timeline but futures language detected');
      }
    }
    
    // VALIDATION 3: Market type appropriateness for weather analysis
    if (detectionResult.isFutures && context.requestedAnalysis === 'weather') {
      warnings.push('Futures markets may have limited weather impact - consider single-event alternative');
    }
    
    // VALIDATION 4: Unusual patterns
    if (detectionResult.totalScore > 7) {
      // Very high futures score might indicate multiple overlapping signals
      const signalCount = signals.filter(s => s.score > 0).length;
      if (signalCount > 3) {
        warnings.push('Multiple strong futures indicators - verify market type accuracy');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'futures-bet',
      classification: detectionResult,
      marketType: detectionResult.isFutures ? 'FUTURES' : 'SINGLE_EVENT'
    };
  }
  
  /**
   * TEMPORAL CONSISTENCY VALIDATION
   * Validates time-based aspects of market classification
   */
  static validateTemporalConsistency(marketData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      resolutionDate,
      expiresAt,
      endDate,
      title,
      description
    } = marketData;
    
    // VALIDATION 1: Resolution date analysis
    const resolutionDateToUse = resolutionDate || expiresAt || endDate;
    if (!resolutionDateToUse) {
      warnings.push('No resolution date available - temporal classification limited');
      return { valid: true, errors, warnings, category: 'futures-bet' };
    }
    
    const resDateTime = new Date(resolutionDateToUse);
    if (isNaN(resDateTime.getTime())) {
      errors.push('Invalid resolution date format');
      return { valid: false, errors, warnings, category: 'futures-bet' };
    }
    
    const now = new Date();
    const daysUntilResolution = (resDateTime - now) / (1000 * 60 * 60 * 24);
    
    // VALIDATION 2: Timeline vs content consistency
    const combinedText = `${title || ''} ${description || ''}`.toLowerCase();
    
    // Check for immediate event language with distant resolution
    const immediateIndicators = [
      /\btoday\b/, /\btonight\b/, /\bthis week\b/, /\bnext week\b/,
      /\btomorrow\b/, /\bthis weekend\b/, /\bupcoming\b/
    ];
    
    const hasImmediateLanguage = immediateIndicators.some(pattern => pattern.test(combinedText));
    
    if (hasImmediateLanguage && daysUntilResolution > 30) {
      warnings.push('Immediate language detected but resolution >30 days away - verify timeline');
    }
    
    // Check for season/annual language with short timeline
    const seasonalIndicators = [
      /\bseason\b/, /\bannual\b/, /\byearly\b/, /\b2024\b/, /\b2025\b/,
      /\bchampionship\b/, /\bwinner\b/, /\bby end of\b/
    ];
    
    const hasSeasonalLanguage = seasonalIndicators.some(pattern => pattern.test(combinedText));
    
    if (hasSeasonalLanguage && daysUntilResolution < 14) {
      warnings.push('Seasonal/annual language detected but resolution <14 days away - verify scope');
    }
    
    // VALIDATION 3: Weather analysis timeline appropriateness
    if (context.requestedAnalysis === 'weather') {
      if (daysUntilResolution > 14) {
        warnings.push('Weather forecasts >14 days have limited accuracy for betting analysis');
      }
      if (daysUntilResolution > 30) {
        errors.push('Weather analysis not recommended for events >30 days away');
      }
    }
    
    // VALIDATION 4: Market maturity assessment
    let maturityLevel;
    if (daysUntilResolution < 1) maturityLevel = 'IMMINENT';
    else if (daysUntilResolution < 7) maturityLevel = 'SHORT_TERM';
    else if (daysUntilResolution < 30) maturityLevel = 'MEDIUM_TERM';
    else maturityLevel = 'LONG_TERM';
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'futures-bet',
      daysUntilResolution: Math.round(daysUntilResolution),
      maturityLevel,
      weatherAnalysisAppropriate: daysUntilResolution <= 14
    };
  }
  
  /**
   * RISK PROFILE VALIDATION
   * Validates risk characteristics based on market type
   */
  static validateRiskProfile(marketData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const classification = MarketTypeDetector.detectMarketType(marketData);
    const { currentOdds, volume24h, liquidity } = marketData;
    
    // VALIDATION 1: Futures-specific risks
    if (classification.isFutures) {
      warnings.push('Futures markets carry additional risks: longer timeline, more variables');
      
      // Very long-term futures have higher uncertainty
      if (classification.signals.some(s => s.signal === 'resolution_date' && s.score >= 5)) {
        warnings.push('Long-term futures have high uncertainty due to extended timeline');
      }
      
      // Multiple outcome futures (championship races) are harder to predict
      const hasMultipleOutcomes = marketData.title && 
        (/\bwin\b.*\b(championship|title|league)\b/i.test(marketData.title) ||
         /\bfinish\b.*\b(first|top|1st)\b/i.test(marketData.title));
      
      if (hasMultipleOutcomes) {
        warnings.push('Multi-competitor futures have complex dynamics and higher variance');
      }
    }
    
    // VALIDATION 2: Liquidity-based risk assessment
    if (volume24h !== undefined) {
      const vol = parseFloat(volume24h);
      if (!isNaN(vol)) {
        if (vol < 1000) {
          warnings.push('Low volume market - higher price impact and liquidity risk');
        }
        if (vol < 100) {
          warnings.push('Very low volume - significant liquidity constraints');
        }
      }
    }
    
    // VALIDATION 3: Odds-based risk indicators
    if (currentOdds) {
      const { yes, no } = currentOdds;
      if (yes !== undefined && no !== undefined) {
        const yesNum = parseFloat(yes);
        const noNum = parseFloat(no);
        
        if (!isNaN(yesNum) && !isNaN(noNum)) {
          // Extreme odds indicate high certainty or low liquidity
          if (yesNum < 0.05 || yesNum > 0.95) {
            warnings.push('Extreme odds detected - limited upside or high certainty event');
          }
          
          // Large odds spread indicates poor liquidity
          const spread = Math.abs(yesNum + noNum - 1);
          if (spread > 0.1) {
            warnings.push('Large odds spread indicates poor market efficiency');
          }
        }
      }
    }
    
    // VALIDATION 4: Weather-related risk assessment
    if (context.hasWeatherDependency) {
      if (classification.isFutures) {
        warnings.push('Weather-dependent futures have compounding forecast uncertainty');
      }
      
      // Seasonal futures with weather dependency
      const hasSeasonalAspect = classification.signals.some(s => 
        s.signal === 'language_patterns' && s.detail.includes('season')
      );
      
      if (hasSeasonalAspect) {
        warnings.push('Seasonal weather patterns add complexity to long-term forecasts');
      }
    }
    
    // Calculate overall risk level
    let riskLevel = 'LOW';
    const riskFactors = warnings.length + (errors.length * 2);
    
    if (riskFactors >= 6) riskLevel = 'VERY_HIGH';
    else if (riskFactors >= 4) riskLevel = 'HIGH';
    else if (riskFactors >= 2) riskLevel = 'MEDIUM';
    
    if (classification.isFutures) {
      // Futures automatically get at least medium risk
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'futures-bet',
      riskLevel,
      riskFactors: warnings.length + errors.length,
      isFutures: classification.isFutures
    };
  }
  
  /**
   * WEATHER COMPATIBILITY VALIDATION
   * Validates if market type is compatible with weather analysis
   */
  static validateWeatherCompatibility(marketData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const classification = MarketTypeDetector.detectMarketType(marketData);
    const { title, description } = marketData;
    
    // VALIDATION 1: Futures vs weather timeline compatibility
    if (classification.isFutures) {
      const timeSignal = classification.signals.find(s => s.signal === 'resolution_date');
      
      if (timeSignal && timeSignal.score >= 5) {
        // Very long-term futures (>90 days)
        errors.push('Weather analysis not applicable to long-term futures (>90 days)');
      } else if (timeSignal && timeSignal.score >= 3) {
        // Medium-term futures (30-90 days)
        warnings.push('Weather forecasts have limited accuracy for medium-term futures');
      }
    }
    
    // VALIDATION 2: Event type vs weather relevance
    const combinedText = `${title || ''} ${description || ''}`.toLowerCase();
    
    // Weather-relevant activities
    const weatherSensitivePatterns = [
      /\b(nfl|football|baseball|golf|tennis|cricket|soccer|rugby)\b/,
      /\b(outdoor|marathon|race|sailing|skiing)\b/,
      /\b(weather|rain|snow|wind|storm|temperature)\b/,
      /\b(harvest|crop|agriculture|farming)\b/,
      /\b(flight|airport|aviation|travel)\b/
    ];
    
    const hasWeatherSensitivity = weatherSensitivePatterns.some(pattern => 
      pattern.test(combinedText)
    );
    
    if (!hasWeatherSensitivity && context.requestedAnalysis === 'weather') {
      warnings.push('Market does not appear weather-sensitive - analysis may have limited value');
    }
    
    // VALIDATION 3: Indoor vs outdoor event detection
    const indoorIndicators = [
      /\b(indoor|arena|stadium|dome|court|hall)\b/,
      /\b(nba|hockey|basketball)\b/,
      /\b(esports|gaming|virtual|online)\b/
    ];
    
    const hasIndoorIndicators = indoorIndicators.some(pattern => 
      pattern.test(combinedText)
    );
    
    const outdoorIndicators = [
      /\b(outdoor|field|course|track|beach)\b/,
      /\b(nfl|baseball|golf|tennis|soccer|cricket)\b/,
      /\b(marathon|cycling|sailing|skiing)\b/
    ];
    
    const hasOutdoorIndicators = outdoorIndicators.some(pattern => 
      pattern.test(combinedText)
    );
    
    if (hasIndoorIndicators && !hasOutdoorIndicators && context.requestedAnalysis === 'weather') {
      warnings.push('Event appears to be indoors - weather impact may be minimal');
    }
    
    // VALIDATION 4: Seasonal appropriateness
    if (classification.isFutures && hasWeatherSensitivity) {
      const currentMonth = new Date().getMonth();
      const winterMonths = [11, 0, 1, 2]; // Dec, Jan, Feb, Mar
      const summerMonths = [5, 6, 7, 8]; // Jun, Jul, Aug, Sep
      
      if (combinedText.includes('snow') && summerMonths.includes(currentMonth)) {
        warnings.push('Snow-related futures bet in summer months - verify seasonality');
      }
      
      if (combinedText.includes('heat') && winterMonths.includes(currentMonth)) {
        warnings.push('Heat-related futures bet in winter months - verify seasonality');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'futures-bet',
      weatherCompatible: errors.length === 0,
      weatherRelevance: hasWeatherSensitivity ? 'HIGH' : 'LOW',
      eventSetting: hasOutdoorIndicators ? 'OUTDOOR' : hasIndoorIndicators ? 'INDOOR' : 'UNKNOWN'
    };
  }
}