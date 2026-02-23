import { resolveForecast } from '@/services/db';

/**
 * Resolve a forecast with actual outcome and calculate Brier score
 * POST /api/agent/resolve
 * Body: { marketId: string, actualOutcome: number (0 or 1) }
 */
export async function POST(request) {
  try {
    const { marketId, actualOutcome } = await request.json();

    if (!marketId || actualOutcome == null) {
      return Response.json(
        { success: false, error: 'marketId and actualOutcome required' },
        { status: 400 }
      );
    }

    if (actualOutcome !== 0 && actualOutcome !== 1) {
      return Response.json(
        { success: false, error: 'actualOutcome must be 0 or 1' },
        { status: 400 }
      );
    }

    const result = await resolveForecast(marketId, actualOutcome);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      resolved: result.resolved,
      message: `Resolved ${result.resolved} forecast(s) for market ${marketId}`,
    });
  } catch (error) {
    console.error('Resolve forecast API error:', error);
    return Response.json(
      { success: false, error: 'Failed to resolve forecast' },
      { status: 500 }
    );
  }
}
