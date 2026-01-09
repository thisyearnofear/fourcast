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
     * Get markets by category (Internal EventType -> Kalshi Category)
     */
    async getMarketsByCategory(eventType = 'all', limit = 50) {
        try {
            // Map internal eventType to Kalshi categories
            let kalshiCategory = 'all';
            let specificSeries = null;

            if (eventType === 'Weather') {
                // Weather is handled via specific series tickers
                specificSeries = ['KXHIGHNY', 'KXHIGHCHI', 'KXHIGHMIA', 'KXHIGHAUS'];
            } else if (eventType === 'Politics') {
                kalshiCategory = 'Politics';
            } else if (eventType === 'Economics') {
                kalshiCategory = 'Economics';
            } else if (eventType === 'Crypto') {
                kalshiCategory = 'Financials';
            } else if (eventType === 'Sports' || eventType === 'Soccer' || eventType === 'NFL' || eventType === 'NBA') {
                // Kalshi generally groups these under "Sports" or specific events
                // Note: Kalshi sports coverage varies, we map all to 'Sports' category
                kalshiCategory = 'Sports';
            }

            // CASE 1: Specific Series (e.g. Weather)
            if (specificSeries) {
                const allMarkets = [];
                const results = await Promise.allSettled(
                    specificSeries.map(ticker => this.getSeriesMarkets(ticker))
                );

                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        allMarkets.push(...result.value);
                    }
                });
                return this.normalizeMarkets(allMarkets);
            }

            // CASE 2: Category Search
            const events = await this.getEventsByCategory(kalshiCategory, limit);

            if (!events || events.length === 0) {
                return [];
            }

            // Filter events if needed (e.g. if looking for 'Soccer' specifically within 'Sports')
            // For now, we return all events in the category to maximize discovery

            // Get markets for these events
            const eventTickers = events.map(e => e.event_ticker).filter(Boolean);

            // Limit to top 20 events to avoid rate limits
            const markets = await this.getMarketsForEvents(eventTickers.slice(0, 20));

            return this.normalizeMarkets(markets);
        } catch (error) {
            console.error(`Failed to fetch Kalshi markets for category ${eventType}:`, error);
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
    },

    // ============================================
    // AUTHENTICATION & TRADING METHODS
    // ============================================

    /**
     * Login with email and password
     * Returns: { token, member_id, expiry }
     */
    async login(email, password) {
        try {
            const response = await fetch(`${BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            return {
                token: data.token,
                member_id: data.member_id,
                expiry: Date.now() + (30 * 60 * 1000) // 30 minutes from now
            };
        } catch (error) {
            console.error('Kalshi login failed:', error);
            throw error;
        }
    },

    /**
     * Logout (invalidate token on server)
     */
    async logout(token) {
        try {
            await fetch(`${BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Kalshi logout failed:', error);
        }
    },

    /**
     * Place an order
     * @param {string} token - Auth token
     * @param {object} params - Order parameters
     * @returns {Promise<object>} Order response
     */
    async placeOrder(token, params) {
        try {
            // Generate unique client order ID for deduplication
            const clientOrderId = `fourcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const response = await fetch(`${BASE_URL}/portfolio/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ticker: params.ticker,
                    action: params.action || 'buy',
                    side: params.side, // 'yes' or 'no'
                    count: params.count,
                    type: params.type, // 'limit' or 'market'
                    ...(params.type === 'limit' && { yes_price: Math.round(params.yes_price) }),
                    client_order_id: clientOrderId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Order placement failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Kalshi order placement failed:', error);
            throw error;
        }
    },

    /**
     * Get user balance
     */
    async getBalance(token) {
        try {
            const response = await fetch(`${BASE_URL}/portfolio/balance`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch balance');
            }

            return await response.json();
        } catch (error) {
            console.error('Kalshi balance fetch failed:', error);
            throw error;
        }
    },

    /**
     * Get user orders
     */
    async getUserOrders(token, params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.ticker) queryParams.append('ticker', params.ticker);
            if (params.status) queryParams.append('status', params.status);
            if (params.limit) queryParams.append('limit', params.limit);

            const url = `${BASE_URL}/portfolio/orders${queryParams.toString() ? `?${queryParams}` : ''}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch orders');
            }

            return await response.json();
        } catch (error) {
            console.error('Kalshi orders fetch failed:', error);
            throw error;
        }
    },

    /**
     * Cancel an order
     */
    async cancelOrder(token, orderId) {
        try {
            const response = await fetch(`${BASE_URL}/portfolio/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Order cancellation failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Kalshi order cancellation failed:', error);
            throw error;
        }
    },

    /**
     * Get user positions
     */
    async getPositions(token, params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.ticker) queryParams.append('ticker', params.ticker);
            if (params.limit) queryParams.append('limit', params.limit);

            const url = `${BASE_URL}/portfolio/positions${queryParams.toString() ? `?${queryParams}` : ''}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch positions');
            }

            return await response.json();
        } catch (error) {
            console.error('Kalshi positions fetch failed:', error);
            throw error;
        }
    }
};
