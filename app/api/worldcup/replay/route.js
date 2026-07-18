import txlineService from '@/services/txline/txlineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/worldcup/replay
 *   Returns the list of fixture ids that have a cached deterministic replay.
 *
 * GET /api/worldcup/replay?fixtureId=18241006
 *   Returns the cached event stream for one fixture so the UI can step through
 *   score/odds updates without a live TxLINE connection.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');

    if (!fixtureId) {
      return Response.json({
        success: true,
        provider: 'txline',
        mode: 'replay',
        available: txlineService.listReplayFixtureIds(),
        timestamp: new Date().toISOString(),
      });
    }

    const replay = txlineService.readReplayFixture(fixtureId);
    if (!replay) {
      return Response.json(
        { success: false, error: 'No cached replay for fixture', fixtureId },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      provider: 'txline',
      mode: 'replay',
      fixtureId,
      fixture: txlineService.normalizeFixture(replay.fixture || replay),
      events: replay.events || [],
      proof: replay.proof || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/replay]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
