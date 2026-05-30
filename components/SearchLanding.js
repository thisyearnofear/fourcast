'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NarrativeSteps from '@/components/NarrativeSteps';
import { BRAND } from '@/constants/brand';

const QUICK_SEARCHES = [
  { label: 'BTC $100k', query: 'Bitcoin $100k June 2026', tone: 'Crypto' },
  { label: 'Chiefs title', query: 'Chiefs Super Bowl', tone: 'Sports' },
  { label: 'Fed cut', query: 'Fed interest rate cut 2026', tone: 'Macro' },
  { label: 'Miami rain', query: 'rain in Miami tomorrow', tone: 'Weather' },
];

const NAV_LINKS = [
  { label: 'Markets', href: '/markets' },
  { label: 'Signals', href: '/signals' },
  { label: 'Agent', href: '/agent' },
  { label: 'Labs', href: '/labs' },
];

const FALLBACK_DEMO = {
  market: {
    title: 'Will Bitcoin exceed $120K by June 30?',
    platform: 'Polymarket',
    currentProbability: 0.58,
    fairProbability: 0.72,
    edge: 0.14,
    direction: 'BUY YES',
    confidence: 'HIGH',
  },
  venues: [
    { name: 'Polymarket', price: 0.58, depth: '$1.2M', status: 'primary fill' },
    { name: 'Kalshi', price: 0.62, depth: '$640K', status: 'cross-check' },
  ],
  evidence: [
    { label: 'ETF inflows', value: 'record $2.4B weekly flow', source: 'Reuters' },
    { label: 'Institutional demand', value: 'spot bid holding above $110K', source: 'CoinDesk' },
    { label: 'Macro setup', value: 'rate-cut signal supporting risk assets', source: 'Financial Times' },
  ],
  stats: [
    { value: '24', label: 'markets scanned' },
    { value: '5', label: 'candidates found' },
    { value: '1', label: 'trade ready' },
  ],
};

const EVIDENCE_ACCENTS = ['bg-cyan-400', 'bg-emerald-400', 'bg-amber-300'];

