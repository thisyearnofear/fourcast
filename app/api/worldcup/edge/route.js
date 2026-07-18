import txlineService from '@/services/txline/txlineService';
import { getCrossVenueEdge } from '@/services/txline/crossVenueEdge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/worldcup/edge?fixtureId=...
 * Compares TxLINE consensus implied probability against Polymarket's YES price
 * for the matching market. Surfaces the cross-venue edge Fourcast is known for.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');
    if (!fixtureId) {
      return Response.json(
        { success: false, error: 'fixtureId is required' },
        { status: 400 }
      );
    }

    const detail = await txlineService.getFixtureDetail(fixtureId);
    if (!detail.fixture) {
      return Response.json(
        { success: false, error: 'Fixture not found', fixtureId },
        { status: 404 }
      );
    }

    const edge = await getCrossVenueEdge(detail.fixture);

    return Response.json({
      success: true,
      provider: 'txline+polymarket',
      fixtureId,
      fixture: {
        home: detail.fixture.home.name,
        away: detail.fixture.away.name,
        kickoff: detail.fixture.kickoff,
        status: detail.fixture.status,
      },
      edge,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/edge]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
