import { getCalibrationAnalysis } from '@/services/db';

export const runtime = 'nodejs';

/**
 * GET /api/agent/calibration
 *
 * Returns bucketed calibration data that proves the system's confidence
 * levels are well-calibrated — not overconfident, not random.
 *
 * Response shape:
 * {
 *   success: true,
 *   summary: { totalResovled, avgBrier, minBucket, maxBucket },
 *   buckets: [
 *     { bucket, count, hitRate, avgBrier, avgProbability, midpointConfidence },
 *     ...
 *   ],
 *   trend: [{ month, count, avgBrier }, ...],
 *   sourceCal: [{ source, count, avgBrier, hitRate }, ...]
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
