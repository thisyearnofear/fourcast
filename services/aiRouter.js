/**
 * AI Router Service - Enhanced with BYOK (Bring Your Own Key) support
 * Maintains existing Venice AI as primary while adding Gemini 3 as user-controlled enhancement
 */

import { UserPreferences } from './userPreferences.js';
import { aiService as veniceAIService } from './aiService.js';
import { GeminiService } from './geminiService.js';

export class AIRouter {
  constructor() {
    this.veniceService = veniceAIService;
    this.geminiService = new GeminiService();
    this.preferences = UserPreferences;
  }

  /**
   * Enhanced analysis with intelligent provider routing
   * @param {Object} params - Analysis parameters
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Analysis result with provider metadata
   */
  async analyze(params, options = {}) {
    const userPreference = this.preferences.getAIProvider();
    const byokEnabled = this.preferences.isBYOKEnabled();
    const userGeminiKey = this.preferences.getUserGeminiKey();
    
    console.log(`🤖 AI Router: User preference = ${userPreference}, BYOK enabled = ${byokEnabled}`);

    // ENHANCEMENT: User preference takes priority when BYOK is enabled
    if (userPreference === 'gemini' && byokEnabled && userGeminiKey) {
      try {
        console.log('🤖 Using user-provided Gemini 3 API (BYOK mode)');
        const result = await this.geminiService.analyze(params, {
          apiKey: userGeminiKey
        });
        
        return {
          ...result,
          providerUsed: 'gemini',
          enhancement: 'BYOK Gemini 3',
          metadata: {
            routing: 'user-preference',
            fallbackAvailable: true
          }
        };
      } catch (geminiError) {
        console.warn('User Gemini API failed, falling back to Venice AI:', geminiError.message);
        // Continue to fallback logic below
      }
    }
    
    // Default to Venice AI (your credits) - maintains existing reliability
    console.log('🌤️ Using Venice AI (default - your credits)');
    try {
      const result = await this.veniceService.analyzeMarket(params.market, params.weatherData);
      
      return {
        ...result,
        providerUsed: 'venice',
        enhancement: 'Reliable Venice AI',
        metadata: {
          routing: 'default-fallback',
          userPreference: userPreference
        }
      };
    } catch (veniceError) {
      console.error('Primary AI service failed:', veniceError);
      throw new Error(`AI analysis failed: ${veniceError.message}`);
    }
  }

  /**
   * Get current provider status for UI display
   * @returns {Object} Status information
   */
  getProviderStatus() {
    return {
      venice: { 
        available: !!process.env.VENICE_API_KEY, 
        credits: 'yours',
        status: process.env.VENICE_API_KEY ? 'active' : 'missing-key'
      },
      gemini: { 
        available: this.preferences.isBYOKEnabled(),
        userProvided: !!this.preferences.getUserGeminiKey(),
        status: this.preferences.isBYOKEnabled() ? 'user-enabled' : 'not-configured'
      },
      currentPreference: this.preferences.getAIProvider(),
      routingMode: this.preferences.getAIProvider() === 'gemini' && this.preferences.isBYOKEnabled() 
        ? 'user-gemini' 
        : 'default-venice'
    };
  }

  /**
   * Test connection to user-provided Gemini API
   * @param {string} apiKey - User's Gemini API key
   * @returns {Promise<boolean>} Connection success
   */
  async testUserGeminiConnection(apiKey) {
    try {
      const testResult = await this.geminiService.testConnection(apiKey);
      return testResult.success;
    } catch (error) {
      console.error('Gemini connection test failed:', error);
      return false;
    }
  }

  /**
   * Reset to default Venice AI only mode
   */
  resetToDefault() {
    this.preferences.setAIProvider('venice');
    this.preferences.setBYOKEnabled(false);
    console.log('🔄 Reset to default Venice AI mode');
  }
}

// Singleton instance for consistent usage across application
export const aiRouter = new AIRouter();