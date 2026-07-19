'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/constants/brand';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import OperatorMath from '@/components/OperatorMath';
import OperatorPulse from '@/components/OperatorPulse';
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
      <div className="market-field" aria-hidden />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="operator-header flex items-center justify-between gap-4 px-3 py-2.5">
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          <button
            type="button"
            onClick={() => handleSearch(featured.query)}
            className="fc-action fc-action--quiet px-3 py-2 text-xs"
          >
            Try demo
          </button>
        </header>

        <OperatorPulse className="mt-5" />

        {/* Hero — one real operator promise + a decision instrument */}
        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-14">
          <div className="max-w-xl">
            <p className="fc-kicker">
              Prediction-market operator terminal
            </p>

            <h1 className="fc-display mt-4 text-5xl font-extrabold leading-[0.9] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
              {BRAND.name}
            </h1>

            <p className="mt-5 max-w-md text-lg leading-7 text-white/70 sm:text-xl">
              {BRAND.tagline}
            </p>

            <div className="mt-8 w-full">
              <div
                className={`fc-query grid gap-2 p-2 transition duration-300 sm:grid-cols-[1fr_auto] ${
                  focused
                    ? 'is-focused'
                    : ''
                }`}
              >
                <label className="flex min-h-12 items-center gap-3 px-4">
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
                  className="fc-action min-h-12 px-6 text-sm disabled:cursor-not-allowed disabled:opacity-30"
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
                    className="fc-chip px-3 py-1.5 text-xs"
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

          {/* Decision instrument — shows the core evaluation grammar. */}
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-400/10 blur-3xl" aria-hidden />
            <div className="fc-instrument edge-reveal relative overflow-hidden p-1 shadow-2xl shadow-black/50">
              <div className="fc-instrument__inner p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="fc-kicker">
                      Decision replay · sample data
                    </p>
                    <h2 className="mt-2 max-w-sm text-lg font-semibold leading-snug text-white sm:text-xl">
                      {DEMO.title}
                    </h2>
                  </div>
                  <span className="fc-status fc-status--positive shrink-0 px-2.5 py-1">
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
                      className="fc-metric edge-cell px-3 py-4"
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
                    className="fc-action px-3 py-2 text-xs"
                  >
                    Run this market
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Operator Math — compact (discovery mode) on the landing page so the
            eyebrow pill is omitted and spacing is tighter. The full <OperatorMath />
            variant (eyebrow + Headline pill + generous padding) is reserved for
            /labs/autopilot where the math IS the product context. */}
        <OperatorMath compact />
      </div>
    </main>
  );
}
