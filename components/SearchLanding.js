'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Radar } from 'lucide-react';
import PageNav, { HomeLink, MobileNavMenu } from '@/app/components/PageNav';
import LatestExecutionCard from '@/components/LatestExecutionCard';
import TrustStatsStrip from '@/components/TrustStatsStrip';
import AgentRail from '@/components/AgentRail';
import LiquidField from '@/components/LiquidField';
import VenueMap from '@/components/VenueMap';
import ProofTimeline from '@/components/ProofTimeline';
import NearMandateCard from '@/components/NearMandateCard';
import WatchedReceipts from '@/components/WatchedReceipts';
import ParallaxReveal from '@/components/ui/ParallaxReveal';
import { useAudience } from '@/hooks/useAudience';
import { BRAND } from '@/constants/brand';

// One product, three proofs, all visible. Reading mode and `?lens=` only
// promote one to the primary action. Analyst → receipt, operator → NEAR
// mandate, allocator → Canton private. The other two stay on the page.
const PROOF_LENSES = [
  {
    id: 'receipt',
    mode: 'analyst',
    label: 'Receipt',
    kicker: 'Evidence & settlement',
    sub: 'Market evidence becomes sealed decisions, verifiable outcomes, and private settlement when discretion matters.',
    cta: 'Open the receipt',
    href: '/proof',
    mark: '◆',
    promise: 'Sealed before the result',
    forWhom: 'Analysts',
  },
  {
    id: 'mandate',
    mode: 'operator',
    label: 'Mandate',
    kicker: 'NEAR mandate · testnet',
    sub: 'A NEAR contract checks venue, size, liquidity, slippage, and cooldown before this agent can sign. The Polygon account has no private key.',
    cta: 'Check the mandate',
    href: '/arena?lane=mandate',
    mark: '⬡',
    promise: 'The contract can refuse',
    forWhom: 'Operators',
  },
  {
    id: 'private',
    mode: 'allocator',
    label: 'Private',
    kicker: 'Private settlement · Canton',
    sub: 'Position size stays off the public book. Canton escrow is the path when a counterparty needs discretion. DevNet.',
    cta: 'Open private settlement',
    href: '/proof?chain=canton',
    mark: '◈',
    promise: 'Size stays off the book',
    forWhom: 'Allocators',
  },
];

// Venues named in the hero legend strip. The glowing peaks themselves stand
// in the backdrop field behind the hero (LiquidFieldScene on capable
// clients, WaveGrid elsewhere); Canton stays quiet (amber) as a DevNet venue.
const HERO_VENUES = [
  { name: 'NEAR', href: '/arena?lane=mandate' },
  { name: 'Polymarket' },
  { name: 'Kalshi' },
  { name: 'Delphi' },
  { name: 'Canton', href: '/proof?chain=canton', quiet: true },
];

// ────────────────────────────────────────────
//  HERO — full viewport, compressed, magnetic
// ────────────────────────────────────────────

