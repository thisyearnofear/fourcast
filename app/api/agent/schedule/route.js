import { getAutopilotSchedule, setAutopilotSchedule } from '@/services/db';

export const runtime = 'nodejs';

const VALID_INTERVALS = [15, 30, 60, 120];

function isValidInterval(value) {
  return Number.isInteger(value) && VALID_INTERVALS.includes(value);
}

function isValidDailyCapPct(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isAdminAuthorized(request) {
  const adminSecret = process.env.ADMIN_SECRET;

  // Production requires a configured admin secret.
  if (!adminSecret) {
    return process.env.NODE_ENV === 'development';
  }

  const providedSecret = request.headers.get('x-admin-secret') || '';
  return providedSecret === adminSecret;
}

/**
 * GET /api/agent/schedule
 *
 * Returns the persisted autopilot schedule.
 */
export async function GET() {
  try {
    const result = await getAutopilotSchedule();

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error || 'Failed to read schedule' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      schedule: result.schedule,
    });
  } catch (error) {
    console.error('Get autopilot schedule error:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/schedule
 *
 * Body: {
 *   enabled: boolean,
 *   intervalMinutes: number,
 *   dryRun?: boolean,
 *   dailyCapPct?: number (0-1)
 * }
 *
 * Updates the persisted autopilot schedule. Writes require the admin
 * secret (or development mode when ADMIN_SECRET is unset).
 */
export async function POST(request) {
  try {
    if (!isAdminAuthorized(request)) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { enabled, intervalMinutes, dryRun, dailyCapPct } = body;

    if (typeof enabled !== 'boolean') {
      return Response.json(
        { success: false, error: '`enabled` must be a boolean' },
        { status: 400 }
      );
    }

    if (!isValidInterval(intervalMinutes)) {
      return Response.json(
        { success: false, error: `intervalMinutes must be one of ${VALID_INTERVALS.join(', ')}` },
        { status: 400 }
      );
    }

    if (dryRun !== undefined && typeof dryRun !== 'boolean') {
      return Response.json(
        { success: false, error: '`dryRun` must be a boolean' },
        { status: 400 }
      );
    }

    if (dailyCapPct !== undefined && !isValidDailyCapPct(dailyCapPct)) {
      return Response.json(
        { success: false, error: '`dailyCapPct` must be a number between 0 and 1' },
        { status: 400 }
      );
    }

    const result = await setAutopilotSchedule(enabled, intervalMinutes, dryRun, dailyCapPct);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error || 'Failed to save schedule' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      schedule: result.schedule,
    });
  } catch (error) {
    console.error('Set autopilot schedule error:', error);
    return Response.json(
      { success: false, error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
    },
  });
}
