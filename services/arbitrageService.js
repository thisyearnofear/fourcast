/**
 * Arbitrage Detection Service
 * Identifies price discrepancies between Polymarket and Kalshi for similar markets
 */

export const arbitrageService = {
    /**
     * Calculate arbitrage opportunities between two markets
     */
    calculateArbitrage(market1, market2) {
        const odds1Yes = market1.currentOdds?.yes || 0.5;
        const odds2Yes = market2.currentOdds?.yes || 0.5;

        // Calculate price difference (in percentage points)
        const priceDiff = Math.abs(odds1Yes - odds2Yes) * 100;

        // Determine which platform has better odds for each side
        const betterYes = odds1Yes > odds2Yes ? market1.platform : market2.platform;
        const betterNo = odds1Yes < odds2Yes ? market1.platform : market2.platform;

        return {
            hasPriceDiff: priceDiff > 5, // 5% threshold
            priceDiff: priceDiff.toFixed(1),
            betterYes,
            betterNo,
            market1Odds: (odds1Yes * 100).toFixed(1),
            market2Odds: (odds2Yes * 100).toFixed(1)
        };
    },

    /**
     * Find similar markets across platforms using title matching
     */
    findSimilarMarkets(markets) {
        const polymarketMarkets = markets.filter(m => m.platform === 'polymarket');
        const kalshiMarkets = markets.filter(m => m.platform === 'kalshi');

        const similarities = [];

        for (const pm of polymarketMarkets) {
            for (const km of kalshiMarkets) {
                const jaccard = this.calculateTitleSimilarity(pm.title, km.title);
                const dice = this.diceCoefficient(pm.title, km.title);

                if (dice >= 0.45 && jaccard >= 0.35) {
                    const arb = this.calculateArbitrage(pm, km);

                    if (arb.hasPriceDiff) {
                        similarities.push({
                            polymarket: pm,
                            kalshi: km,
                            similarity: (jaccard * 100).toFixed(0),
                            arbitrage: arb
                        });
                    }
                }
            }
        }

        // Sort by price difference (highest first)
        return similarities.sort((a, b) =>
            parseFloat(b.arbitrage.priceDiff) - parseFloat(a.arbitrage.priceDiff)
        );
    },

    /**
     * Calculate Dice coefficient using character bigrams
     */
    diceCoefficient(title1, title2) {
        const normalize = (str) => {
            return String(str)
                .toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .replace(/\s+/g, ' ')    // Collapse whitespace
                .trim();
        };

        const s1 = normalize(title1);
        const s2 = normalize(title2);

        if (!s1 && !s2) return 1.0;
        if (!s1 || !s2) return 0.0;

        const bigrams = (str) => {
            const set = new Set();
            for (let i = 0; i < str.length - 1; i++) {
                set.add(str.slice(i, i + 2));
            }
            return set;
        };

        const a = bigrams(s1);
        const b = bigrams(s2);

        const intersection = new Set([...a].filter(x => b.has(x)));

        return (2 * intersection.size) / (a.size + b.size);
    },

    /**
     * Calculate title similarity using Jaccard similarity
     */
    calculateTitleSimilarity(title1, title2) {
        const normalize = (str) => {
            return str
                .toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .split(/\s+/)
                .filter(w => w.length > 3); // Filter short words
        };

        const words1 = new Set(normalize(title1));
        const words2 = new Set(normalize(title2));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    },

    /**
     * Detect arbitrage opportunities in a list of markets
     */
    detectOpportunities(markets) {
        const opportunities = this.findSimilarMarkets(markets);

        return {
            count: opportunities.length,
            opportunities: opportunities.slice(0, 10), // Top 10
            totalMarkets: markets.length,
            polymarketCount: markets.filter(m => m.platform === 'polymarket').length,
            kalshiCount: markets.filter(m => m.platform === 'kalshi').length
        };
    }
};
