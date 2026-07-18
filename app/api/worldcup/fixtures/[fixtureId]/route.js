import txlineService from '@/services/txline/txlineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { fixtureId } = await params;
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

    return Response.json({
      success: true,
      provider: 'txline',
      fixtureId,
      ...detail,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/fixtures/[fixtureId]]', err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
