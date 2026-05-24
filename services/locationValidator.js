/**
 * Location Validator Service - Comprehensive location validation for all market types
 * 
 * CORE PRINCIPLES APPLIED:
 * - ENHANCEMENT FIRST: Consolidates existing sports validation from aiService.server.js
 * - AGGRESSIVE CONSOLIDATION: Single source of truth for all location validation
 * - DRY: Eliminates duplicated location checking logic
 * - CLEAN: Clear separation of validation concerns by market category
 * - MODULAR: Composable validators for each market type
 */

import { MarketTypeDetector } from './marketTypeDetector.js';

export class LocationValidator {

  /**
   * Main validation entry point - validates location appropriateness for any market type
   * @param {string} eventType - The market event type (e.g., "NFL", "Weather", "Politics")
   * @param {string|object} location - Location string or object with name property
   * @param {object} additionalContext - Extra context like tags, description, etc.
   * @returns {object} { valid: boolean, issue: string, suggestion: string, category: string }
   */
  static validateLocation(eventType, location, additionalContext = {}) {
    const locationText = location?.name || location || 'Unknown';

    // Detect market category using existing MarketTypeDetector logic
    const category = this.detectMarketCategory(eventType, additionalContext);

    // Route to appropriate validator
    switch (category) {
      case 'sports':
        return this.validateSportsLocation(eventType, locationText);
      case 'weather':
        return this.validateWeatherLocation(eventType, locationText);
      case 'politics':
        return this.validatePoliticsLocation(eventType, locationText);
      case 'economics':
        return this.validateEconomicsLocation(eventType, locationText);
      case 'entertainment':
        return this.validateEntertainmentLocation(eventType, locationText);
      default:
        return { valid: true, category }; // No validation needed for general markets
    }
  }

  /**
   * Detect market category from eventType and context
   * Leverages existing logic patterns from the codebase
   */
  static detectMarketCategory(eventType, context = {}) {
    if (!eventType) return 'general';

    const eventLower = eventType.toLowerCase();
    const tags = (context.tags || []).map(t =>
      typeof t === 'string' ? t.toLowerCase() : (t.label || '').toLowerCase()
    ).join(' ');
    const combinedText = `${eventLower} ${tags}`.toLowerCase();

    // Sports detection (from existing aiService.server.js logic) - check first for specificity
    if (combinedText.includes('nfl') || combinedText.includes('nba') ||
      combinedText.includes('mlb') || combinedText.includes('nhl') ||
      combinedText.includes('football') || combinedText.includes('basketball') ||
      combinedText.includes('baseball') || combinedText.includes('hockey') ||
      combinedText.includes('golf') || combinedText.includes('tennis') ||
      combinedText.includes('soccer') || combinedText.includes('cricket') ||
      combinedText.includes('championship') || combinedText.includes('playoffs') ||
      combinedText.includes('world series') || combinedText.includes('finals')) {
      return 'sports';
    }

    // Economics detection - check before general 'market' term
    if (combinedText.includes('nasdaq') || combinedText.includes('nyse') ||
      combinedText.includes('dow jones') || combinedText.includes('s&p') ||
      combinedText.includes('federal reserve') || combinedText.includes('fed') ||
      combinedText.includes('economy') || combinedText.includes('gdp') ||
      combinedText.includes('inflation') || combinedText.includes('employment') ||
      combinedText.includes('stock') || combinedText.includes('trading') ||
      combinedText.includes('futures') || combinedText.includes('economic') ||
      combinedText.includes('wall street')) {
      return 'economics';
    }

    // Weather detection
    if (combinedText.includes('weather') || combinedText.includes('temperature') ||
      combinedText.includes('rain') || combinedText.includes('snow') ||
      combinedText.includes('hurricane') || combinedText.includes('storm') ||
      combinedText.includes('climate') || combinedText.includes('drought') ||
      combinedText.includes('forecast') || combinedText.includes('precipitation')) {
      return 'weather';
    }

    // Politics detection
    if (combinedText.includes('election') || combinedText.includes('vote') ||
      combinedText.includes('president') || combinedText.includes('congress') ||
      combinedText.includes('senate') || combinedText.includes('governor') ||
      combinedText.includes('mayor') || combinedText.includes('politics') ||
      combinedText.includes('campaign') || combinedText.includes('ballot') ||
      combinedText.includes('congressional')) {
      return 'politics';
    }

    // Entertainment detection
    if (combinedText.includes('movie') || combinedText.includes('film') ||
      combinedText.includes('concert') || combinedText.includes('festival') ||
      combinedText.includes('awards') || combinedText.includes('celebrity') ||
      combinedText.includes('entertainment') || combinedText.includes('show') ||
      combinedText.includes('premiere') || combinedText.includes('box office')) {
      return 'entertainment';
    }

    return 'general';
  }

