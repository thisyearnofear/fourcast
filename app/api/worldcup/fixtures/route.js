import txlineService from '@/services/txline/txlineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [{ fixtures, mode, fallback }, status] = await Promise.all([
      txlineService.getFixtures(),
      Promise.resolve(txlineService.getTxlineStatus()),
    ]);

    return Response.json({
      success: true,
      provider: 'txline',
      mode,
      fallback,
      fixtures,
      total: fixtures.length,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/fixtures]', err);
    return Response.json(
      {
        success: false,
        provider: 'txline',
        error: err.message,
        fixtures: [],
        total: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
