import { getAutopilotSchedule, recordAutopilotRun } from '@/services/db';
import { getDefaultAutopilotConfig, runAutopilotOnce } from '@/services/scheduler';
import { sendTelegramMessage } from '@/services/telegramLinkService';

export const runtime = 'nodejs';

// Cron failures are otherwise invisible — push them to the operator's chat.
// No-ops when TELEGRAM_ADMIN_CHAT_ID or TELEGRAM_BOT_TOKEN is unset.
async function alertAdmin(text) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return;
  try {
    await sendTelegramMessage(chatId, `🚨 *Autopilot cron*\n${text}`);
  } catch (err) {
    console.error('Cron autopilot: admin alert failed:', err.message);
  }
}

/**
 * GET /api/cron/autopilot
 *
 * Triggered by Vercel Cron. Verifies CRON_SECRET, checks the persisted
 * schedule and required env vars, then runs one autopilot pass.
 */
export async function GET(request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization') || '';
    const expectedToken = `Bearer ${process.env.CRON_SECRET || ''}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch persisted schedule
    const scheduleResult = await getAutopilotSchedule();
    if (!scheduleResult.success) {
      return Response.json(
        { success: false, error: scheduleResult.error || 'Failed to read schedule' },
        { status: 500 }
      );
    }

    const schedule = scheduleResult.schedule;

    if (!schedule.enabled) {
      return Response.json(
        { skipped: true, reason: 'disabled' },
        { status: 200 }
      );
    }

    // Honor intervalMinutes as the minimum gap between runs
    const nowSec = Math.floor(Date.now() / 1000);
    const intervalSec = schedule.intervalMinutes * 60;
    if (schedule.lastRunAt && nowSec - schedule.lastRunAt < intervalSec) {
      return Response.json({
        skipped: true,
        reason: 'too soon',
        nextRunAt: schedule.lastRunAt + intervalSec,
        intervalMinutes: schedule.intervalMinutes,
      }, { status: 200 });
    }

    // Must have private key to execute trades
    if (!process.env.POLYMARKET_PRIVATE_KEY) {
      return Response.json(
        { skipped: true, reason: 'missing private key' },
        { status: 200 }
      );
    }

    // Record run timestamp BEFORE running so overlapping invocations hit the
    // interval gate and cannot race past the "too soon" check.
    try {
      await recordAutopilotRun(nowSec);
    } catch (recordErr) {
      console.error('Cron autopilot: failed to record run:', recordErr);
    }

    const result = await runAutopilotOnce({
      ...getDefaultAutopilotConfig(),
      dryRun: schedule.dryRun,
      dailyCapPct: schedule.dailyCapPct,
    });

    if (!result.success) {
      await alertAdmin(`Run failed: ${result.error || 'unknown error'}`);
      return Response.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      executed: result.executed,
      failed: result.failed,
      dryRun: result.dryRun,
      marketsScanned: result.marketsScanned,
      candidatesFiltered: result.candidatesFiltered,
      forecastsMade: result.forecastsMade,
    });
  } catch (error) {
    console.error('Cron autopilot error:', error);
    await alertAdmin(`Route error: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
