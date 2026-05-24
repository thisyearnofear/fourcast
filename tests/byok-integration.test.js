// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserPreferences } from '../services/userPreferences.js';
import { AIRouter } from '../services/aiRouter.js';
import { GeminiService } from '../services/geminiService.js';

const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

const VALID_KEY = 'AIza-test-key-123';

describe('BYOK Integration System', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('UserPreferences', () => {
    it('should store and retrieve Gemini API key securely', () => {
      UserPreferences.setUserGeminiKey(VALID_KEY);
      const retrievedKey = UserPreferences.getUserGeminiKey();
      expect(retrievedKey).toBe(VALID_KEY);
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
      expect(UserPreferences.isBYOKEnabled()).toBe(false);

      UserPreferences.setUserGeminiKey(VALID_KEY);
      UserPreferences.setAIProvider('gemini');
      expect(UserPreferences.isBYOKEnabled()).toBe(true);

      UserPreferences.setAIProvider('venice');
      expect(UserPreferences.isBYOKEnabled()).toBe(false);
    });
  });

  describe('AIRouter Integration', () => {
    it('should default to Venice AI when no user preference set', () => {
      const router = new AIRouter();
      const status = router.getProviderStatus();

      expect(status.currentPreference).toBe('venice');
      expect(status.routingMode).toBe('default-venice');
      expect(status.venice).toBeDefined();
    });

    it('should use Gemini when user preference and BYOK enabled', () => {
      UserPreferences.setUserGeminiKey(VALID_KEY);
      UserPreferences.setAIProvider('gemini');

      const router = new AIRouter();
      const status = router.getProviderStatus();

      expect(status.currentPreference).toBe('gemini');
      expect(status.gemini.userProvided).toBe(true);
      expect(status.gemini.available).toBe(true);
      expect(status.routingMode).toBe('user-gemini');
    });

    it('should fallback to Venice when Gemini fails', async () => {
      UserPreferences.setUserGeminiKey(VALID_KEY);
      UserPreferences.setAIProvider('gemini');

      const router = new AIRouter();

      router.geminiService.analyze = vi.fn().mockRejectedValue(new Error('API Error'));

      const mockVeniceResult = { assessment: { confidence: 'LOW' } };
      const _originalAnalyzeMarket = router.veniceService.analyzeMarket;
      router.veniceService.analyzeMarket = vi.fn().mockResolvedValue(mockVeniceResult);

      const result = await router.analyze({
        market: { title: 'Test Market' },
        weatherData: null,
      });

      expect(result).toMatchObject(mockVeniceResult);
      expect(result.providerUsed).toBe('venice');
    });
  });

  describe('GeminiService BYOK', () => {
    it('should use user-provided API key when available', async () => {
      const service = new GeminiService();

      const mockResponse = {
        candidates: [{ content: { parts: [{ text: '{"confidence":"LOW"}' }] } }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await service.analyze(
        { title: 'Test Market' },
        { apiKey: VALID_KEY }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-api-key': VALID_KEY,
          }),
        })
      );
    });

    it('should handle missing API key gracefully', async () => {
      const service = new GeminiService();

      await expect(service.analyze({ title: 'Test Market' }))
        .rejects
        .toThrow('No Gemini API key provided. Please set your API key in settings.');
    });
  });
});