  /**
   * SPORTS VALIDATION - Consolidated from aiService.server.js
   * Validates that sports events have appropriate geographical locations
   */
  static validateSportsLocation(eventType, locationText) {
    const eventLower = eventType.toLowerCase();

    // US/Canada sports leagues - strict validation
    const isUSCanadaSport = eventLower.includes('nfl') || eventLower.includes('nba') ||
      eventLower.includes('mlb') || eventLower.includes('nhl') ||
      (eventLower.includes('football') && !eventLower.includes('soccer')) ||
      (eventLower.includes('basketball') && !eventLower.includes('international')) ||
      (eventLower.includes('baseball') && !eventLower.includes('international')) ||
      (eventLower.includes('hockey') && !eventLower.includes('international'));

    if (isUSCanadaSport) {
      return this.validateUSCanadaSports(eventType, locationText);
    }

    // International sports - more flexible
    const isInternationalSport = eventLower.includes('soccer') || eventLower.includes('cricket') ||
      eventLower.includes('tennis') || eventLower.includes('golf');

    if (isInternationalSport) {
      return this.validateInternationalSports(eventType, locationText);
    }

    // Generic sports validation for other sports
    return this.validateGenericSports(eventType, locationText);
  }

  /**
   * US/Canada sports validation (NFL, NBA, MLB, NHL)
   * Consolidates existing logic from aiService.server.js lines 45-64
   */
  static validateUSCanadaSports(eventType, locationText) {
    const lowerLocation = locationText.toLowerCase();

    // US/Canada identifiers (consolidated from existing logic)
    // Use word boundaries and longer patterns to avoid false matches
    const usCanadaPatterns = [
      // Countries/regions - use word boundaries or longer patterns
      /\busa\b/, /\bunited states\b/, /\bamerica\b/, /\bamerican\b/,
      /\bcanada\b/, /\bcanadian\b/,
      // US state names (full names to avoid substring matches)
      /\bflorida\b/, /\btexas\b/, /\bnew york\b/, /\bcalifornia\b/,
      /\bpennsylvania\b/, /\bohio\b/, /\bmaryland\b/, /\bnew jersey\b/,
      /\bmassachusetts\b/, /\bminnesota\b/, /\billinois\b/, /\bgeorgia\b/,
      /\bmichigan\b/, /\bwisconsin\b/, /\bnorth carolina\b/, /\btennessee\b/,
      /\bindiana\b/, /\bcolorado\b/, /\bmissouri\b/, /\barizona\b/,
      /\bnevada\b/, /\bwashington\b/, /\boregon\b/, /\blouisiana\b/,
      /\barkansas\b/, /\boklahoma\b/, /\bnew mexico\b/, /\bconnecticut\b/,
      /\brhode island\b/, /\bdelaware\b/, /\bvermont\b/, /\bnew hampshire\b/,
      /\bmaine\b/, /\bsouth dakota\b/, /\bnorth dakota\b/, /\bmontana\b/,
      /\bwyoming\b/, /\butah\b/, /\bidaho\b/, /\balaska\b/, /\bhawaii\b/,
      // State abbreviations with context (more precise)
      /\b[a-z]+,\s*fl\b/, /\b[a-z]+,\s*tx\b/, /\b[a-z]+,\s*ny\b/, /\b[a-z]+,\s*ca\b/,
      /\b[a-z]+,\s*pa\b/, /\b[a-z]+,\s*oh\b/, /\b[a-z]+,\s*md\b/, /\b[a-z]+,\s*nj\b/,
      // Add DC specifically
      /\bwashington,?\s*dc\b/, /\bwashington\s+d\.?c\.?\b/
    ];

    // Major sports cities (consolidated from existing logic)
    const majorSportsCities = [
      'new york', 'baltimore', 'dallas', 'philadelphia', 'miami', 'chicago',
      'denver', 'kansas city', 'las vegas', 'los angeles', 'seattle', 'green bay',
      'pittsburgh', 'cincinnati', 'cleveland', 'buffalo', 'tampa', 'jacksonville',
      'nashville', 'indianapolis', 'arizona', 'carolina', 'atlanta', 'minnesota',
      'detroit', 'washington', 'san francisco', 'oakland', 'columbus', 'kent'
      // Note: removed 'london' - international games need special handling
    ];

    // Special allowances for known international games
    const internationalGameCities = ['london']; // NFL London games
    const hasInternationalException = internationalGameCities.some(city => lowerLocation.includes(city));

    const hasValidIdentifier = usCanadaPatterns.some(pattern => pattern.test(lowerLocation));
    const hasValidCity = majorSportsCities.some(city => lowerLocation.includes(city));

    if (!hasValidIdentifier && !hasValidCity && !hasInternationalException) {
      const eventLower = eventType.toLowerCase();
      const leagueType = eventLower.includes('nfl') ? 'NFL' :
        eventLower.includes('nba') ? 'NBA' :
          eventLower.includes('mlb') ? 'MLB' :
            eventLower.includes('nhl') ? 'NHL' :
              eventLower.includes('football') ? 'NFL' :
                eventLower.includes('basketball') ? 'NBA' :
                  eventLower.includes('baseball') ? 'MLB' :
                    eventLower.includes('hockey') ? 'NHL' : 'sports league';

      // Return valid but with a warning instead of blocking
      return {
        valid: true, // Allow analysis to proceed
        category: 'sports',
        warning: `Location warning: ${locationText} is not a standard ${leagueType} city. Analysis will proceed but may be inaccurate if the location is incorrect.`,
        issue: `Location warning for ${leagueType} game.`,
        suggestion: `Verify that ${locationText} is the correct venue for this game.`,
        actionText: `Proceed with caution - Verify location manually.`
      };
    }

    return { valid: true, category: 'sports' };
  }

