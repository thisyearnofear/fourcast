import { getSignalById } from '@/services/db.js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SignalCTA from '@/components/SignalCTA';
import { AppShell } from '@/app/components/PageNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
 const { id } = params;
 const { signal } = await getSignalById(id);

 if (!signal) {
 return {
 title: 'Signal Not Found — Fourcast',
 description: 'This prediction signal could not be found.',
 };
 }

 const host = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';
 const title = signal.market_title || 'Prediction Signal';
 const description = signal.ai_digest?.substring(0, 160) || 'AI-powered prediction signal on Fourcast';

 // Build OG image URL with signal data
 const ogParams = new URLSearchParams({
 type: 'signal',
 title: title.substring(0, 100),
 confidence: (signal.confidence || 'LOW').toUpperCase(),
 venue: signal.venue || '',
 author: signal.author_address || '',
 });

 const ogUrl = `/api/og?${ogParams.toString()}`;

 return {
 title: `Signal: ${title.substring(0, 60)}`,
 description,
 openGraph: {
 title: `Signal: ${title.substring(0, 60)}`,
 description,
 images: [{ url: ogUrl, width: 1200, height: 630, alt: `Fourcast signal: ${title.substring(0, 80)}` }],
 type: 'article',
 siteName: 'Fourcast',
 },
 twitter: {
 card: 'summary_large_image',
 title: `Signal: ${title.substring(0, 60)}`,
 description,
 images: [ogUrl],
 },
 };
}

export default async function SignalPage({ params }) {
 const { id } = params;
 const { signal } = await getSignalById(id);

 if (!signal) {
 notFound();
 }

 const confidenceColors = {
 HIGH: 'text-accent bg-accent/10 border-accent/30',
 MEDIUM: 'text-sealed bg-sealed/10 border-sealed/30',
 LOW: 'text-breach bg-breach/10 border-breach/30',
 };
 const confidenceClass = confidenceColors[signal.confidence] || confidenceColors.LOW;
 // Icons ensure confidence is not color-only — accessible to colorblind users
 const confidenceIcons = { HIGH: '✅', MEDIUM: '⚠️', LOW: '❌' };
 const confidenceIcon = confidenceIcons[signal.confidence] || '❓';

 const efficiencyColors = {
 EFFICIENT: 'text-accent bg-accent/10',
 NEUTRAL: 'text-sealed bg-sealed/10',
 INEFFICIENT: 'text-breach bg-breach/10',
 };
 const efficiencyClass = efficiencyColors[signal.odds_efficiency] || 'text-[var(--color-ink-faint)] bg-[var(--color-wash)]';

 const authorDisplay = signal.author_address
 ? `${signal.author_address.substring(0, 6)}...${signal.author_address.substring(signal.author_address.length - 4)}`
 : 'Unknown';

 const timestamp = signal.timestamp
 ? new Date(signal.timestamp * 1000).toLocaleString('en-US', {
 dateStyle: 'medium',
 timeStyle: 'short',
 })
 : null;

 return (
 <AppShell maxWidth="max-w-[720px]" wallet={true}>
 <div>
 {/* Breadcrumb */}
 <Link
 href="/signals"
 className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors no-underline inline-flex items-center gap-1 mb-8"
 >
 ← Back to Signals
 </Link>

 {/* Signal Card */}
 <div className="bg-white/[0.03] border border-white/[0.06] p-6 space-y-5">
 {/* Header */}
 <div className="flex items-center justify-between">
 <span className="text-xs uppercase tracking-wider text-[var(--color-ink-faint)] font-medium">
 Prediction Signal
 </span>
 <span className="text-xs text-[var(--color-ink-faint)]">{timestamp}</span>
 </div>

 {/* Market Title */}
 <h1 className="text-xl font-light leading-relaxed text-[var(--color-ink)]">
 {signal.market_title || 'Untitled Market'}
 </h1>

 {/* AI Digest */}
 {signal.ai_digest && (
 <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
 {signal.ai_digest}
 </p>
 )}

 {/* Stats Row */}
 <div className="flex flex-wrap gap-3">
 <span
 className={`text-xs px-3 py-1.5 border font-medium ${confidenceClass}`}
 >
 <span aria-hidden="true">{confidenceIcon}</span>{' '}
 {signal.confidence || 'LOW'} Confidence
 </span>
 {signal.odds_efficiency && (
 <span
 className={`text-xs px-3 py-1.5 font-medium ${efficiencyClass}`}
 >
 {signal.odds_efficiency}
 </span>
 )}
 {signal.venue && (
 <span className="text-xs px-3 py-1.5 bg-[var(--color-wash)] text-[var(--color-ink-muted)] border border-[var(--color-rule)] font-medium">
 {signal.venue}
 </span>
 )}
 {signal.chain_origin && (
 <span className="text-xs px-3 py-1.5 bg-[var(--color-evidence)]/10 text-[var(--color-evidence)] border border-[var(--color-evidence)]/30 font-medium">
 {signal.chain_origin}
 </span>
 )}
 </div>

 {/* Author */}
 {signal.author_address && (
 <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
 <div className="w-6 h-6 bg-gradient-to-br from-[var(--color-evidence)] to-[var(--color-accent)] flex items-center justify-center text-[10px] font-bold">
 {signal.author_address[0]?.toUpperCase() || '?'}
 </div>
 <span className="text-sm text-[var(--color-ink-faint)]">
 Published by {authorDisplay}
 </span>
 </div>
 )}
 </div>

 {/* Conversion CTA — stops the share loop from dead-ending */}
 <SignalCTA
 marketTitle={signal.market_title}
 authorAddress={signal.author_address}
 />

 </div>
 </AppShell>
 );
}
