import { getAgentTrackRecord, getMandate } from '@/services/db';
import OperatorTrackRecordClient from './OperatorTrackRecordClient';
import { BRAND } from '@/constants/brand';

export const runtime = 'nodejs';

/**
 * /agent/[operatorId] — server component wrapper.
 *
 * Exports generateMetadata so the per-operator OG card (rendered by
 * /api/og?type=operator) is populated with the operator's real stats and
 * mandate knobs. This is the viral distribution surface per GTM §1: "the OG
 * share card on Warpcast / X is our growth channel."
 *
 * Fetches the track record + mandate server-side and passes as initialData
 * so the client component can render immediately without a loading flash.
 */
export async function generateMetadata({ params }) {
  const operatorId = params?.operatorId;
  const host = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

  if (!operatorId) {
    return {
      title: 'Operator Track Record — Fourcast',
      description: 'A public, mandate-bound track record on Fourcast.',
    };
  }

  try {
    const [trackResult, mandateResult] = await Promise.all([
      getAgentTrackRecord(operatorId),
      getMandate(operatorId),
    ]);

    const stats = trackResult.success ? trackResult.stats : {};
    const mandate = mandateResult.success ? mandateResult.mandate : null;
    const name = mandate?.displayName || 'Operator';
    const total = stats.total_forecasts ?? 0;
    const resolved = stats.resolved_forecasts ?? 0;
    const brier = stats.avg_brier_score != null ? Number(stats.avg_brier_score).toFixed(3) : null;

    const ogParams = new URLSearchParams({ type: 'operator', name, total: String(total), resolved: String(resolved) });
    if (brier) ogParams.set('brier', brier);
    if (mandate) {
      ogParams.set('minEdge', String(mandate.minAbsoluteEdge));
      ogParams.set('maxAlloc', String(mandate.maxAllocationPct));
      ogParams.set('maxLoss', String(mandate.maxLossProbability));
      ogParams.set('simRuns', String(mandate.simulationRuns));
    }
    const ogImage = `${host}/api/og?${ogParams.toString()}`;

    const title = `${name}'s Track Record — Fourcast`;
    const description = `${total} forecasts · ${resolved} resolved${brier ? ` · ${brier} avg Brier` : ''}. Mandate-bound, verifiable on-chain.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${host}/agent/${operatorId}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: `${name}'s Fourcast track record` }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    };
  } catch (error) {
    return {
      title: 'Operator Track Record — Fourcast',
      description: 'A public, mandate-bound track record on Fourcast.',
    };
  }
}

export default async function OperatorTrackRecordPage({ params }) {
  const operatorId = params?.operatorId;

  let initialData = null;
  if (operatorId) {
    try {
      const [trackResult, mandateResult] = await Promise.all([
        getAgentTrackRecord(operatorId),
        getMandate(operatorId),
      ]);
      if (trackResult.success) {
        initialData = {
          success: true,
          operatorId,
          stats: trackResult.stats,
          recentForecasts: trackResult.recentForecasts,
          mandate: mandateResult.success ? mandateResult.mandate : null,
        };
      }
    } catch {
      /* fall through to client-side fetch */
    }
  }

  return <OperatorTrackRecordClient operatorId={operatorId} initialData={initialData} />;
}
