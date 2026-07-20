import { randomUUID } from 'crypto';
import { saveMandate, getMandate } from '@/services/db';
import { DECISION_POLICY_VERSION } from '@/services/domain/decision/decisionPolicy';

export const runtime = 'nodejs';

/**
 * POST /api/agent/mandate
 *
 * Persist a mandate draft (Slice 4 of the self-serve concierge path). The
 * client sends the four policy knobs; the server assigns (or reuses) an
 * operator_id and returns it. The client stores the operator_id in
 * localStorage so subsequent saves update the same mandate.
 *
 * No auth in this slice — operator_id is an unauthenticated UUID. Auth +
 * private mandates are a Premium-tier feature, post-concierge-test.
 *
 * Body: {
 *   operatorId?: string,         // omit on first save; reuse on subsequent saves
 *   minAbsoluteEdge: number,     // 0-1
 *   maxAllocationPct: number,    // 0-1
 *   maxLossProbability: number,  // 0-1
 *   simulationRuns: number,      // 100-100000
 *   displayName?: string,
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const minAbsoluteEdge = Number(body.minAbsoluteEdge);
    const maxAllocationPct = Number(body.maxAllocationPct);
    const maxLossProbability = Number(body.maxLossProbability);
    const simulationRuns = Number(body.simulationRuns);

    if (![minAbsoluteEdge, maxAllocationPct, maxLossProbability, simulationRuns].every(Number.isFinite)) {
      return Response.json(
        { success: false, error: 'All four policy knobs must be finite numbers' },
        { status: 400 },
      );
    }
    if (minAbsoluteEdge < 0 || minAbsoluteEdge > 1) {
      return Response.json({ success: false, error: 'minAbsoluteEdge must be between 0 and 1' }, { status: 400 });
    }
    if (maxAllocationPct <= 0 || maxAllocationPct > 1) {
      return Response.json({ success: false, error: 'maxAllocationPct must be between 0 and 1' }, { status: 400 });
    }
    if (maxLossProbability < 0 || maxLossProbability > 1) {
      return Response.json({ success: false, error: 'maxLossProbability must be between 0 and 1' }, { status: 400 });
    }
    if (simulationRuns < 100 || simulationRuns > 100_000) {
      return Response.json({ success: false, error: 'simulationRuns must be between 100 and 100000' }, { status: 400 });
    }

    // Reuse the provided operatorId if present and well-formed; otherwise mint
    // a fresh UUID. The client stores this in localStorage and reuses it on
    // subsequent saves so the mandate is updated in place.
    let operatorId = null;
    if (typeof body.operatorId === 'string' && /^[0-9a-f-]{36}$/i.test(body.operatorId)) {
      operatorId = body.operatorId;
    } else {
      operatorId = randomUUID();
    }

    const displayName = typeof body.displayName === 'string' && body.displayName.trim()
      ? body.displayName.trim().slice(0, 80)
      : null;

    const result = await saveMandate({
      operatorId,
      minAbsoluteEdge,
      maxAllocationPct,
      maxLossProbability,
      simulationRuns: Math.floor(simulationRuns),
      policyVersion: DECISION_POLICY_VERSION,
      displayName,
    });

    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }

    return Response.json({
      success: true,
      operatorId,
      updatedAt: result.updatedAt,
      trackRecordUrl: `/agent/${operatorId}`,
    });
  } catch (error) {
    console.error('[POST /api/agent/mandate]', error);
    return Response.json({ success: false, error: error.message || 'Failed to save mandate' }, { status: 500 });
  }
}

/**
 * GET /api/agent/mandate?operatorId=<uuid>
 *
 * Read a persisted mandate draft. Used by the /agent/[operatorId] page to
 * pre-populate the MandateBuilder with the operator's saved policy.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const operatorId = url.searchParams.get('operatorId');
    if (!operatorId || !/^[0-9a-f-]{36}$/i.test(operatorId)) {
      return Response.json({ success: false, error: 'A valid operatorId query parameter is required' }, { status: 400 });
    }
    const result = await getMandate(operatorId);
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
    return Response.json({ success: true, mandate: result.mandate });
  } catch (error) {
    console.error('[GET /api/agent/mandate]', error);
    return Response.json({ success: false, error: 'Failed to fetch mandate' }, { status: 500 });
  }
}
