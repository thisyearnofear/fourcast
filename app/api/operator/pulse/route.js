import {
  getAgentTrackRecord,
  getAutopilotExecutions,
  getAutopilotSchedule,
  query,
} from '@/services/db';

export const runtime = 'nodejs';

/**
 * A deliberately small, cache-friendly snapshot for the operator chrome.
 * It only reads records Fourcast already writes; the pulse never invents
 * activity to make an empty system look busy.
 */
export async function GET() {
  try {
    const [trackRecord, executions, schedule, runRows, edgeRows] = await Promise.all([
      getAgentTrackRecord(),
      getAutopilotExecutions(1),
      getAutopilotSchedule(),
      query(
        `SELECT markets_scanned, candidates_filtered, forecasts_made, timestamp
         FROM agent_runs ORDER BY timestamp DESC LIMIT 1`
      ),
      query(
        `SELECT COUNT(*) AS count FROM agent_forecasts
         WHERE edge >= 0.05 AND timestamp >= ?`,
        [Math.floor(Date.now() / 1000) - 86400]
      ),
    ]);

    const latestRun = runRows[0] || null;
    const latestExecution = executions.success ? executions.executions[0] || null : null;
    const totalForecasts = Number(trackRecord.stats?.total_forecasts || 0);

    return Response.json({
      success: true,
      pulse: {
        mode: schedule.schedule?.enabled
          ? (schedule.schedule.dryRun ? 'DRY RUN' : 'LIVE')
          : 'STANDBY',
        lastRunAt: latestRun?.timestamp || schedule.schedule?.lastRunAt || null,
        marketsScanned: Number(latestRun?.markets_scanned || 0),
        candidates: Number(latestRun?.candidates_filtered || 0),
        forecastsMade: Number(latestRun?.forecasts_made || 0),
        freshEdges: Number(edgeRows[0]?.count || 0),
        totalForecasts,
        latestExecutionAt: latestExecution?.timestamp || null,
        latestExecutionStatus: latestExecution?.execution_status || null,
      },
    }, {
      headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=40' },
    });
  } catch (error) {
    console.error('Operator pulse API error:', error);
    return Response.json({ success: false, error: 'Operator pulse unavailable' }, { status: 503 });
  }
}
