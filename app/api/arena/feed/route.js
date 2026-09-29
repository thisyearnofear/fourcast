/**
 * GET /api/arena/feed — public read of the arena cycle feed.
 * { latest, runs[] } newest-first, edge-cached briefly.
 */

import { getArenaFeed } from '@/lib/arenaStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 40));
  try {
    const feed = await getArenaFeed({ limit });
    // Server-advertised lane mode. 'paused' (ARENA_LANE_MODE=paused) is the
    // honest steady state when no worker is cycling: the rail reads PAUSED
    // instead of implying a stuck lane will recover. Default: 'live'.
    const laneMode = process.env.ARENA_LANE_MODE === 'paused' ? 'paused' : 'live';
    return Response.json(
      { success: true, laneMode, ...feed },
      { headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' } }
    );
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
