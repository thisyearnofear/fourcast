const BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/v2';

export const kalshiService = {
    /**
     * Fetch markets for a specific series
     */
    async getSeriesMarkets(seriesTicker) {
        try {
            const response = await fetch(`${BASE_URL}/markets?series_ticker=${seriesTicker}&status=open`);
            const data = await response.json();
            return data.markets || [];
        } catch (error) {
            console.error(`Failed to fetch Kalshi markets for series ${seriesTicker}:`, error);
            return [];
        }
    },

    /**
     * Fetch events by category
     */
    async getEventsByCategory(category, limit = 50) {
        try {
            const response = await fetch(`${BASE_URL}/events?status=open&limit=${limit}${category !== 'all' ? `&category=${category}` : ''}`);
            const data = await response.json();
            return data.events || [];
        } catch (error) {
            console.error(`Failed to fetch Kalshi events for category ${category}:`, error);
            return [];
        }
    },

    /**
     * Fetch markets for specific events
     */
    async getMarketsForEvents(eventTickers) {
        const allMarkets = [];

        // Batch requests for efficiency
        const batchSize = 10;
        for (let i = 0; i < eventTickers.length; i += batchSize) {
            const batch = eventTickers.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(ticker =>
                    fetch(`${BASE_URL}/markets?event_ticker=${ticker}&status=open`)
                        .then(r => r.json())
                )
            );

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.markets) {
                    allMarkets.push(...result.value.markets);
                }
            });
        }

        return allMarkets;
    },

    /**
     * Get markets by category
     */
    async getMarketsByCategory(category = 'all', limit = 50) {
        try {
            // For weather, use the optimized series approach
            if (category === 'Climate and Weather') {
                const weatherSeries = ['KXHIGHNY', 'KXHIGHCHI', 'KXHIGHMIA', 'KXHIGHAUS'];
                const allMarkets = [];

                const results = await Promise.allSettled(
                    weatherSeries.map(ticker => this.getSeriesMarkets(ticker))
                );

                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        allMarkets.push(...result.value);
                    }
                });

                return this.normalizeMarkets(allMarkets);
            }

            // For other categories, fetch events first
            const events = await this.getEventsByCategory(category, limit);

            if (events.length === 0) {
                return [];
            }

            // Get markets for these events
            const eventTickers = events.map(e => e.event_ticker).filter(Boolean);
            const markets = await this.getMarketsForEvents(eventTickers.slice(0, 20)); // Limit to 20 events for performance

            return this.normalizeMarkets(markets);
        } catch (error) {
            console.error(`Failed to fetch Kalshi markets for category ${category}:`, error);
            return [];
        }
    },

    /**
     * Normalize Kalshi markets to our internal format
     */
    normalizeMarkets(markets = []) {
        return markets.map(m => {
            const yesPrice = m.yes_ask || m.yes_bid || 50;
            const noPrice = 100 - yesPrice;

            return {
                marketID: m.ticker,
                platform: 'kalshi',
                title: m.title.replace(/\*\*/g, ''), // Remove markdown bolding
                description: m.subtitle,
                location: this.deriveLocation(m.ticker, m.title),
                currentOdds: {
                    yes: yesPrice / 100,
                    no: noPrice / 100
                },
                volume24h: m.volume_24h || m.volume || 0,
                liquidity: m.liquidity || 0,
                resolutionDate: m.close_time,
                eventType: this.deriveEventType(m.ticker, m.title),
                tags: this.deriveTags(m.ticker, m.title),
                teams: [],
                confidence: 'UNKNOWN',
                isWeatherSensitive: this.isWeatherRelated(m.ticker, m.title),

                // Kalshi-specific fields
                kalshiUrl: `https://kalshi.com/markets/${m.ticker.toLowerCase()}`,
                strikePrice: m.strike_price,
                category: m.category
            };
        });
    },

    /**
     * Derive location from ticker or title
     */
    deriveLocation(ticker, title) {
        // Weather markets
        if (ticker.includes('NY')) return 'New York, USA';
        if (ticker.includes('CHI')) return 'Chicago, USA';
        if (ticker.includes('MIA')) return 'Miami, USA';
        if (ticker.includes('AUS')) return 'Austin, USA';

        // Extract from title if possible
        const cityMatch = title.match(/in ([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
        if (cityMatch) return cityMatch[1];

        return 'USA'; // Default for US-based Kalshi
    },

    /**
     * Derive event type from ticker/title
     */
    deriveEventType(ticker, title) {
        if (ticker.startsWith('KXHIGH') || ticker.startsWith('KXPRECIP')) return 'Weather';
        if (ticker.startsWith('KXPRES') || ticker.startsWith('POWER')) return 'Politics';
        if (ticker.startsWith('KXIPO') || ticker.startsWith('KXGDP')) return 'Economics';
        if (ticker.startsWith('KXBTC') || ticker.startsWith('KXETH')) return 'Crypto';

        // Fallback to title analysis
        const titleLower = title.toLowerCase();
        if (titleLower.includes('temperature') || titleLower.includes('weather')) return 'Weather';
        if (titleLower.includes('president') || titleLower.includes('election')) return 'Politics';
        if (titleLower.includes('gdp') || titleLower.includes('economy')) return 'Economics';

        return 'Other';
    },

    /**
     * Derive tags from ticker/title
     */
    deriveTags(ticker, title) {
        const tags = ['Kalshi'];
        const eventType = this.deriveEventType(ticker, title);
        tags.push(eventType);

        if (this.isWeatherRelated(ticker, title)) tags.push('Weather');
        if (ticker.includes('TRUMP')) tags.push('Trump');
        if (title.toLowerCase().includes('ai')) tags.push('AI');

        return tags;
    },

    /**
     * Check if market is weather-related
     */
    isWeatherRelated(ticker, title) {
        return ticker.startsWith('KXHIGH') ||
            ticker.startsWith('KXPRECIP') ||
            title.toLowerCase().includes('temperature') ||
            title.toLowerCase().includes('weather');
    },

    /**
     * Get deep link to Kalshi market page
     */
    getMarketUrl(ticker) {
        return `https://kalshi.com/markets/${ticker.toLowerCase()}`;
    }
};
