'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Fingerprint, ShieldCheck, LineChart, Compass } from 'lucide-react';
import { BRAND } from '@/constants/brand';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import WalletConnect from '@/app/components/WalletConnect';
import OperatorMath from '@/components/OperatorMath';
import OperatorPulse from '@/components/OperatorPulse';
import { useBrightDataStatus } from '@/hooks/useBrightDataStatus';
import { useAudience, AUDIENCE_META } from '@/hooks/useAudience';
import Ripple from '@/components/canvasui/Ripple';
import ParticleReveal from '@/components/canvasui/ParticleReveal';
import Reveal from '@/components/motion/Reveal';
import LiveMarketMetrics from '@/components/motion/LiveMarketMetrics';
import useLiveMarkets from '@/hooks/useLiveMarkets';
import { confidenceLabel, confidenceTint, directionFor } from '@/utils/marketEdge';

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
    id: 'operator',
    href: '/agent',
    icon: LineChart,
    eyebrow: 'I run capital',
    title: 'Mandate Control',
    body: 'A live agent operating under a versioned policy, sealing each decision into a SHA-256 receipt before the outcome is known. Self-serve: configure your mandate, run a dry-run, get a public Track Record URL.',
  },
  {
    id: 'allocator',
    href: '/positions',
    icon: ShieldCheck,
    eyebrow: 'I diligence operators',
    title: 'Allocator Diligence',
    body: 'Policy adherence, receipt coverage, discipline rate, and calibration — computed from the same public receipts, not self-reported.',
  },
  {
    id: 'analyst',
    href: '/markets',
    icon: Compass,
    eyebrow: 'I scan markets',
    title: 'Analyst Markets',
    body: 'Discover edge across active prediction markets. Filter by category, scan a curated set, and follow live reasoning before a mandate commits capital.',
  },
];

