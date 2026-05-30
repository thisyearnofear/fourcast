import axios from 'axios';
import puppeteer from 'puppeteer-core';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_ENTRIES = 200;

/**
 * Bright Data Service
 * Provides access to Bright Data SERP API, Scraping Browser, and Web Unlocker.
 *
 * Products used:
 *  - SERP API: structured search results from Google (organic, knowledge, PAA)
 *  - Scraping Browser: JS-rendered page scraping with CAPTCHA solving
 *  - Web Unlocker: HTTP-based bot-detection bypass for static pages
 */
class BrightDataService {
  constructor() {
    this.apiKey = process.env.BRIGHT_DATA_API_KEY;
    this.serpZone = process.env.BRIGHT_DATA_SERP_ZONE;
    this.unlockerZone = process.env.BRIGHT_DATA_UNLOCKER_ZONE;
    this.sbrWsEndpoint = process.env.BRIGHT_DATA_SBR_WS_ENDPOINT;
    this.sbrAuth = process.env.BRIGHT_DATA_SBR_AUTH;

    this.enabled = !!(this.apiKey && this.serpZone);
    this.sbrEnabled = !!(this.sbrWsEndpoint || this.sbrAuth);
    this.unlockerEnabled = !!(this.apiKey && this.unlockerZone);

    /** @type {Map<string, {data: any, ts: number}>} */
    this._cache = new Map();
  }

  // -- Status --

  /**
   * Returns which Bright Data products are configured and available.
   */
  getStatus() {
    return {
      serp: this.enabled,
      scrapingBrowser: this.sbrEnabled,
      webUnlocker: this.unlockerEnabled,
    };
  }

  // -- Cache --

  _cacheKey(prefix, query) {
    return `${prefix}:${query}`;
  }

