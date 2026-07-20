import { getAgentRunLedger, getAgentTrackRecord, getMandate } from '@/services/db';
import { sendTelegramMessage } from '@/services/telegramLinkService';

export const runtime = 'nodejs';

/**
 * GET /api/cron/daily-summary
 *
 * Generates the GTM §2.2 step 2 daily summary — the 4-line Telegram DM
 * template the concierge forwards to each operator. Triggered by Vercel Cron
 * once per day. Verifies CRON_SECRET, reads the latest agent run ledger,
 * formats the summary, and sends it to TELEGRAM_ADMIN_CHAT_ID (the concierge).
 *
 * The concierge then hand-tunes and forwards it to the operator per §2.2
 * step 3: "Send one human-led message per day, hand-tuned. Do not automate
 * it." This route automates the *template generation*, not the outreach.
 *
 * When FOURCAST_AGENT_OPERATOR_ID is set, the summary is scoped to that
 * operator's mandate and track record; otherwise it uses the global ledger.
 *
 * Env vars:
 *   CRON_SECRET              — required, verifies Vercel Cron request
 *   TELEGRAM_BOT_TOKEN       — required, sends the message
 *   TELEGRAM_ADMIN_CHAT_ID   — required, the concierge's chat
 *   FOURCAST_AGENT_OPERATOR_ID — optional, scopes the summary to one operator
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const expectedToken = `Bearer ${process.env.CRON_SECRET || ''}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) {
      return Response.json({ skipped: true, reason: 'TELEGRAM_ADMIN_CHAT_ID or TELEGRAM_BOT_TOKEN not set' });
    }

    const operatorId = process.env.FOURCAST_AGENT_OPERATOR_ID || null;
    const [ledgerResult, trackResult, mandateResult] = await Promise.all([
      getAgentRunLedger(5),
      getAgentTrackRecord(operatorId),
      operatorId ? getMandate(operatorId) : Promise.resolve({ success: true, mandate: null }),
    ]);

    const summary = formatDailySummary({
      ledger: ledgerResult.success ? ledgerResult.runs : [],
      stats: trackResult.success ? trackResult.stats : {},
      mandate: mandateResult.success ? mandateResult.mandate : null,
      operatorId,
    });

    await sendTelegramMessage(chatId, summary);

    return Response.json({
      success: true,
      sent: true,
      chatId,
      operatorId: operatorId || null,
      summary,
    });
  } catch (error) {
    console.error('[GET /api/cron/daily-summary]', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Formats the GTM §2.2 step 2 4-line summary template:
 *
 *   "Yesterday your agent scanned N markets.
 *    Spotted X edges ≥5%.
 *    Sized at Y% Kelly per your risk tolerance.
 *    Dry-run P&L if live: +$Z."
 *
 * The template is deliberately close to the GTM doc's wording so the
 * concierge can copy-paste, hand-tune, and forward. When a mandate is
 * present, the risk tolerance line reflects the operator's actual knobs.
 */
function formatDailySummary({ ledger, stats, mandate, operatorId }) {
  const latest = ledger[0];
  const marketsScanned = latest?.summary?.marketsScanned ?? latest?.markets_scanned ?? 0;
  const forecastsMade = latest?.summary?.forecastsMade ?? latest?.forecasts_made ?? 0;

  // Count edges >= 5% from the latest run's decisions
  const decisions = latest?.summary?.proof?.decisions || [];
  const edgesAbove5 = decisions.filter((d) => Math.abs(d?.forecast?.edge || 0) >= 0.05).length;
  const allocations = decisions
    .filter((d) => d?.decision?.verdict === 'ALLOCATE')
    .map((d) => d?.decision?.allocationPct || 0);
  const avgKelly = allocations.length > 0
    ? allocations.reduce((a, b) => a + b, 0) / allocations.length
    : 0;

  // Dry-run P&L estimate: sum of (edge * allocation) across ALLOCATE decisions
  const dryRunPnl = decisions
    .filter((d) => d?.decision?.verdict === 'ALLOCATE')
    .reduce((sum, d) => sum + (d?.forecast?.edge || 0) * (d?.decision?.allocationPct || 0), 0);

  const riskLine = mandate
    ? `Sized at ${(avgKelly * 100).toFixed(1)}% Kelly per your mandate (min edge ${(mandate.minAbsoluteEdge * 100).toFixed(0)}%, max alloc ${(mandate.maxAllocationPct * 100).toFixed(1)}%, loss limit ${(mandate.maxLossProbability * 100).toFixed(0)}%).`
    : `Sized at ${(avgKelly * 100).toFixed(1)}% Kelly per your risk tolerance.`;

  const trackLine = (stats.total_forecasts || 0) > 0
    ? `\n\nTrack record: ${stats.total_forecasts} forecasts, ${stats.resolved_forecasts || 0} resolved${stats.avg_brier_score != null ? `, ${Number(stats.avg_brier_score).toFixed(3)} avg Brier` : ''}.`
    : '';

  const urlLine = operatorId
    ? `\n\nTrack Record URL: https://${process.env.NEXT_PUBLIC_HOST || 'fourcastapp.vercel.app'}/agent/${operatorId}`
    : '';

  return [
    `Yesterday your agent scanned ${marketsScanned} markets.`,
    `Spotted ${edgesAbove5} edges ≥5%.`,
    riskLine,
    `Dry-run P&L if live: ${dryRunPnl >= 0 ? '+' : ''}$${(dryRunPnl * 1000).toFixed(2)} (notional).`,
    trackLine,
    urlLine,
  ].filter(Boolean).join('\n');
}
