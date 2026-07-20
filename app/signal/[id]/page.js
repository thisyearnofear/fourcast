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

 const ogUrl = `${host}/api/og?${ogParams.toString()}`;

 return {
 title: `Signal: ${title.substring(0, 60)}`,
 description,
 openGraph: {
 title: `Signal: ${title.substring(0, 60)}`,
 description,
 images: [{ url: ogUrl, width: 1200, height: 630 }],
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
 HIGH: 'text-emerald-300 bg-emerald-900/40 border-emerald-600/30',
 MEDIUM: 'text-amber-300 bg-amber-900/40 border-amber-600/30',
 LOW: 'text-orange-300 bg-orange-900/40 border-orange-600/30',
 };
 const confidenceClass = confidenceColors[signal.confidence] || confidenceColors.LOW;
 // Icons ensure confidence is not color-only — accessible to colorblind users
 const confidenceIcons = { HIGH: '✅', MEDIUM: '⚠️', LOW: '❌' };
 const confidenceIcon = confidenceIcons[signal.confidence] || '❓';

 const efficiencyColors = {
 EFFICIENT: 'text-green-300 bg-green-900/30',
 NEUTRAL: 'text-yellow-300 bg-yellow-900/30',
 INEFFICIENT: 'text-red-300 bg-red-900/30',
 };
 const efficiencyClass = efficiencyColors[signal.odds_efficiency] || 'text-slate-400 bg-slate-800/30';

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
 <AppShell maxWidth="max-w-[720px]" wallet={false}>
 <div>
 {/* Breadcrumb */}
 <Link
 href="/signals"
 className="text-sm text-blue-400 hover:text-blue-300 transition-colors no-underline inline-flex items-center gap-1 mb-8"
 >
 ← Back to Signals
 </Link>

 {/* Signal Card */}
 <div className="bg-white/[0.03] border border-white/[0.06] p-6 space-y-5">
 {/* Header */}
 <div className="flex items-center justify-between">
 <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">
 Prediction Signal
 </span>
 <span className="text-xs text-slate-500">{timestamp}</span>
 </div>

 {/* Market Title */}
 <h1 className="text-xl font-light leading-relaxed text-slate-100">
 {signal.market_title || 'Untitled Market'}
 </h1>

 {/* AI Digest */}
 {signal.ai_digest && (
 <p className="text-sm text-slate-400 leading-relaxed">
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
 <span className="text-xs px-3 py-1.5 bg-slate-800/40 text-slate-400 border border-white/[0.06] font-medium">
 {signal.venue}
 </span>
 )}
 {signal.chain_origin && (
 <span className="text-xs px-3 py-1.5 bg-blue-900/30 text-blue-300 border border-blue-600/20 font-medium">
 {signal.chain_origin}
 </span>
 )}
 </div>

 {/* Author */}
 {signal.author_address && (
 <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
 <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold">
 {signal.author_address[0]?.toUpperCase() || '?'}
 </div>
 <span className="text-sm text-slate-500">
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