  /**
   * WEATHER VALIDATION
   * Ensures location is valid for weather data retrieval
   */
  static validateWeatherLocation(eventType, locationText) {
    // Basic validation for weather location format
    if (!locationText || locationText === 'Unknown' || locationText.length < 2) {
      return {
        valid: false,
        category: 'weather',
        issue: 'Invalid location for weather analysis. Weather data requires a valid geographical location.',
        suggestion: 'Please provide a specific city, state, or coordinates for weather analysis.',
        actionText: 'Enter a valid location - Weather analysis needs a real geographical location to fetch accurate data.'
      };
    }

    // Check for obviously invalid locations
    const invalidPatterns = [
      /^test/i, /^example/i, /^fake/i, /^invalid/i, /^null/i, /^undefined/i,
      /mars/i, /moon/i, /jupiter/i, /saturn/i, // Space locations
      /atlantis/i, /narnia/i, /hogwarts/i // Fictional places
    ];

    const hasInvalidPattern = invalidPatterns.some(pattern => pattern.test(locationText));
    if (hasInvalidPattern) {
      return {
        valid: false,
        category: 'weather',
        issue: 'Location appears to be fictional or invalid for weather analysis.',
        suggestion: 'Please provide a real geographical location (city, state, or coordinates).',
        actionText: 'Enter a real location - Weather services cannot provide data for fictional or non-existent places.'
      };
    }

    return { valid: true, category: 'weather' };
  }

  /**
   * POLITICS VALIDATION
   * Validates political jurisdiction appropriateness
   */
  static validatePoliticsLocation(eventType, locationText) {
    const eventLower = eventType.toLowerCase();
    const locationLower = locationText.toLowerCase();

    // US Federal elections should have US locations
    if ((eventLower.includes('president') && eventLower.includes('us')) ||
      eventLower.includes('congress') || eventLower.includes('senate') ||
      eventLower.includes('house of representatives')) {

      const usIdentifiers = [
        'us', 'usa', 'united states', 'america', 'american',
        // US states
        'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
        'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
        'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
        'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
        'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
        'new hampshire', 'new jersey', 'new mexico', 'new york',
        'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
        'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
        'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
        'west virginia', 'wisconsin', 'wyoming'
      ];

      const isUSLocation = usIdentifiers.some(id => locationLower.includes(id));
      if (!isUSLocation) {
        return {
          valid: false,
          category: 'politics',
          issue: 'Location mismatch for US political event. US elections require US geographic context.',
          suggestion: 'Please provide a US state or city for accurate political analysis.',
          actionText: 'Enter a US location - This US political event requires an American geographic context for relevant analysis.'
        };
      }
    }

    return { valid: true, category: 'politics' };
  }

