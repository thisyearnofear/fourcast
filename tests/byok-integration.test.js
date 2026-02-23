import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserPreferences } from '../services/userPreferences.js';
import { AIRouter } from '../services/aiRouter.js';
import { GeminiService } from '../services/geminiService.js';

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

// Mock the global localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('BYOK Integration System', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
    // Reset all preferences
    Object.values(UserPreferences.KEYS).forEach(key => {
      window.localStorage.removeItem(key);
    });
  });

  describe('UserPreferences', () => {
    it('should store and retrieve Gemini API key securely', () => {
      const testKey = 'test-gemini-key-123';
      
      UserPreferences.setUserGeminiKey(testKey);
      const retrievedKey = UserPreferences.getUserGeminiKey();
      
      expect(retrievedKey).toBe(testKey);
    });

    it('should handle empty/missing API key gracefully', () => {
      const key = UserPreferences.getUserGeminiKey();
      expect(key).toBeNull();
    });

    it('should manage AI provider preferences', () => {
      UserPreferences.setAIProvider('gemini');
      expect(UserPreferences.getAIProvider()).toBe('gemini');
      
      UserPreferences.setAIProvider('venice');
      expect(UserPreferences.getAIProvider()).toBe('venice');
    });

    it('should correctly detect BYOK enabled status', () => {
      // Should be false when no key provided
      expect(UserPreferences.isBYOKEnabled()).toBe(false);
      
      // Should be false when key provided but not enabled
      UserPreferences.setUserGeminiKey('test-key');
      expect(UserPreferences.isBYOKEnabled()).toBe(false);
      
      // Should be true when both key and enabled flag are set
      UserPreferences.setBYOKEnabled(true);
      expect(UserPreferences.isBYOKEnabled()).toBe(true);
    });
  });

  describe('AIRouter Integration', () => {
    it('should default to Venice AI when no user preference set', () => {
      const router = new AIRouter();
      const status = router.getProviderStatus();
      
      expect(status.preference).toBe('venice');
      expect(status.venice.available).toBe(true); // Assuming VENICE_API_KEY is set
    });

    it('should use Gemini when user preference and BYOK enabled', () => {
      // Setup user preference for Gemini
      UserPreferences.setUserGeminiKey('user-gemini-key');
      UserPreferences.setAIProvider('gemini');
      UserPreferences.setBYOKEnabled(true);
      
      const router = new AIRouter();
      const status = router.getProviderStatus();
      
      expect(status.preference).toBe('gemini');
      expect(status.gemini.userProvided).toBe(true);
      expect(status.gemini.available).toBe(true);
    });

    it('should fallback to Venice when Gemini fails', async () => {
      // Setup for Gemini but mock failure
      UserPreferences.setUserGeminiKey('invalid-key');
      UserPreferences.setAIProvider('gemini');
      UserPreferences.setBYOKEnabled(true);
      
      const router = new AIRouter();
      
      // Mock Gemini service to throw error
      const originalAnalyze = router.geminiService.analyze;
      router.geminiService.analyze = vi.fn().mockRejectedValue(new Error('API Error'));
      
      // Mock Venice service to succeed
      const mockVeniceResult = { analysis: 'Venice fallback result' };
      router.veniceService.analyze = vi.fn().mockResolvedValue(mockVeniceResult);
      
      const result = await router.analyze({ title: 'Test Market' });
      
      expect(result).toEqual(mockVeniceResult);
      expect(router.veniceService.analyze).toHaveBeenCalled();
    });
  });

  describe('GeminiService BYOK', () => {
    it('should use user-provided API key when available', async () => {
      const userApiKey = 'user-provided-key-123';
      const service = new GeminiService();
      
      // Mock the API call
      const mockResponse = { 
        candidates: [{ content: { parts: [{ text: 'Gemini analysis result' }] } }] 
      };
      
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await service.analyze(
        { title: 'Test Market' }, 
        { apiKey: userApiKey }
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-api-key': userApiKey
          })
        })
      );
    });

    it('should handle missing API key gracefully', async () => {
      const service = new GeminiService();
      
      await expect(service.analyze({ title: 'Test Market' }))
        .rejects
        .toThrow('Gemini API key required for BYOK functionality');
    });
  });
});