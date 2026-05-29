import axios from 'axios';
import puppeteer from 'puppeteer-core';

/**
 * Bright Data Service
 * Provides access to Bright Data SERP API, Scraping Browser, and Web Unlocker.
 */
class BrightDataService {
  constructor() {
    this.apiKey = process.env.BRIGHT_DATA_API_KEY;
    this.serpZone = process.env.BRIGHT_DATA_SERP_ZONE;
    this.sbrWsEndpoint = process.env.BRIGHT_DATA_SBR_WS_ENDPOINT;

    // Auth string for Scraping Browser: brd-customer-<ID>-zone-<ZONE>:<PASSWORD>
    this.sbrAuth = process.env.BRIGHT_DATA_SBR_AUTH; 

    this.enabled = !!(this.apiKey && this.serpZone);
    this.sbrEnabled = !!(this.sbrWsEndpoint || this.sbrAuth);
  }

  /**
   * Perform a Google Search via Bright Data SERP API
   * @param {string} query - The search query
   * @param {Object} options - Additional options (gl, hl, etc.)
   * @returns {Promise<Object>} Structured search results
   */
  async search(query, options = {}) {
    if (!this.enabled) {
      console.warn('Bright Data SERP API not configured. Falling back to empty results.');
      return { organic_results: [] };
    }

    try {
      const gl = options.gl || 'us';
      const hl = options.hl || 'en';

      const response = await axios.post('https://api.brightdata.com/request', {
        zone: this.serpZone,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${gl}&hl=${hl}`,
        format: 'json',
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Bright Data Search failed:', error.response?.data || error.message);
      return { organic_results: [] };
    }
  }

  /**
   * Scrape a website using Bright Data Scraping Browser (Puppeteer)
   * @param {string} url - Target URL
   * @returns {Promise<string>} Text content of the page
   */
  async scrapeWithBrowser(url) {
    if (!this.sbrEnabled) {
      console.warn('Bright Data Scraping Browser not configured.');
      return '';
    }

    let browser;
    try {
      const endpoint = this.sbrWsEndpoint || `wss://${this.sbrAuth}@brd.superproxy.io:9222`;
      console.log(`[BrightData] Connecting to Scraping Browser for: ${url}`);

      browser = await puppeteer.connect({
        browserWSEndpoint: endpoint,
      });

      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(2 * 60 * 1000); // 2 minutes for CAPTCHA solving

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Extract text content (avoiding script/style tags)
      const textContent = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(s => s.remove());
        return document.body.innerText;
      });

      return textContent.substring(0, 10000); // Limit to 10k chars for LLM
    } catch (error) {
      console.error('Scraping Browser failed:', error.message);
      return '';
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Scrape a website using Web Unlocker (HTTP-based)
...
   * @returns {Promise<string>} HTML content
   */
  async scrapeWithUnlocker(url) {
    if (!this.apiKey) {
      throw new Error('Bright Data API Key missing');
    }

    try {
      // Note: This uses a specific proxy setup usually, 
      // but Bright Data also has an API endpoint for some tasks.
      // For simplicity in this hackathon, we can use the /request endpoint if configured for unlocker.
      const response = await axios.get(url, {
        proxy: {
          protocol: 'http',
          host: 'brd.superproxy.io',
          port: 22225,
          auth: {
            username: `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-${process.env.BRIGHT_DATA_UNLOCKER_ZONE}`,
            password: process.env.BRIGHT_DATA_PASSWORD
          }
        }
      });
      return response.data;
    } catch (error) {
      console.error('Web Unlocker scraping failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.enabled;
  }
}

export const brightDataService = new BrightDataService();
