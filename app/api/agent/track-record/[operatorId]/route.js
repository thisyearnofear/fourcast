import { getAgentTrackRecord, getMandate } from '@/services/db';

export const runtime = 'nodejs';

/**
 * GET /api/agent/track-record/[operatorId]
 *
 * Per-operator Track Record URL — the public surface a concierge DM points a
 * prospect at (docs/GO_TO_MARKET.md §2.2 step 4). Returns the same shape as
 * the global /api/agent/track-record, scoped to forecasts the operator wrote
 * with their operator_id (migration 0010), plus their persisted mandate
 * (migration 0011) so the /agent/[operatorId] page can show the policy the
 * track record was produced under.
 *
 * No auth in this slice — operator_id is an unauthenticated UUID. The URL is
 * public by design (it's the OG share card target). Auth + private mandates
 * are a Premium-tier feature, post-concierge-test.
 */
export async function GET(request, { params }) {
  try {
    const operatorId = params?.operatorId;
    if (!operatorId || typeof operatorId !== 'string') {
      return Response.json(
        { success: false, error: 'operatorId is required' },
        { status: 400 },
      );
    }

    const [trackResult, mandateResult] = await Promise.all([
      getAgentTrackRecord(operatorId),
      getMandate(operatorId),
    ]);

    if (!trackResult.success) {
      return Response.json(
        { success: false, error: trackResult.error },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      operatorId,
      stats: trackResult.stats,
      recentForecasts: trackResult.recentForecasts,
      mandate: mandateResult.success ? mandateResult.mandate : null,
    });
  } catch (error) {
    console.error('[GET /api/agent/track-record/[operatorId]]', error);
    return Response.json(
      { success: false, error: 'Failed to fetch operator track record' },
      { status: 500 },
    );
  }
}
