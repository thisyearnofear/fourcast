import { getUserStats, getUserPredictions } from '@/services/db.js';

export const runtime = 'nodejs';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        // Defense-in-depth: canonicalize to lowercase at the API boundary so any
        // caller (Spotlight click, MySignalsTab deep-link, future /profile/[address]
        // route) gets the same case-safe resolution. Mirrors the .toLowerCase() applied
        // on insert in services/db.js (saveSignal, openPosition, etc.).
        const address = searchParams.get('address')?.toLowerCase();

        if (!address) {
            return Response.json({ success: false, error: 'Address is required' }, { status: 400 });
        }

        const statsRes = await getUserStats(address);
        const predictionsRes = await getUserPredictions(address, 10); // Last 10 predictions

        if (!statsRes.success) {
            return Response.json({ success: false, error: statsRes.error }, { status: 500 });
        }

        return Response.json({
            success: true,
            profile: {
                stats: statsRes.stats,
                recent_predictions: predictionsRes.predictions || []
            }
        });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
