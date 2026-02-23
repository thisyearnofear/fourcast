/**
 * User Preferences Service - Enhancement Module
 * Manages AI provider preferences and BYOK (Bring Your Own Key) functionality
 * Aligns with core principles: ENHANCEMENT FIRST, PREVENT BLOAT, CLEAN architecture
 */

export class UserPreferences {
  static KEYS = {
    AI_PROVIDER: 'ai-provider-preference',
    GEMINI_KEY: 'user-gemini-api-key', 
    BYOK_ENABLED: 'byok-gemini-enabled',
    PREFERENCE_VERSION: 'preferences-version'
  };
  
  static VERSION = '1.0.0';
  
  /**
   * Securely store user's Gemini API key
   * ENHANCEMENT: Basic encoding for client-side storage
   * In production, consider proper encryption or secure storage
   */
  static setUserGeminiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      console.warn('Invalid API key provided');
      return false;
    }
    
    try {
      // Basic encoding to prevent casual inspection
      const encoded = btoa(apiKey);
      localStorage.setItem(this.KEYS.GEMINI_KEY, encoded);
      localStorage.setItem(this.KEYS.BYOK_ENABLED, 'true');
      return true;
    } catch (error) {
      console.error('Failed to store Gemini API key:', error);
      return false;
    }
  }
  
  /**
   * Retrieve user's Gemini API key
   * ENHANCEMENT: Safe retrieval with validation
   */
  static getUserGeminiKey() {
    try {
      const encoded = localStorage.getItem(this.KEYS.GEMINI_KEY);
      if (!encoded) return null;
      
      const decoded = atob(encoded);
      // Basic validation - Gemini keys typically start with 'AIza' or 'AIx'
      if (decoded.startsWith('AI')) {
        return decoded;
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve Gemini API key:', error);
      return null;
    }
  }
  
  /**
   * Set preferred AI provider
   * ENHANCEMENT: Validation and safe defaults
   */
  static setAIProvider(provider) {
    const validProviders = ['venice', 'gemini', 'auto'];
    
    if (!validProviders.includes(provider)) {
      console.warn(`Invalid provider: ${provider}. Using 'venice' as default.`);
      provider = 'venice';
    }
    
    localStorage.setItem(this.KEYS.AI_PROVIDER, provider);
    localStorage.setItem(this.KEYS.PREFERENCE_VERSION, this.VERSION);
    return provider;
  }
  
  /**
   * Get current AI provider preference
   * ENHANCEMENT: Safe defaults and migration handling
   */
  static getAIProvider() {
    const stored = localStorage.getItem(this.KEYS.AI_PROVIDER);
    const version = localStorage.getItem(this.KEYS.PREFERENCE_VERSION);
    
    // Handle migration from older versions
    if (!version || version !== this.VERSION) {
      this.migratePreferences();
    }
    
    return stored || 'venice'; // Default to Venice AI (your credits)
  }
  
  /**
   * Check if BYOK is properly configured
   * ENHANCEMENT: Comprehensive validation
   */
  static isBYOKEnabled() {
    const byokFlag = localStorage.getItem(this.KEYS.BYOK_ENABLED) === 'true';
    const hasApiKey = !!this.getUserGeminiKey();
    const providerPreference = this.getAIProvider();
    
    return byokFlag && hasApiKey && providerPreference === 'gemini';
  }
  
  /**
   * Get comprehensive provider status
   * ENHANCEMENT: Single source of truth for UI and routing
   */
  static getProviderStatus() {
    return {
      venice: {
        available: !!process.env.VENICE_API_KEY,
        credits: 'yours',
        default: true
      },
      gemini: {
        available: this.isBYOKEnabled(),
        userProvided: !!this.getUserGeminiKey(),
        provider: 'user'
      },
      currentPreference: this.getAIProvider(),
      byokEnabled: this.isBYOKEnabled()
    };
  }
  
  /**
   * Clear all AI preferences (reset to defaults)
   * ENHANCEMENT: Clean state management
   */
  static resetPreferences() {
    const keys = Object.values(this.KEYS);
    keys.forEach(key => localStorage.removeItem(key));
    console.log('AI preferences reset to defaults (Venice AI)');
  }
  
  /**
   * Handle preference migration between versions
   * ENHANCEMENT: Future-proof architecture
   */
  static migratePreferences() {
    // Future migration logic can go here
    localStorage.setItem(this.KEYS.PREFERENCE_VERSION, this.VERSION);
  }
  
  /**
   * Validate API key format (basic validation)
   * ENHANCEMENT: Prevent invalid keys from being stored
   */
  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key must be a string' };
    }
    
    // Basic Gemini API key validation
    if (!apiKey.startsWith('AI')) {
      return { valid: false, error: 'Invalid Gemini API key format' };
    }
    
    if (apiKey.length < 20) {
      return { valid: false, error: 'API key appears too short' };
    }
    
    return { valid: true, error: null };
  }
}

// Export singleton instance for convenience
export const userPreferences = new UserPreferences();