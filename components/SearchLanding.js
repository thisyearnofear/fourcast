'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Fingerprint, ShieldCheck, LineChart } from 'lucide-react';
import { BRAND } from '@/constants/brand';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import WalletConnect from '@/app/components/WalletConnect';
import OperatorMath from '@/components/OperatorMath';
import OperatorPulse from '@/components/OperatorPulse';
import { useBrightDataStatus } from '@/hooks/useBrightDataStatus';

const QUICK_SEARCHES = [
  { label: 'BTC $150k', query: 'Bitcoin $150k August 2026' },
  { label: 'Fed July cut', query: 'Fed interest rate cut July 2026' },
  { label: 'SpaceX Mars', query: 'SpaceX Starship Mars cargo 2026' },
  { label: 'NVIDIA $200', query: 'NVIDIA stock $200 by September 2026' },
];

// The canonical real receipt — France 3-0 Sweden, World Cup Round of 32.
// A 0.1 SOL policy on this match was settled on-chain via the match-escrow
// program CPI-calling txoracle::validate_stat (see README §Solution 4).
// Deep-linking /world-cup?fixture=<id> opens the Proof Theatre on it.
const VERIFIED_RECEIPT = {
  fixtureId: '18175981',
  home: 'France',
  away: 'Sweden',
  score: '3–0',
  stage: 'World Cup · Round of 32',
  escrowProgramId: 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ',
};

// Two primary-customer doors. The README positions the customer as both the
// operator running capital AND the allocator diligencing them; the search box
// above serves the acquisition (retail/analyst) path, these doors serve the
// headline path. Order matches the README narrative: Mandate → Diligence.
const AUDIENCE_DOORS = [
  {
    href: '/agent',
    icon: LineChart,
    eyebrow: 'I run capital',
    title: 'Mandate Control',
    body: 'A live agent operating under a versioned policy, sealing each decision into a SHA-256 receipt before the outcome is known. Self-serve: configure your mandate, run a dry-run, get a public Track Record URL.',
  },
  {
    href: '/positions',
    icon: ShieldCheck,
    eyebrow: 'I diligence operators',
    title: 'Allocator Diligence',
    body: 'Policy adherence, receipt coverage, discipline rate, and calibration — computed from the same public receipts, not self-reported.',
  },
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
        <header className="operator-header sticky top-3 z-50 flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4">
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          <WalletConnect />
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

        {/* Primary-customer doors — the README positions the customer as both
            the operator running capital and the allocator diligencing them.
            The search hero above serves the acquisition (retail/analyst) path;
            these two doors serve the headline path. */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:mt-2" aria-label="Primary-customer entry points">
          {AUDIENCE_DOORS.map((door) => {
            const Icon = door.icon;
            return (
              <Link
                key={door.href}
                href={door.href}
                className="fc-door group relative flex flex-col gap-2 border border-white/10 bg-white/[0.02] p-5 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.04] sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="fc-kicker">{door.eyebrow}</span>
                  <Icon className="h-4 w-4 text-white/40 transition group-hover:text-emerald-300" />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {door.title}
                </h3>
                <p className="text-sm leading-6 text-white/60">{door.body}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-200/80">
                  Enter
                  <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </section>

        {/* Verify a real receipt — the single most differentiated artifact we
            can show a cold prospect in 10 seconds. A real World Cup fixture
            with a real Merkle proof anchored on Solana devnet, settled on-chain
            via match-escrow CPI. Deep-links into Proof Theatre with the
            fixture pre-selected so the visitor lands on the verification
            chain, not a fixture list. */}
        <section className="mt-12" aria-label="Verify a real decision on Solana">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <p className="fc-kicker">Verify a real decision on Solana</p>
              <h2 className="mt-2 max-w-xl font-display text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                A receipt already settled on-chain. Audit it yourself.
              </h2>
            </div>
            <p className="max-w-sm text-xs leading-5 text-white/45">
              No signup, no wallet. The proof chain walks pre-match evidence → seeded simulation → versioned policy gates → SHA-256 receipt → TxLINE Merkle proof → Solana PDA validation → reconciliation.
            </p>
          </div>

          <div className="fc-instrument mt-5 overflow-hidden p-1">
            <div className="fc-instrument__inner flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {VERIFIED_RECEIPT.stage}
                </p>
                <p className="mt-1.5 font-display text-xl font-semibold text-white sm:text-2xl">
                  {VERIFIED_RECEIPT.home} <span className="text-white/40">v</span> {VERIFIED_RECEIPT.away}
                </p>
                <p className="mt-1 font-mono text-sm text-emerald-300">
                  Final {VERIFIED_RECEIPT.score}
                </p>
                <p className="mt-3 max-w-md text-xs leading-5 text-white/55">
                  A 0.1 SOL policy on this match was settled trustlessly via the <span className="font-mono text-white/70">match-escrow</span> program CPI-calling <span className="font-mono text-white/70">txoracle::validate_stat</span>. No intermediary involved.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2">
                <Link
                  href={`/world-cup?fixture=${VERIFIED_RECEIPT.fixtureId}`}
                  className="fc-action mc-action--primary inline-flex items-center justify-center gap-1.5 px-5 py-3 text-sm"
                >
                  <Fingerprint className="h-3.5 w-3.5" />
                  Open Proof Theatre
                </Link>
                <a
                  href={`https://explorer.solana.com/address/${VERIFIED_RECEIPT.escrowProgramId}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="mc-nav-link no-underline inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Escrow program on devnet
                </a>
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
