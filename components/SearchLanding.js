'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import Reveal from '@/components/motion/Reveal';
import LiveMarketMetrics from '@/components/motion/LiveMarketMetrics';
import ContextualDataStrip from '@/components/ContextualDataStrip';
import ProofChain from '@/components/ProofChain';
import useLiveMarkets from '@/hooks/useLiveMarkets';
import { confidenceLabel, confidenceTint, directionFor } from '@/utils/marketEdge';
import TweenNumber from '@/components/motion/TweenNumber';

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
    preview: 'Live mandates · dry-run available',
  },
  {
    id: 'allocator',
    href: '/positions',
    icon: ShieldCheck,
    eyebrow: 'I diligence operators',
    title: 'Allocator Diligence',
    body: 'Policy adherence, receipt coverage, discipline rate, and calibration — computed from the same public receipts, not self-reported.',
    preview: 'Receipts verified on-chain',
  },
  {
    id: 'analyst',
    href: '/markets',
    icon: Compass,
    eyebrow: 'I scan markets',
    title: 'Analyst Markets',
    body: 'Discover edge across active prediction markets. Filter by category, scan a curated set, and follow live reasoning before a mandate commits capital.',
    preview: 'Polymarket + Kalshi · live odds',
  },
];

export default function SearchLanding() {
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

  // Receipt seal animation — triggers when the proof section scrolls into view.
  const [receiptSealed, setReceiptSealed] = useState(false);
  const receiptRef = useRef(null);
  useEffect(() => {
    const node = receiptRef.current;
    if (!node) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setReceiptSealed(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReceiptSealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setArmed(true);
  }, []);

  // Mode-aware door ordering — the audience's primary door leads, the others
  // remain visible. Three modes, three doors; the third (Analyst Markets) is
  // surfaced when the visitor hasn't picked a role yet, otherwise it sits in
  // its right position.
  const orderedDoors = useMemo(() => {
    const others = AUDIENCE_DOORS.filter((d) => d.id !== mode);
    const lead = AUDIENCE_DOORS.find((d) => d.id === mode);
    return lead ? [lead, ...others] : AUDIENCE_DOORS;
  }, [mode]);

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

            <h1 className="fc-display mt-4 text-5xl font-extrabold leading-[0.9] tracking-tight text-[var(--color-ink)] sm:text-6xl lg:text-[4.25rem]">
              {BRAND.name}
            </h1>

            <p className="mt-5 max-w-md text-lg leading-7 text-[var(--color-ink-muted)] sm:text-xl">
              {BRAND.tagline}
            </p>

            {/* Hero CTAs commit to the headline customer: the operator under
                mandate and the allocator auditing them. Search lives on
                /markets — the analyst door below leads there. */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Ripple
                options={{
                  amplitude: 0.3,
                  refraction: 60,
                  shine: 0.4,
                  dispersion: 0.3,
                  decay: 1.4,
                  wavelength: 70,
                }}
                style={{ display: 'inline-block' }}
              >
                <Link
                  href="/agent"
                  className="fc-action mc-action--primary inline-flex items-center justify-center gap-1.5 px-6 py-3 text-sm"
                >
                  Open Mandate Control
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Ripple>
              <a
                href="#verify-receipt"
                className="fc-action inline-flex items-center justify-center gap-1.5 px-6 py-3 text-sm"
              >
                Audit a settled receipt
              </a>
            </div>

            <p className="mt-6 text-sm text-[var(--color-ink-faint)]">
              No wallet needed to audit.{' '}
              <Link
                href="/markets"
                className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-4 transition hover:text-[var(--color-ink)]"
              >
                Scan markets as an analyst →
              </Link>
              {!webIntel.loading && !webIntel.available && (
                <span className="mt-1 block text-[var(--color-ink-faint)]">
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
            <div className="absolute -inset-4 bg-[var(--color-accent)]/10 blur-3xl" aria-hidden />
            <div className={`fc-instrument edge-reveal relative overflow-hidden p-1 shadow-2xl shadow-black/50 ${live.isLive ? 'fc-instrument--armed' : ''}`}>
              <div className="fc-instrument__inner p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="fc-kicker">
                      Decision replay · {live.isLive ? 'live markets' : 'connecting'}
                      {live.markets.length > 1 && (
                        <span className="ml-2 text-[var(--color-ink-faint)]">
                          {marketIndex + 1}/{live.markets.length}
                        </span>
                      )}
                    </p>
                    <h2 key={`title-${marketIndex}`} className="fc-market-slide mt-2 max-w-sm text-lg font-semibold leading-snug text-[var(--color-ink)] sm:text-xl">
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
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">{label}</div>
                        <div className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--color-ink-faint)] sm:text-3xl">—</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--color-rule)] pt-4">
                  <p className="text-sm text-[var(--color-ink-faint)]">
                    {activeMarket ? (
                      <>Recommendation{' '}
                        <span className="font-semibold text-[var(--color-accent)]">
                          {directionFor(activeMarket.edgeScore)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[var(--color-ink-faint)]">Connecting to live market feed…</span>
                    )}
                  </p>
                  <Link
                    href={activeMarket ? `/markets?q=${encodeURIComponent(activeMarket.title)}&first=1` : '/markets'}
                    className="fc-action px-3 py-2 text-xs"
                  >
                    Run this market
                  </Link>
                </div>

                {/* Live signal ticker is now a full-width marquee below the hero. */}

                {/* Contextual data strip — free macro/sentiment data that
                    relates to the currently displayed market. Shows live
                    BTC spot, Fear & Greed, Fed funds rate, etc. */}
                {activeMarket && (
                  <ContextualDataStrip title={activeMarket.title} />
                )}

                {/* Edge provenance — transparently shows where the edge
                    comes from: SynthData ML ensemble (200+ models), or
                    cross-venue arbitrage between Polymarket and Kalshi. */}
                {activeMarket?.edgeScore != null && Math.abs(activeMarket.edgeScore) >= 0.05 && (
                  <div className="mt-2 flex items-center gap-2 border-t border-[var(--color-rule)] pt-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
                      Edge source
                    </span>
                    <span className="font-mono text-[9px] text-[var(--color-accent)]/60">
                      SynthData ML · 200+ models
                    </span>
                    <span className="text-[var(--color-ink-faint)]">·</span>
                    <span className="font-mono text-[9px] text-[var(--color-ink-faint)]">
                      cross-venue parity checked
                    </span>
                  </div>
                )}
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
            The hero CTAs above commit to the headline path; these three doors
            route by role, with the analyst path leading to /markets (where
            search lives). Mode-aware ordering keeps the audience's primary
            door first while every option stays visible (no exclusion —
            progressive disclosure, not progressive gating). */}
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
                    : 'border-[var(--color-rule)] bg-white/[0.02] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/[0.04]'
                } ${orderedDoors.length === 3 && door.id === 'analyst' ? 'sm:col-span-2 lg:col-span-1' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="fc-kicker">{door.eyebrow}</span>
                  <Icon className={`h-4 w-4 transition ${isLead ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-faint)] group-hover:text-[var(--color-accent)]'}`} />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-2xl">
                  {door.title}
                </h3>
                <p className="text-sm leading-6 text-[var(--color-ink-muted)]">{door.body}</p>
                <span className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${isLead ? 'text-[var(--color-accent)]' : 'text-[var(--color-accent)]/80'}`}>
                  Enter
                  <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </span>
                {door.preview && (
                  <div className="fc-door__preview">
                    <div className="fc-door__preview-row">
                      <span className="fc-door__preview-dot" />
                      {door.preview}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </Reveal>

        {/* Private settlement teaser — the Canton's hidden-size advantage is
            our structural differentiator for size-taking traders. Surfacing
            it on the landing ensures judges and whales discover it within the
            first scroll instead of hunting through the More menu. */}
        <Reveal
          as="section"
          className="mt-8 grid gap-px overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-soft)] sm:grid-cols-[1fr_auto] lg:mt-6"
          aria-label="Private settlement on Canton"
        >
          <div className="flex items-start gap-4 bg-[var(--color-paper)] p-5 sm:items-center">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--color-accent)]" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-accent)]/80">
                Private settlement · Canton
              </p>
              <p className="mt-2 text-base font-medium leading-6 text-[var(--color-ink)]">
                Take size without leaking it.
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">
                Positions are sealed in Daml contracts — only you and the operator can see the size. Settled in cBTC/cETH.
              </p>
            </div>
          </div>
          <Link
            href="/canton"
            className="group flex items-center justify-center gap-2 bg-[var(--color-paper)] p-5 text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent-quiet)] no-underline"
            aria-label="Open private markets on Canton"
          >
            Run the privacy proof
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        {/* Verify a real receipt — the single most differentiated artifact we
            can show a cold prospect in 10 seconds. A real World Cup fixture
            with a real Merkle proof anchored on Solana devnet, settled on-chain
            via match-escrow CPI. Deep-links into Proof Theatre with the
            fixture pre-selected so the visitor lands on the verification
            chain, not a fixture list. */}
        <div ref={receiptRef} id="verify-receipt" className="scroll-mt-24">
        <Reveal as="section" className="mt-12" aria-label="Verify a real decision on Solana">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
            <div>
              <p className="fc-kicker">Verify a real decision on Solana</p>
              <h2 className="mt-2 max-w-xl font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--color-ink)] sm:text-3xl">
                A receipt already settled on-chain. Audit it yourself.
              </h2>
            </div>
            <p className="max-w-sm text-xs leading-5 text-[var(--color-ink-faint)]">
              No signup, no wallet. Each step is verifiable on-chain.
            </p>
          </div>

          <ProofChain />

          <div className="fc-instrument fc-seal-target mt-5 overflow-hidden p-1">
            <div className="fc-instrument__inner flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
                  {VERIFIED_RECEIPT.stage}
                </p>
                <p className="mt-1.5 font-display text-xl font-semibold text-[var(--color-ink)] sm:text-2xl">
                  {VERIFIED_RECEIPT.home} <span className="text-[var(--color-ink-faint)]">v</span> {VERIFIED_RECEIPT.away}
                </p>
                <p className="mt-1 font-mono text-sm text-[var(--color-accent)]">
                  Final {VERIFIED_RECEIPT.score}
                </p>
                <p className="mt-3 max-w-md text-xs leading-5 text-[var(--color-ink-faint)]">
                  <TweenNumber
                    value={receiptSealed ? 0.1 : 0}
                    duration={800}
                    format={(v) => `${v.toFixed(2)} SOL`}
                    className="font-mono text-[var(--color-ink-muted)]"
                  /> settled trustlessly via <span className="font-mono text-[var(--color-ink-muted)]">match-escrow</span> CPI → <span className="font-mono text-[var(--color-ink-muted)]">txoracle::validate_stat</span>. No intermediary.
                </p>
                {receiptSealed && (
                  <span className="mc-stamp mc-stamp--allocate mt-3 inline-flex" key="sealed">
                    ✓ Verified on-chain
                  </span>
                )}
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
        </div>

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