function Hero() {
  const { mode, setMode, hydrated } = useAudience();
  const queryApplied = useRef(false);

  useEffect(() => {
    if (!hydrated || queryApplied.current) return;
    queryApplied.current = true;
    const requested = new URLSearchParams(window.location.search).get('lens');
    const next = PROOF_LENSES.find((lens) => lens.id === requested);
    if (next) setMode(next.mode);
  }, [hydrated, setMode]);

  const lens = PROOF_LENSES.find((item) => item.mode === mode) ?? PROOF_LENSES[0];
  const ordered = [lens, ...PROOF_LENSES.filter((item) => item.id !== lens.id)];

  return (
    <section className="fc-life-stage relative z-10 flex min-h-[92dvh] flex-col items-center justify-center px-4 pb-16 pt-16 text-center sm:px-6 lg:px-8">
      {/* Atmospheric glow behind hero */}
      <div className="pointer-events-none absolute inset-0 -z-1" aria-hidden>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:-translate-x-[40%] sm:-translate-y-[20%] sm:translate-x-0"
          style={{
            width: 'clamp(320px, 50vw, 600px)',
            height: 'clamp(320px, 50vw, 600px)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--color-accent-atmosphere), transparent 70%)',
            filter: 'blur(60px)',
            opacity: 0.6,
          }}
        />
      </div>

      <p className="fc-kicker fc-print inline-flex items-center gap-2">
        <span className="mc-lamp mc-lamp--live" aria-hidden />
        Evidence &amp; settlement
      </p>

      {/* Headline — print stagger, not word-by-word */}
      <h1
        className="fc-display fc-print mt-4 max-w-4xl text-3xl font-bold leading-[1.02] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl"
        style={{ '--print-delay': '120ms' }}
      >
        Every prediction deserves a{' '}
        <span className="text-[var(--color-accent)]">proof trail.</span>
      </h1>

      <p
        className="fc-print mt-3 max-w-xl text-[15px] leading-snug text-[var(--color-ink-muted)] sm:mt-4 sm:text-base"
        style={{ '--print-delay': '200ms' }}
      >
        Pick a way to check it. The highlighted path matches how you are reading.
      </p>

      <div
        className="fc-print mt-6 grid w-full max-w-3xl items-start gap-3 text-left sm:grid-cols-3"
        style={{ '--print-delay': '280ms' }}
      >
        {ordered.map((item) => {
          const lead = item.id === lens.id;
          return (
            <article
              key={item.id}
              className={`flex flex-col border px-3 py-3 transition-[border-color,background-color] duration-300 ${
                lead
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-quiet)]'
                  : 'border-[var(--color-rule)] bg-[var(--color-paper-glass)] hover:border-[var(--color-accent)]'
              }`}
            >
              <button
                type="button"
                aria-pressed={lead}
                onClick={() => setMode(item.mode)}
                className="flex flex-1 flex-col items-start gap-1 text-left"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span
                    className="font-mono text-sm"
                    style={{ color: item.id === 'private' ? 'var(--color-sealed)' : 'var(--color-accent)' }}
                    aria-hidden
                  >
                    {item.mark}
                  </span>
                  {lead && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
                      For {item.forWhom}
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold text-[var(--color-ink)]">{item.label}</span>
                <span className="text-[13px] leading-snug text-[var(--color-ink-muted)]">{item.promise}</span>
              </button>
              <div className={`fc-clip-wrap ${lead ? 'is-open' : ''}`}>
                <div>
                  <div className="fc-clip pt-3">
                    <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">{item.sub}</p>
                    {item.id === 'mandate' && <NearMandateCard variant="hero" />}
                    <Link
                      href={item.href}
                      className="fc-action mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm"
                    >
                      {item.cta}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Link
        href="/markets"
        className="fc-print mc-nav-link mt-5 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] no-underline"
        style={{ '--print-delay': '360ms' }}
      >
        <Radar className="h-4 w-4" aria-hidden />
        Explore markets
      </Link>

      {/* Venue legend — the labeled peaks themselves stand in the wave
          field behind the hero; this strip names them and links to the
          ledger. Replaces the old DecisionRadar + "now scanning" block. */}
      <div
        className="fc-print mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:mt-8"
        style={{ '--print-delay': '360ms' }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
          Venues
        </span>
        {HERO_VENUES.map((v) => (
          <Link
            key={v.name}
            href={v.href || '/arena'}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-ink-muted)] no-underline transition-colors hover:text-[var(--color-accent)]"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: v.quiet ? 'var(--color-sealed)' : 'var(--color-accent)' }}
              aria-hidden
            />
            {v.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────
//  MAIN COMPONENT — compact, scroll-driven
// ────────────────────────────────────────────

export default function SearchLanding() {
  const headerRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  // Track header background
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="fc-grain relative min-h-screen overflow-x-hidden text-[var(--ink)]">
      {/* Backdrop — the landing's living field. LiquidField mounts the
          WebGL liquid wave field on capable clients (WebGL + fine pointer
          + no reduced motion + no Save-Data) and falls back to the 2D
          WaveGrid everywhere else. Both breathe, ripple to the pointer,
          and sweep state-colored pulses via the shared BackdropProvider
          bus. The static CSS grid underneath is the final fallback. */}
      <LiquidField />
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="fc-backdrop">
          <div className="fc-backdrop__grid" />
        </div>
      </div>

      {/* Content — single column, max-w-6xl */}
      <div className="mobile-readable relative mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        {/* Header — compressed, glass on scroll */}
        <header
          ref={headerRef}
          className={`operator-header sticky top-3 z-[var(--z-chrome)] flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4 ${scrolled ? 'border-[var(--color-rule)]' : ''}`}
          style={{
            borderColor: scrolled ? 'var(--color-rule)' : 'transparent',
          }}
        >
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          <MobileNavMenu className="sm:hidden" />
        </header>

        {/* ── Hero (full viewport) ── */}
        <Hero />

        <WatchedReceipts />

        {/* ── Unified agent rail (single feed, replaces 3 separate) ── */}
        <div className="relative z-10 border-t border-[var(--color-rule)]">
          <AgentRail />
        </div>

        {/* ── Venue surfaces (replaces doors grid) ── */}
        <ParallaxReveal speed={0.12} className="px-4 py-8 sm:px-6 lg:px-8">
          <VenueMap />
        </ParallaxReveal>

        {/* ── Latest execution + trust stats ── */}
        <ParallaxReveal speed={0.08} className="space-y-4 px-4 pb-8 sm:px-6 lg:px-8">
          <LatestExecutionCard />
          {/* TrustStatsStrip — hidden on mobile (low value, takes space) */}
          <div className="hidden sm:block">
            <TrustStatsStrip />
          </div>
        </ParallaxReveal>

        {/* ── Proof lifecycle (replaces receipt panel + footer receipt) ── */}
        <ParallaxReveal speed={0.05} className="px-4 pb-12 sm:px-6 lg:px-8">
          <ProofTimeline />
        </ParallaxReveal>
      </div>
    </main>
  );
}
