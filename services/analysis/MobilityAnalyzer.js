import { EdgeAnalyzer } from './EdgeAnalyzer.js';
import { VenueExtractor } from '../venueExtractor.js';

/**
 * Mobility-specific implementation of EdgeAnalyzer
 * Analyzes crowd turnout and local traffic impact
 */
export class MobilityAnalyzer extends EdgeAnalyzer {
  constructor() {
    super({ 
      name: 'MobilityAnalyzer',
      version: '1.0.0',
      model: 'llama-3.3-70b'
    });
  }

  /**
   * Enrich context with mobility/traffic data
   */
  async enrichContext(context) {
    // 1. Ensure we have a valid venue
    let venue = context.venue || context.location;
    if (!venue) {
      venue = VenueExtractor.extractFromMarket(context);
    }
    
    if (!venue) {
      throw new Error('Mobility analysis requires a resolvable venue');
    }

    // 2. Fetch Mobility Data (Simulated for Hackathon/Demo)
    // In a real prod environment, this would hit the Google Places API or scraping service
    const mobilityData = await this.fetchSimulatedMobilityData(venue);
    
    return {
      ...context,
      venue,
      mobilityData,
      mobilityHash: this.generateHash(mobilityData) // Hash the mobility state
    };
  }

  /**
   * Construct a mobility-specific prompt
   */
  constructPrompt(context) {
    const { title, mobilityData, currentOdds } = context;
    const mobilityText = `Current Status: ${mobilityData.status}, Crowd Level: ${mobilityData.crowdLevel}%, Trend: ${mobilityData.trend}`;

    return `
      Analyze this prediction market based on local mobility and crowd patterns:
      Market: "${title}"
      Current Odds: Yes ${currentOdds?.yes || 0.5} | No ${currentOdds?.no || 0.5}
      Mobility Data: ${mobilityText}
      
      Does the crowd turnout or traffic significantly impact this outcome?
      (e.g., low turnout affecting home team advantage, or high traffic affecting logistics)
      
      Provide:
      1. Confidence (HIGH/MEDIUM/LOW)
      2. Odds Efficiency (INEFFICIENT/EFFICIENT)
      3. Brief Digest (max 200 chars)
    `;
  }

  /**
   * Simulate fetching data from "Google Popular Times"
   */
  async fetchSimulatedMobilityData(venue) {
    // Deterministic simulation based on venue string length
    const randomSeed = venue.length; 
    const isBusy = randomSeed % 2 === 0;
    
    return {
      status: isBusy ? "Busy" : "Quiet",
      crowdLevel: isBusy ? 85 + (randomSeed % 15) : 20 + (randomSeed % 20),
      trend: isBusy ? "Increasing" : "Decreasing",
      lastUpdated: new Date().toISOString()
    };
  }
}
