import { getLeaderboard } from '@/services/db.js';

export const runtime = 'nodejs';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        const res = await getLeaderboard(limit);

        if (!res.success) {
            return Response.json({ success: false, error: res.error }, { status: 500 });
        }

        return Response.json({ success: true, leaderboard: res.leaderboard });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
