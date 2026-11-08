'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useHealthSummary from '@/hooks/useHealthSummary';
import {
 getSummaryAppearance,
 SUMMARY_LABEL,
 SUMMARY_SHORT_LABEL,
} from '@/utils/healthBadge';

/**
 * Header status badge — surfaces the aggregate provider health from
 * /api/meta/health so users see uptime while they trade.
 *
 * Polls every HEALTH_POLL_MS (matches /status cadence). Hides itself on the
 * /status route (the full panel is already there) and on the landing page
 * (SearchLanding has its own chrome).
 *
 * Color/labels come from `utils/healthBadge.js` so the pill and the public
 * panel at /status never disagree on what "degraded" looks like; polling
 * lives in `hooks/useHealthSummary.js`, shared with SystemHealthMenu.
 */

export default function StatusBadge() {
 const pathname = usePathname();
 const { summary, lastUpdated } = useHealthSummary();

 // Don't render on the /status route (full panel already there).
 if (pathname === '/status') return null;

 const c = getSummaryAppearance(summary);
 const label = SUMMARY_SHORT_LABEL[summary] || 'Checking…';
 const fullLabel = SUMMARY_LABEL[summary] || 'Provider health unknown';

 const updatedAt = lastUpdated
 ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
 : null;

 return (
 <Link
 href="/status"
 title={
 summary === 'loading'
 ? 'Checking provider health…'
 : `${fullLabel}${updatedAt ? ` · updated ${updatedAt}` : ''}`
 }
 aria-label={`System status: ${fullLabel}. Click for details.`}
 className={`hidden md:inline-flex items-center gap-1.5 border border-[var(--color-rule)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--color-paper-soft)] ${c.text}`}
 >
 <span className="relative flex h-2 w-2" aria-hidden>
 {summary === 'all_healthy' && (
 <span className={`absolute inline-flex h-full w-full animate-ping ${c.dot} opacity-60`} />
 )}
 <span className={`relative inline-flex h-2 w-2 ${c.dot}`} />
 </span>
 <span>{label}</span>
 </Link>
 );
}
