/**
 * Market Counts API Endpoint
 * Returns the number of available markets for each sport
 * Used to show market counts in the UI dropdown
 */

import { polymarketService } from '@/services/polymarketService';

export const runtime = 'nodejs';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const minVolume = parseInt(searchParams.get('minVolume') || '10000');

        // List of all sports we support
        const sports = [
            'Soccer', 'NFL', 'NBA', 'F1', 'MLB',
            'NHL', 'Tennis', 'Cricket', 'Golf'
        ];

        const counts = {};
        let total = 0;

        // Fetch market counts for each sport
        // Use Promise.all for parallel fetching (faster)
        const results = await Promise.allSettled(
            sports.map(async (sport) => {
                const result = await polymarketService.buildMarketCatalog(minVolume, sport);
                return {
                    sport,
                    count: result.markets?.length || 0
                };
            })
        );

        // Process results
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { sport, count } = result.value;
                counts[sport] = count;
                total += count;
            } else {
                // If a sport fails, set count to 0
                console.error(`Failed to fetch ${result.reason}`);
            }
        }

        // Add total count
        counts.total = total;
        counts.timestamp = new Date().toISOString();

        return Response.json({
            success: true,
            counts,
            minVolume
        });

    } catch (error) {
        console.error('Error fetching market counts:', error);
        return Response.json({
            success: false,
            error: error.message,
            counts: {}
        }, { status: 500 });
    }
}
