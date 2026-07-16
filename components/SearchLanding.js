'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/constants/brand';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import { useBrightDataStatus } from '@/hooks/useBrightDataStatus';

const QUICK_SEARCHES = [
  { label: 'BTC $150k', query: 'Bitcoin $150k August 2026' },
  { label: 'Fed July cut', query: 'Fed interest rate cut July 2026' },
  { label: 'SpaceX Mars', query: 'SpaceX Starship Mars cargo 2026' },
  { label: 'NVIDIA $200', query: 'NVIDIA stock $200 by September 2026' },
];

const DEMO = {
  title: 'Will Bitcoin exceed $150K by August 2026?',
  market: 0.42,
  fair: 0.58,
  edge: 0.16,
  direction: 'BUY YES',
  confidence: 'HIGH',
};

function pct(value, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function edgeLabel(value) {
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

export default function SearchLanding() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const webIntel = useBrightDataStatus();

  const featured = useMemo(() => QUICK_SEARCHES[0], []);

  const handleSearch = (q) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) return;
    router.push(`/markets?q=${encodeURIComponent(searchQuery)}&first=1`);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden text-[var(--ink)]">
      {/* Atmospheric plane — edge glow, not flat black */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% -10%, rgba(52, 211, 153, 0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 60%, rgba(251, 191, 36, 0.06), transparent 50%), linear-gradient(180deg, #0a0f0d 0%, var(--app-bg) 45%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(180deg, black 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 backdrop-blur-xl">
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          <button
            type="button"
            onClick={() => handleSearch(featured.query)}
            className="rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-dim)] px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
          >
            Try demo
          </button>
        </header>

        {/* Hero — brand + one promise + one CTA + one visual */}
        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-14">
          <div className="max-w-xl">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
              Prediction market intelligence
            </p>

            <h1 className="font-display mt-4 text-5xl font-extrabold leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
              {BRAND.name}
            </h1>

            <p className="mt-5 max-w-md text-lg leading-7 text-white/70 sm:text-xl">
              {BRAND.tagline}
            </p>

            <div className="mt-8 w-full">
              <div
                className={`grid gap-2 rounded-2xl border p-2 transition duration-300 sm:grid-cols-[1fr_auto] ${
                  focused
                    ? 'border-emerald-300/50 bg-white/[0.1] shadow-[0_0_0_1px_rgba(52,211,153,0.15)]'
                    : 'border-white/12 bg-white/[0.06]'
                }`}
              >
                <label className="flex min-h-12 items-center gap-3 rounded-xl bg-black/30 px-4">
                  <span className="sr-only">Search markets</span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Will Bitcoin trade above $100k by June?"
                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/45"
                    autoFocus
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  disabled={!query.trim()}
                  className="min-h-12 rounded-xl bg-emerald-400 px-6 text-sm font-semibold text-[#04110c] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                >
                  Analyze
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_SEARCHES.map((item) => (
                  <button
                    key={item.query}
                    type="button"
                    onClick={() => handleSearch(item.query)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55 transition hover:border-emerald-400/30 hover:text-white"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 text-sm text-white/40">
              No wallet needed to analyze. Publish and trade when you are ready.
              {!webIntel.loading && !webIntel.available && (
                <span className="mt-1 block text-white/30">
                  {BRAND.webIntel.unavailableNote}
                </span>
              )}
            </p>
          </div>

          {/* Living edge card — the product, not a marketing collage */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-emerald-400/5 blur-2xl" aria-hidden />
            <div className="edge-reveal relative overflow-hidden rounded-[1.35rem] border border-white/12 bg-[#0b1210]/95 p-1 shadow-2xl shadow-black/50">
              <div className="rounded-[1.15rem] bg-gradient-to-b from-white/[0.06] to-transparent p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-300/70">
                      Edge preview
                    </p>
                    <h2 className="mt-2 max-w-sm text-lg font-semibold leading-snug text-white sm:text-xl">
                      {DEMO.title}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-emerald-100">
                    {DEMO.confidence}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { label: 'Market', value: pct(DEMO.market) },
                    { label: 'AI fair', value: pct(DEMO.fair, 0) },
                    { label: 'Edge', value: edgeLabel(DEMO.edge), accent: true },
                  ].map((cell, i) => (
                    <div
                      key={cell.label}
                      className="edge-cell rounded-xl border border-white/10 bg-black/35 px-3 py-4"
                      style={{ animationDelay: `${120 + i * 90}ms` }}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                        {cell.label}
                      </div>
                      <div
                        className={`mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl ${
                          cell.accent ? 'text-emerald-300' : 'text-white'
                        }`}
                      >
                        {cell.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                  <p className="text-sm text-white/55">
                    Recommendation{' '}
                    <span className="font-semibold text-emerald-200">{DEMO.direction}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSearch(featured.query)}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-100"
                  >
                    Run this market
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