  _getCached(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  _setCache(key, data) {
    if (this._cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
    this._cache.set(key, { data, ts: Date.now() });
  }

  // -- SERP API --

  /**
   * Perform a Google Search via Bright Data SERP API.
   * Returns structured results with organic listings, knowledge panels,
   * and "People Also Ask" data.
   *
   * @param {string} query - The search query
   * @param {Object} options - { gl, hl, useCache }
   * @returns {Promise<{organic: Array, knowledge?: object, people_also_ask?: Array, general?: object}>}
   */
  async search(query, options = {}) {
    if (!this.enabled) {
      console.warn('[BrightData] SERP API not configured (missing BRIGHT_DATA_API_KEY or BRIGHT_DATA_SERP_ZONE).');
      return { organic: [] };
    }

    const useCache = options.useCache !== false;
    const cacheKey = this._cacheKey('serp', query);

    if (useCache) {
      const cached = this._getCached(cacheKey);
      if (cached) {
        console.log(`[BrightData] SERP cache hit for: "${query.substring(0, 60)}..."`);
        return cached;
      }
    }

    try {
      const gl = options.gl || 'us';
      const hl = options.hl || 'en';

      const response = await axios.post(
        'https://api.brightdata.com/request',
        {
          zone: this.serpZone,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${gl}&hl=${hl}`,
          format: 'json',
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      let data = response.data;

      // Bright Data wraps responses in {status_code, headers, body} — unwrap if needed
      if (data.body && !data.organic) {
        try {
          data = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        } catch {
          console.warn('[BrightData] Failed to parse SERP body, using raw response');
        }
      }

      if (!data.organic) {
        data.organic = [];
      }

      if (useCache && data.organic.length > 0) {
        this._setCache(cacheKey, data);
      }

      console.log(
        `[BrightData] SERP returned ${data.organic.length} organic results for: "${query.substring(0, 60)}..."`
      );

      return data;
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data || error.message;
      console.error(`[BrightData] SERP API failed (status=${status}):`, detail);

      return {
        organic: [],
        error: {
          status: status || 'network',
          message: typeof detail === 'string' ? detail.substring(0, 200) : 'Request failed',
        },
      };
    }
  }

  // -- Scraping Browser (Puppeteer) --

  /**
   * Scrape a website using Bright Data Scraping Browser.
   * Handles JS-rendered pages, CAPTCHAs, and bot detection automatically.
   *
   * @param {string} url - Target URL
   * @returns {Promise<{text: string, title: string, url: string, charCount: number, sentenceCount: number} | null>}
   */
  async scrapeWithBrowser(url) {
    if (!this.sbrEnabled) {
      console.warn('[BrightData] Scraping Browser not configured (missing SBR_WS_ENDPOINT or SBR_AUTH).');
      return null;
    }

    const cacheKey = this._cacheKey('sbr', url);
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    let browser;
    try {
      const endpoint = this.sbrWsEndpoint || `wss://${this.sbrAuth}@brd.superproxy.io:9222`;
      console.log(`[BrightData] Scraping Browser connecting for: ${url}`);

      browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(30_000); // 30s — fits within Vercel 60s function limit

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Brief pause for JS-rendered content
      await new Promise((r) => setTimeout(r, 2000));

      const result = await page.evaluate(() => {
        // Remove noise elements
        document.querySelectorAll('script, style, noscript, nav, footer, header').forEach((el) => el.remove());

        // Prefer article/main content, fall back to body
        const article = document.querySelector('article, main, [role="main"], .content, .article-body');
        const target = article || document.body;

        const title = document.title || '';
        const text = target.innerText || '';

        // Split into sentences for structured extraction
        const sentences = text
          .split(/[.!?\n]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 20 && s.length < 500);

        return { title, fullText: text, sentences };
      });

      // Filter to informative sentences (contain numbers, dates, or key analytical terms)
      const informative = result.sentences
        .filter((s) =>
          /\d/.test(s) ||
          /according|reported|announced|confirmed|evidence|data|percent|rate|price|market|probability|forecast|likely|unlikely|increase|decrease|surge|plunge/i.test(s)
        )
        .slice(0, 30);

      const structured = {
        text: informative.join('. ').substring(0, 8000),
        title: result.title,
        url,
        charCount: result.fullText.length,
        sentenceCount: informative.length,
      };

      this._setCache(cacheKey, structured);
      console.log(`[BrightData] Scraped ${structured.charCount} chars, extracted ${structured.sentenceCount} informative sentences from: ${url}`);

      return structured;
    } catch (error) {
      console.error(`[BrightData] Scraping Browser failed for ${url}:`, error.message);
      return null;
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) { /* ignore close errors */ }
      }
    }
  }

  // -- Web Unlocker --

  /**
   * Fetch a page through Bright Data Web Unlocker.
   * Bypasses bot detection, CAPTCHAs, and geo-blocks via the /request API.
   *
   * @param {string} url - Target URL
   * @param {object} options - { data_format: 'markdown' | 'screenshot' }
   * @returns {Promise<{content: string, url: string} | null>}
   */
  async fetchWithUnlocker(url, options = {}) {
    if (!this.unlockerEnabled) {
      console.warn('[BrightData] Web Unlocker not configured (missing BRIGHT_DATA_UNLOCKER_ZONE).');
      return null;
    }

    const cacheKey = this._cacheKey('unlock', url);
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.post(
        'https://api.brightdata.com/request',
        {
          zone: this.unlockerZone,
          url,
          format: 'raw',
          ...(options.data_format ? { data_format: options.data_format } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const result = {
        content: typeof response.data === 'string'
          ? response.data.substring(0, 8000)
          : JSON.stringify(response.data).substring(0, 8000),
        url,
      };

      this._setCache(cacheKey, result);
      console.log(`[BrightData] Web Unlocker fetched ${result.content.length} chars from: ${url}`);

      return result;
    } catch (error) {
      console.error(`[BrightData] Web Unlocker failed for ${url}:`, error.response?.data || error.message);
      return null;
    }
  }

  // -- Convenience --

  /**
   * Check if any Bright Data product is available.
   */
  isAvailable() {
    return this.enabled || this.sbrEnabled || this.unlockerEnabled;
  }

  /**
   * Clear the cache (useful for testing or forced refresh).
   */
  clearCache() {
    this._cache.clear();
  }
}

export const brightDataService = new BrightDataService();
