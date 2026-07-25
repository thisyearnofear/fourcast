import { getContextualData } from '@/services/contextualDataService.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/contextual?title=<market title>
 *
 * Returns 2-4 free macro/sentiment data points relevant to the given
 * prediction market title. Sources: Fear & Greed Index, CoinGecko spot,
 * DeFiLlama TVL/stablecoin, FRED economic indicators.
 *
 * If no data is available (all sources unreachable), returns an empty
 * array — never invents data.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || '';

    if (!title) {
      return Response.json({ success: true, items: [] });
    }

    const items = await getContextualData(title);

    return Response.json(
      { success: true, items },
      { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('[/api/contextual] error:', error.message);
    return Response.json(
      { success: false, items: [], error: 'contextual data unavailable' },
      { status: 503 },
    );
  }
}