export default function SearchLanding() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // Arming the instrument metrics one frame after mount makes the decision
  // numbers roll up from zero (state-explanation motion, --dur-explain).
  const [armed, setArmed] = useState(false);
  const webIntel = useBrightDataStatus();
  const { mode } = useAudience();
  const live = useLiveMarkets();

  // Cycle through the top markets every 3s so the instrument panel
  // feels alive between 15s API polls. Resets when new data arrives.
  const [marketIndex, setMarketIndex] = useState(0);
  const marketIndexRef = useRef(0);
  useEffect(() => {
    if (live.markets.length <= 1) return undefined;
    const id = window.setInterval(() => {
      marketIndexRef.current = (marketIndexRef.current + 1) % live.markets.length;
      setMarketIndex(marketIndexRef.current);
    }, 3000);
    return () => window.clearInterval(id);
  }, [live.markets.length]);

  // Reset the cycle index when new markets arrive.
  useEffect(() => {
    marketIndexRef.current = 0;
    setMarketIndex(0);
  }, [live.markets]);

  const activeMarket = live.markets[marketIndex] || live.markets[0] || null;

  useEffect(() => {
    setArmed(true);
  }, []);

  const featured = useMemo(() => QUICK_SEARCHES[0], []);

  // Mode-aware door ordering — the audience's primary door leads, the others
  // remain visible. Three modes, three doors; the third (Analyst Markets) is
  // surfaced when the visitor hasn't picked a role yet, otherwise it sits in
  // its right position.
  const orderedDoors = useMemo(() => {
    const others = AUDIENCE_DOORS.filter((d) => d.id !== mode);
    const lead = AUDIENCE_DOORS.find((d) => d.id === mode);
    return lead ? [lead, ...others] : AUDIENCE_DOORS;
  }, [mode]);

  const handleSearch = (q) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) return;
    router.push(`/markets?q=${encodeURIComponent(searchQuery)}&first=1`);
  };

  return (
    <main className="fc-grain relative min-h-screen overflow-x-hidden text-[var(--ink)]">
      <div className="fc-backdrop" aria-hidden>
        <div className="fc-backdrop__orb fc-backdrop__orb--a" />
        <div className="fc-backdrop__orb fc-backdrop__orb--b" />
        <div className="fc-backdrop__grid" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="operator-header sticky top-3 z-50 flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4">
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          <WalletConnect />
        </header>

        <OperatorPulse className="mt-5" liveCounts={live.isLive ? { marketsScanned: live.scanCount, freshEdges: live.edgeCount } : null} />

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
              <ParticleReveal
                radius={180}
                softness={0.65}
                size={1.2}
                scatter={10}
                drift={0.6}
                aberration={8}
                bend={20}
                fade={0.75}
                background="var(--color-paper)"
                className="fc-instrument-reveal"
              >
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
              </ParticleReveal>

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

          {/* Decision instrument — shows the core evaluation grammar.
              Fed by useLiveMarkets so the metrics reflect real Polymarket /
              Kalshi odds and the confidence pill changes tint as the edge
              shifts. Cycles through the top 6 markets every 3s. Falls back
              to a neutral "awaiting data" state if the API is unreachable. */}
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-400/10 blur-3xl" aria-hidden />
            <div className={`fc-instrument edge-reveal relative overflow-hidden p-1 shadow-2xl shadow-black/50 ${live.isLive ? 'fc-instrument--armed' : ''}`}>
              <div className="fc-instrument__inner p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="fc-kicker">
                      Decision replay · {live.isLive ? 'live markets' : 'connecting'}
                      {live.markets.length > 1 && (
                        <span className="ml-2 text-white/30">
                          {marketIndex + 1}/{live.markets.length}
                        </span>
                      )}
                    </p>
                    <h2 key={`title-${marketIndex}`} className="fc-market-slide mt-2 max-w-sm text-lg font-semibold leading-snug text-white sm:text-xl">
                      {activeMarket?.title || 'Awaiting live market data…'}
                    </h2>
                  </div>
                  <span className={`fc-status shrink-0 px-2.5 py-1 ${activeMarket ? confidenceTint(activeMarket.edgeScore) : 'fc-status--review'}`}>
                    {activeMarket ? confidenceLabel(activeMarket.edgeScore) : '—'}
                  </span>
                </div>

                {activeMarket ? (
                  <div key={`metrics-${marketIndex}`} className="fc-market-slide">
                    <LiveMarketMetrics market={activeMarket} armed={armed} />
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                    {['Market', 'AI fair', 'Edge'].map((label) => (
                      <div key={label} className="fc-metric px-3 py-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</div>
                        <div className="mt-2 font-display text-2xl font-bold tracking-tight text-white/30 sm:text-3xl">—</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                  <p className="text-sm text-white/55">
                    {activeMarket ? (
                      <>Recommendation{' '}
                        <span className="font-semibold text-emerald-200">
                          {directionFor(activeMarket.edgeScore)}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/40">Connecting to live market feed…</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSearch(featured.query)}
                    className="fc-action px-3 py-2 text-xs"
                  >
                    Run this market
                  </button>
                </div>

                {/* Live signal ticker is now a full-width marquee below the hero. */}
              </div>
            </div>
          </div>
        </section>

        {/* Full-width marquee ticker — real edge events scrolling like a
            stock ticker tape. Pauses on hover. Duplicates the items so the
            CSS marquee loop is seamless. */}
        {live.isLive && live.signals.length > 0 && (
          <div className="fc-marquee mt-2" aria-label="Live signal feed">
            <div className="fc-marquee__track">
              <span className="fc-marquee__live">
                <span className="fc-marquee__live-dot" />
                LIVE
              </span>
              {[...live.signals, ...live.signals].map((sig, i) => (
                <span key={`marquee-${i}`} className="fc-marquee__item">
                  <span className="fc-marquee__dot" />
                  {sig}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Primary-customer doors — the README positions the customer as both
            the operator running capital and the allocator diligencing them.
            The search hero above serves the acquisition (retail/analyst) path;
            these three doors serve the headline path. Mode-aware ordering
            keeps the audience's primary door first while every option stays
            visible (no exclusion — progressive disclosure, not progressive
            gating). */}
        <Reveal as="section" className="mt-4 grid gap-3 sm:grid-cols-2 lg:mt-2" aria-label="Primary-customer entry points">
          {orderedDoors.map((door) => {
            const Icon = door.icon;
            const isLead = door.id === mode;
            return (
              <Link
                key={door.href}
                href={door.href}
                aria-label={`${door.title} · ${AUDIENCE_META[door.id]?.label ?? door.id} mode`}
                className={`fc-door group relative flex flex-col gap-2 border p-5 transition sm:p-6 ${
                  isLead
                    ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-quiet)] hover:border-[var(--color-accent)]/70 hover:bg-[var(--color-accent-atmosphere)]'
                    : 'border-white/10 bg-white/[0.02] hover:border-emerald-400/30 hover:bg-emerald-400/[0.04]'
                } ${orderedDoors.length === 3 && door.id === 'analyst' ? 'sm:col-span-2 lg:col-span-1' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="fc-kicker">{door.eyebrow}</span>
                  <Icon className={`h-4 w-4 transition ${isLead ? 'text-[var(--color-accent)]' : 'text-white/40 group-hover:text-emerald-300'}`} />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {door.title}
                </h3>
                <p className="text-sm leading-6 text-white/60">{door.body}</p>
                <span className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${isLead ? 'text-[var(--color-accent)]' : 'text-emerald-200/80'}`}>
                  Enter
                  <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </Reveal>

        {/* Verify a real receipt — the single most differentiated artifact we
            can show a cold prospect in 10 seconds. A real World Cup fixture
            with a real Merkle proof anchored on Solana devnet, settled on-chain
            via match-escrow CPI. Deep-links into Proof Theatre with the
            fixture pre-selected so the visitor lands on the verification
            chain, not a fixture list. */}
        <Reveal as="section" className="mt-12" aria-label="Verify a real decision on Solana">
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

          <div className="fc-instrument fc-seal-target mt-5 overflow-hidden p-1">
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
                  0.1 SOL settled trustlessly via <span className="font-mono text-white/70">match-escrow</span> CPI → <span className="font-mono text-white/70">txoracle::validate_stat</span>. No intermediary.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2">
                <Ripple
                  options={{
                    amplitude: 0.3,
                    refraction: 60,
                    shine: 0.4,
                    dispersion: 0.3,
                    decay: 1.4,
                    wavelength: 70,
                    interval: 3.5,
                  }}
                  style={{ display: 'inline-block' }}
                >
                  <Link
                    href={`/world-cup?fixture=${VERIFIED_RECEIPT.fixtureId}`}
                    className="fc-action mc-action--primary inline-flex items-center justify-center gap-1.5 px-5 py-3 text-sm"
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    Open Proof Theatre
                  </Link>
                </Ripple>
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
        </Reveal>

        {/* Operator Math — compact (discovery mode) on the landing page so the
            eyebrow pill is omitted and spacing is tighter. The full <OperatorMath />
            variant (eyebrow + Headline pill + generous padding) is reserved for
            /labs/autopilot where the math IS the product context. */}
        <Reveal delay={60}>
          <OperatorMath compact />
        </Reveal>
      </div>
    </main>
  );
}
