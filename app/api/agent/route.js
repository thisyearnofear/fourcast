import { runAgentLoop } from '@/services/aiService.server';
import { saveAgentRun } from '@/services/db';

export const runtime = 'nodejs';

const agentRateLimit = new Map();
const AGENT_RATE_LIMIT = 3; // 3 agent runs per hour
const AGENT_WINDOW = 60 * 60 * 1000;

function checkAgentRateLimit(identifier) {
  const now = Date.now();
  const requests = agentRateLimit.get(identifier) || [];
  const valid = requests.filter(ts => now - ts < AGENT_WINDOW);
  if (valid.length >= AGENT_RATE_LIMIT) return false;
  valid.push(now);
  agentRateLimit.set(identifier, valid);
  return true;
}

function getClientIdentifier(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('user-agent') ||
    'unknown'
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      categories = ['all'],
      maxMarkets = 5,
      minVolume = 10000,
      maxDaysOut = 30,
      riskTolerance = 0.5,
      autopilot = false,
    } = body;

    const clientId = getClientIdentifier(request);
    if (!checkAgentRateLimit(clientId)) {
      return Response.json(
        { success: false, error: 'Agent rate limit exceeded. Max 3 runs per hour.' },
        { status: 429 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        (async () => {
          try {
            const loop = runAgentLoop({
              categories,
              maxMarkets: Math.min(maxMarkets, 10),
              minVolume,
              maxDaysOut,
              riskTolerance: Math.max(0, Math.min(1, riskTolerance)),
              autopilot, // ← was missing: pass through to agent loop for execution
            });

            let marketsScanned = 0;
            let candidatesFiltered = 0;
            let forecastsMade = 0;
            const receipt = {
              sources: [],
              arbitrage: { candidates: 0, executable: 0, review: 0 },
              recommendations: { actionable: 0, skipped: 0 },
              execution: { attempted: 0, completed: 0, failed: 0, dryRun: false },
              highlights: [],
            };

            for await (const update of loop) {
              controller.enqueue(
                encoder.encode(JSON.stringify(update) + '\n')
              );

              // Track metrics for agent run record
              if (update.step === 'discover' && update.status === 'complete') {
                marketsScanned = update.data?.total || 0;
                receipt.sources = [
                  ...(update.data?.polymarket ? ['Polymarket'] : []),
                  ...(update.data?.kalshi ? ['Kalshi'] : []),
                ];
              }
              if (update.step === 'filter' && update.status === 'complete') {
                candidatesFiltered = update.data?.candidates?.length || 0;
                const matches = update.data?.topArbitrage || [];
                receipt.arbitrage = {
                  candidates: update.data?.arbitrageCount || 0,
                  executable: matches.filter((match) => match.executionReady).length,
                  review: matches.filter((match) => !match.executionReady).length,
                };
                receipt.highlights.push(...matches.slice(0, 2).map((match) => ({
                  type: 'cross-venue',
                  title: match.polymarket?.title || match.kalshi?.title || 'Cross-venue match',
                  verdict: match.executionReady ? 'ready' : 'review',
                  rationale: match.decision?.rationale || 'Compared contract semantics and net spread',
                })));
              }
              if (update.step === 'edge' && update.status === 'complete') {
                forecastsMade = update.data?.recommendations?.length || 0;
                const recommendations = update.data?.recommendations || [];
                receipt.recommendations = {
                  actionable: recommendations.filter((item) => item.actionable).length,
                  skipped: recommendations.filter((item) => !item.actionable).length,
                };
                receipt.highlights.push(...recommendations.slice(0, 3).map((item) => ({
                  type: 'forecast',
                  title: item.title,
                  verdict: item.actionable ? 'act' : 'pass',
                  rationale: item.actionable
                    ? `${item.direction} · ${(item.sizePct * 100).toFixed(1)}% Kelly-sized allocation`
                    : 'No allocation: edge did not clear the risk gate',
                })));
              }
              if (update.step === 'execute' && update.status === 'complete') {
                receipt.execution = {
                  attempted: (update.data?.trades || []).length,
                  completed: update.data?.executed || 0,
                  failed: update.data?.failed || 0,
                  dryRun: Boolean(update.data?.dryRun),
                };
              }
            }

            // Save agent run metadata
            await saveAgentRun({
              id: `run-${Date.now()}`,
              config: { categories, maxMarkets, minVolume, maxDaysOut, riskTolerance },
              marketsScanned,
              candidatesFiltered,
              forecastsMade,
              timestamp: Math.floor(Date.now() / 1000),
              runMode: autopilot ? 'autopilot' : 'advisory',
              summary: receipt,
            });

            controller.close();
          } catch (err) {
            console.error('Agent loop error:', err);
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ step: 'error', status: 'failed', message: err.message }) + '\n'
              )
            );
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: 'Agent loop failed to start' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