  /**
   * ECONOMICS VALIDATION
   * Validates economic jurisdiction relevance
   */
  static validateEconomicsLocation(eventType, locationText) {
    const eventLower = eventType.toLowerCase();
    const locationLower = locationText.toLowerCase();

    // US market events should have US context
    if (eventLower.includes('nasdaq') || eventLower.includes('nyse') ||
      eventLower.includes('dow jones') || eventLower.includes('s&p') ||
      eventLower.includes('fed') || eventLower.includes('federal reserve')) {

      const usEconomicIdentifiers = [
        'us', 'usa', 'united states', 'america', 'new york', 'wall street',
        'manhattan', 'chicago', 'nasdaq', 'nyse'
      ];

      const isUSEconomicContext = usEconomicIdentifiers.some(id => locationLower.includes(id));
      if (!isUSEconomicContext && !locationLower.includes('global')) {
        return {
          valid: false,
          category: 'economics',
          issue: 'Location may not be relevant for US market analysis. US financial markets require American economic context.',
          suggestion: 'Please provide a US location or specify "Global" for international market analysis.',
          actionText: 'Enter relevant location - US market events need American geographic context for accurate economic analysis.'
        };
      }
    }

    return { valid: true, category: 'economics' };
  }

  /**
   * ENTERTAINMENT VALIDATION
   * Basic validation for entertainment events
   */
  static validateEntertainmentLocation(eventType, locationText) {
    // Most entertainment events are location-flexible, minimal validation
    if (!locationText || locationText === 'Unknown' || locationText.length < 2) {
      return {
        valid: false,
        category: 'entertainment',
        issue: 'Location needed for entertainment event context.',
        suggestion: 'Please provide the location where this entertainment event is taking place.',
        actionText: 'Enter event location - Entertainment events need geographic context for relevant analysis.'
      };
    }

    return { valid: true, category: 'entertainment' };
  }

  /**
   * International sports validation
   */
  static validateInternationalSports(eventType, locationText) {
    // International sports are more flexible with locations
    if (!locationText || locationText === 'Unknown' || locationText.length < 2) {
      return {
        valid: false,
        category: 'sports',
        issue: 'Location required for international sports event analysis.',
        suggestion: 'Please provide the city or country where this sports event is taking place.',
        actionText: 'Enter sports venue location - International sports events need geographic context for weather analysis.'
      };
    }

    return { valid: true, category: 'sports' };
  }

  /**
   * Helper method to check if location appears to be in US/Canada
   */
  static isUSCanadaLocation(locationLower) {
    const usCanadaIdentifiers = [
      'us', 'usa', 'united states', 'america', 'american',
      'ca', 'canada', 'canadian',
      'new york', 'los angeles', 'chicago', 'dallas', 'philadelphia',
      'miami', 'denver', 'seattle', 'boston', 'atlanta', 'detroit',
      'toronto', 'vancouver', 'montreal', 'calgary'
    ];

    return usCanadaIdentifiers.some(id => locationLower.includes(id));
  }

  /**
   * Generic sports validation fallback
   */
  static validateGenericSports(eventType, locationText) {
    if (!locationText || locationText === 'Unknown' || locationText.length < 2) {
      return {
        valid: false,
        category: 'sports',
        issue: 'Location required for sports event analysis.',
        suggestion: 'Please provide the location where this sports event is taking place.',
        actionText: 'Enter sports venue location - Sports events need geographic context for weather impact analysis.'
      };
    }

    return { valid: true, category: 'sports' };
  }

  /**
   * Generate standardized error response for AI services
   * Maintains compatibility with existing aiService.server.js response format
   */
  static generateValidationErrorResponse(validationResult, eventType, locationText) {
    if (validationResult.valid) {
      return null; // No error response needed
    }

    return {
      assessment: {
        weather_impact: 'N/A',
        odds_efficiency: 'UNKNOWN',
        confidence: 'LOW'
      },
      analysis: `${validationResult.issue} ${validationResult.suggestion}`,
      key_factors: [
        `Invalid location detected for ${validationResult.category} event`,
        'Analysis requires appropriate geographical context',
      ],
      recommended_action: validationResult.actionText,
      citations: [],
      limitations: 'Location does not match event type requirements',
      cached: false,
      source: 'location_validation',
      validationCategory: validationResult.category
    };
  }
}