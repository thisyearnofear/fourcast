import { getCalibrationAnalysis } from '@/services/db';

export const runtime = 'nodejs';

/**
 * GET /api/agent/calibration
 *
 * Returns bucketed calibration data that proves the system's confidence
 * levels are well-calibrated — not overconfident, not random.
 *
 * Response shape (schema 'calibration/v2' — every metric also appears in its
 * legacy snake_case form while consumers migrate):
 * {
 *   success: true,
 *   schema: 'calibration/v2',
 *   summary: { totalResolved, avgBrier, avgLogLoss, minBucket, maxBucket },
 *   buckets: [
 *     { bucket, count, hitRate, avgBrier, avgLogLoss, avgProbability, midpointConfidence },
 *     ...
 *   ],
 *   trend: [{ month, count, avgBrier, avgLogLoss }, ...],
 *   sourceCal: [{ source, count, avgBrier, avgLogLoss, hitRate }, ...]
 * }
 *
 * Query params:
 *   - operatorId: optional, scoped calibration for a specific operator
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const operatorId = searchParams.get('operatorId') || null;

    const result = await getCalibrationAnalysis(operatorId);
    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('[GET /api/agent/calibration]', error);
    return Response.json(
      { success: false, error: 'Failed to fetch calibration data' },
      { status: 500 },
    );
  }
}
