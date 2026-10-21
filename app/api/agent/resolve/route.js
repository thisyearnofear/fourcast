import { resolveForecast } from '@/services/db';
import { rememberResolution } from '@/services/memory/resolutionTrigger';

/**
 * Resolve a forecast with actual outcome and calculate Brier score
 * POST /api/agent/resolve
 * Body: { marketId: string, actualOutcome: number (0 or 1) }
 *
 * A resolution is also the trigger for a Walrus Memory append — the moment a
 * belief becomes evidence. With FOURCAST_MEMORY_ENABLED unset, memoryStatus()
 * reports not-writable and the call returns without touching the network: the
 * delegate key is server-only (never on Vercel) and memory is never load-bearing
 * for scoring.
 */
export const runtime = 'nodejs';

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

    const memory = await rememberResolution({ marketId, triggerReceipt: null });

    return Response.json({
      success: true,
      resolved: result.resolved,
      memory: {
        written: memory.written?.filter((w) => w.ok).length || 0,
        skipped: Boolean(memory.skipped),
        reason: memory.reason || memory.error || null,
      },
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