function formatPercent(value, digits = 0) {
  if (typeof value !== 'number') return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatEdge(value) {
  if (typeof value !== 'number') return '—';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function formatPrice(value) {
  if (typeof value === 'number') return `${Math.round(value * 100)}c`;
  return value || '—';
}

export default function SearchLanding() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [demo, setDemo] = useState(FALLBACK_DEMO);

  const featuredSearch = useMemo(() => QUICK_SEARCHES[0], []);
  const edgeSummary = useMemo(() => ([
    { label: 'Market', value: formatPercent(demo.market?.currentProbability), caption: `${demo.market?.platform || 'Market'} ask` },
    { label: 'AI fair', value: formatPercent(demo.market?.fairProbability, 1), caption: 'SERP + research + AI' },
    { label: 'Edge', value: formatEdge(demo.market?.edge), caption: demo.market?.direction || 'recommendation ready' },
  ]), [demo]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/agent/demo')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.market) {
          setDemo(data);
        }
      })
      .catch(() => {
        // Keep the bundled demo fallback if the endpoint is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = (q) => {
    const searchQuery = q || query.trim();
    if (!searchQuery) return;
    router.push(`/markets?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080a0d] text-white">
      <div
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(23, 118, 105, 0.28), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.08), transparent 26%, rgba(245,158,11,0.08) 70%, transparent)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.28) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-wide text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-base">
              {BRAND.emoji}
            </span>
            <span>{BRAND.name}</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-xs font-medium text-white/[0.55] transition hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={() => handleSearch(featuredSearch.query)}
            className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
          >
            Try demo
          </button>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.05fr)] lg:py-10">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Arc-native prediction market intelligence
            </div>

            <h1 className="text-5xl font-semibold leading-[0.96] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Find the market edge before it disappears.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/[0.62] sm:text-lg">
              Fourcast scans Polymarket and Kalshi, prices the fair probability with AI evidence, then turns the call into a USDC-verifiable signal on Arc.
            </p>

            <div className="mt-7 w-full max-w-2xl">
              <div
                className={`grid gap-2 rounded-2xl border p-2 shadow-2xl shadow-black/40 transition sm:grid-cols-[1fr_auto] ${
                  focused
                    ? 'border-emerald-300/[0.55] bg-white/[0.12]'
                    : 'border-white/[0.12] bg-white/[0.07]'
                }`}
              >
                <label className="flex min-h-12 items-center gap-3 rounded-xl bg-black/25 px-4">
                  <span className="text-white/[0.35]">Search</span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Will Bitcoin trade above $100k by June?"
                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/[0.28]"
                    autoFocus
                  />
                </label>
                <button
                  onClick={() => handleSearch()}
                  disabled={!query.trim()}
                  className="min-h-12 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/[0.35]"
                >
                  Analyze
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_SEARCHES.map((item) => (
                  <button
                    key={item.query}
                    onClick={() => handleSearch(item.query)}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
                  >
                    <span className="text-white/[0.35]">{item.tone}</span> · {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <NarrativeSteps currentStep="search" isNight className="max-w-full overflow-x-auto pb-1" />
            </div>

            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3">
              {demo.stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                  <div className="text-lg font-semibold text-white">{stat.value}</div>
                  <div className="mt-1 text-[11px] leading-4 text-white/[0.45]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/[0.12] bg-[#0d1216]/90 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Live edge scanner</p>
                  <h2 className="mt-1 text-lg font-medium text-white">{demo.market.title}</h2>
                </div>
                <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {demo.market.confidence} · {demo.market.direction}
                </div>
              </div>

              <div className="grid gap-3 py-3 sm:grid-cols-3">
                {edgeSummary.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.055] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/[0.38]">{item.label}</div>
                    <div className={`mt-2 text-3xl font-semibold ${item.label === 'Edge' ? 'text-emerald-200' : 'text-white'}`}>
                      {item.value}
                    </div>
                    <div className="mt-1 min-h-8 text-xs leading-4 text-white/[0.42]">{item.caption}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_0.82fr]">
                <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">Evidence stack</h3>
                    <span className="text-xs text-white/[0.38]">3 sources verified</span>
                  </div>
                  <div className="space-y-3">
                    {demo.evidence.map((signal, index) => (
                      <div key={signal.label} className="flex items-start gap-3">
                        <span className={`mt-1.5 h-2 w-2 rounded-full ${EVIDENCE_ACCENTS[index % EVIDENCE_ACCENTS.length]}`} />
                        <div>
                          <div className="text-sm text-white/[0.86]">{signal.label}</div>
                          <div className="text-xs leading-5 text-white/[0.45]">{signal.value} · {signal.source}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <h3 className="mb-4 text-sm font-semibold text-white">Venue comparison</h3>
                  <div className="space-y-3">
                    {demo.venues.map((venue) => (
                      <div key={venue.name} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-white/[0.045] p-3">
                        <div>
                          <div className="text-sm font-medium text-white">{venue.name}</div>
                          <div className="mt-1 text-xs text-white/[0.42]">{venue.depth} depth</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white">{formatPrice(venue.price)}</div>
                          <div className="mt-1 text-xs text-amber-100/70">{venue.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-3 grid gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="text-sm font-semibold text-amber-50">Ready to publish on Arc</div>
                  <p className="mt-1 text-xs leading-5 text-amber-50/[0.58]">
                    Signal receipt, Brier scoring, USDC settlement, and optional Kelly-sized execution.
                  </p>
                </div>
                <Link
                  href="/signals"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-200 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-100"
                >
                  View signals
                </Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-4 text-xs text-white/[0.35] sm:flex-row sm:items-center sm:justify-between">
          <span>{BRAND.footerStrip}</span>
          <span>{BRAND.hackathon.label} · {BRAND.hackathon.rfbs}</span>
        </footer>
      </div>
    </main>
  );
}
