const BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/v2';

export const kalshiService = {
    /**
     * Fetch markets for a specific series
     */
    async getSeriesMarkets(seriesTicker) {
        try {
            const url = `${BASE_URL}/markets?series_ticker=${seriesTicker}&status=open`;
            console.log(`[Kalshi Service] Fetching series markets from: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Kalshi API Error ${response.status}: ${errorText}`);
                return [];
            }
            
            const data = await response.json();
            return data.markets || [];
        } catch (error) {
            console.error(`Failed to fetch Kalshi markets for series ${seriesTicker}:`, error.message);
            return [];
        }
    },

    /**
     * Fetch events by category
     */
    async getEventsByCategory(category, limit = 50) {
        try {
            const url = `${BASE_URL}/events?status=open&limit=${limit}${category !== 'all' ? `&category=${category}` : ''}`;
            console.log(`[Kalshi Service] Fetching events from: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Kalshi API Error ${response.status}: ${errorText}`);
                if (response.status === 401) {
                    console.error('Kalshi API authentication failed - check API key or endpoint');
                }
                return [];
            }
            
            const data = await response.json();
            return data.events || [];
        } catch (error) {
            console.error(`Failed to fetch Kalshi events for category ${category}:`, error.message);
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
     * Enhanced to be more inclusive and discover diverse markets
     */
    async getMarketsByCategory(eventType = 'all', limit = 50) {
        try {
            console.log(`[Kalshi Service] Fetching markets for category: ${eventType}`);
            
            // Map internal eventType to Kalshi categories with expanded coverage
            let kalshiCategory = 'all';
            let specificSeries = null;
            let shouldFetchAllCategories = false;

            // Enhanced category mapping with better coverage
            if (eventType === 'Weather') {
                // Weather markets - expanded to more cities
                specificSeries = ['KXHIGHNY', 'KXHIGHCHI', 'KXHIGHMIA', 'KXHIGHAUS', 'KXHIGHSEA', 'KXHIGHDEN'];
            } else if (eventType === 'Politics') {
                kalshiCategory = 'Politics';
            } else if (eventType === 'Economics') {
                kalshiCategory = 'Economics';
            } else if (eventType === 'Crypto') {
                kalshiCategory = 'Financials';
            } else if (eventType === 'Sports' || eventType === 'Soccer' || eventType === 'NFL' || eventType === 'NBA') {
                kalshiCategory = 'Sports';
            } else if (eventType === 'Entertainment') {
                kalshiCategory = 'Entertainment';
            } else if (eventType === 'Science') {
                kalshiCategory = 'Science';
            } else if (eventType === 'Health') {
                kalshiCategory = 'Health';
            } else if (eventType === 'all') {
                // For 'all' category, fetch from multiple popular categories
                shouldFetchAllCategories = true;
            }

            // CASE 1: Specific Series (e.g. Weather with expanded cities)
            if (specificSeries) {
                console.log(`[Kalshi Service] Fetching specific series: ${specificSeries.join(', ')}`);
                const allMarkets = [];
                const results = await Promise.allSettled(
                    specificSeries.map(ticker => this.getSeriesMarkets(ticker))
                );

                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        console.log(`[Kalshi Service] Found ${result.value.length} markets for ${specificSeries[index]}`);
                        allMarkets.push(...result.value);
                    } else {
                        console.warn(`[Kalshi Service] Failed to fetch ${specificSeries[index]}:`, result.reason?.message);
                    }
                });
                
                const normalized = this.normalizeMarkets(allMarkets);
                console.log(`[Kalshi Service] Returning ${normalized.length} normalized weather markets`);
                return normalized;
            }

            // CASE 2: Fetch from multiple categories for 'all' eventType
            if (shouldFetchAllCategories) {
                console.log('[Kalshi Service] Fetching markets from multiple categories for "all"');
                const categoriesToFetch = ['Politics', 'Economics', 'Sports', 'Entertainment', 'Science', 'Health'];
                const allMarkets = [];
                
                const results = await Promise.allSettled(
                    categoriesToFetch.map(category => 
                        this.getEventsByCategory(category, Math.ceil(limit / categoriesToFetch.length))
                    )
                );

                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value.length > 0) {
                        console.log(`[Kalshi Service] Found ${result.value.length} events in ${categoriesToFetch[index]}`);
                        const eventTickers = result.value.map(e => e.event_ticker).filter(Boolean);
                        // Get markets for top events in each category
                        allMarkets.push(...eventTickers.slice(0, 5).map(ticker => 
                            this.getMarketsForSingleEvent(ticker)
                        ));
                    }
                });

                // Flatten and normalize
                const flattenedMarkets = (await Promise.all(allMarkets)).flat().filter(Boolean);
                const normalized = this.normalizeMarkets(flattenedMarkets);
                console.log(`[Kalshi Service] Returning ${normalized.length} markets from all categories`);
                return normalized;
            }

            // CASE 3: Category Search (default behavior)
            console.log(`[Kalshi Service] Fetching events for category: ${kalshiCategory}`);
            const events = await this.getEventsByCategory(kalshiCategory, limit);

            if (!events || events.length === 0) {
                console.log(`[Kalshi Service] No events found for category: ${kalshiCategory}`);
                return [];
            }

            console.log(`[Kalshi Service] Found ${events.length} events in category ${kalshiCategory}`);

            // Get markets for these events
            const eventTickers = events.map(e => e.event_ticker).filter(Boolean);
            
            // Limit to top events but be more generous than before
            const markets = await this.getMarketsForEvents(eventTickers.slice(0, 30));

            const normalized = this.normalizeMarkets(markets);
            console.log(`[Kalshi Service] Returning ${normalized.length} normalized markets for category ${eventType}`);
            return normalized;
        } catch (error) {
            console.error(`[Kalshi Service] Failed to fetch markets for category ${eventType}:`, error);
            return [];
        }
    },

    /**
     * Fetch markets for a single event ticker
     * Helper method for better error handling
     */
    async getMarketsForSingleEvent(eventTicker) {
        try {
            const response = await fetch(`${BASE_URL}/markets?event_ticker=${eventTicker}&status=open`);
            const data = await response.json();
            return data.markets || [];
        } catch (error) {
            console.warn(`[Kalshi Service] Failed to fetch markets for event ${eventTicker}:`, error.message);
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
