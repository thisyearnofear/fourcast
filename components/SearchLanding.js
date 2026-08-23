'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Eye, Menu, Radar, X } from 'lucide-react';
import PageNav, { HomeLink, PRIMARY_NAV, OVERFLOW_NAV } from '@/app/components/PageNav';
import ParticleReveal from '@/components/canvasui/ParticleReveal';
import DecisionRadar from '@/components/DecisionRadar';
import LatestExecutionCard from '@/components/LatestExecutionCard';
import TrustStatsStrip from '@/components/TrustStatsStrip';
import AgentRail from '@/components/AgentRail';
import WaveGrid from '@/components/WaveGrid';
import VenueMap from '@/components/VenueMap';
import ProofTimeline from '@/components/ProofTimeline';
import MagneticButton from '@/components/ui/MagneticButton';
import ParallaxReveal from '@/components/ui/ParallaxReveal';
import { BRAND } from '@/constants/brand';

// ────────────────────────────────────────────
//  MOBILE NAV — reused from existing
// ────────────────────────────────────────────

function LandingMobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const links = [
    ...PRIMARY_NAV.map((i) => ({ name: i.name, href: i.href })),
    ...OVERFLOW_NAV.map((i) => ({ name: i.name, href: i.href })),
    { name: 'Status', href: '/status' },
  ];

  useEffect(() => setMounted(true), []);

  const placeMenu = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      top: Math.round(r.bottom + 6),
      right: Math.round(Math.max(8, window.innerWidth - r.right)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu = open && mounted && coords
    ? createPortal(
        <div ref={menuRef} role="menu" style={{ top: coords.top, right: coords.right }}
          className="fixed z-[200] w-56 border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] p-1 shadow-xl backdrop-blur-[18px] backdrop-saturate-[1.2]"
        >
          {links.map((item) => (
            <Link
              key={item.href} href={item.href} role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full px-2.5 py-2 text-left text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink)] no-underline transition-colors hover:bg-white/[0.04]"
            >
              {item.name}
            </Link>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        className="mc-nav-link no-underline inline-flex items-center gap-1 px-2.5 py-2"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>
      {menu}
    </div>
  );
}

// ────────────────────────────────────────────
//  HERO — full viewport, compressed, magnetic
// ────────────────────────────────────────────

function Hero() {
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

      {/* Agent badge */}
      <p className="fc-kicker fc-print inline-flex items-center gap-2">
        <span className="mc-lamp mc-lamp--live" aria-hidden />
        {BRAND.agent.badge}
      </p>

      {/* Headline — print stagger, not word-by-word */}
      <h1
        className="fc-display fc-print mt-4 max-w-4xl text-3xl font-extrabold leading-[1.02] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl"
        style={{ '--print-delay': '120ms' }}
      >
        An agent that proves every decision —{' '}
        <span className="text-[var(--color-accent)]">before the outcome lands.</span>
      </h1>

      {/* Sub — one breath */}
      <p
        className="fc-print mt-4 max-w-xl text-base text-[var(--color-ink-muted)] sm:text-lg"
        style={{ '--print-delay': '200ms' }}
      >
        Scans markets. Sizes under policy. Writes the receipt.{' '}
        <span className="text-[var(--color-ink-faint)]">You get the tape, not the selling.</span>
      </p>

      {/* CTAs — one primary (magnetic + particle reveal), one secondary */}
      <div
        className="fc-print mt-7 flex flex-wrap items-center justify-center gap-4"
        style={{ '--print-delay': '280ms' }}
      >
        <MagneticButton as="div" intensity={0.18} style={{ display: 'inline-block' }}>
          <ParticleReveal
            priority={20}
            options={{ radius: 240, softness: 0.7, size: 1.2, scatter: 30, drift: 0.8, aberration: 12 }}
            style={{ display: 'inline-block' }}
          >
            <Link
              href="/arena"
              className="fc-action inline-flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base"
            >
              Watch it decide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </ParticleReveal>
        </MagneticButton>
        <Link
          href="/markets"
          className="mc-nav-link no-underline inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)]"
        >
          <Radar className="h-4 w-4" aria-hidden />
          Scan today&rsquo;s markets
        </Link>
      </div>

      {/* Live instrument rail — compact inline */}
      <div
        className="fc-print mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
        style={{ '--print-delay': '360ms' }}
      >
        <DecisionRadar />
        <div className="min-w-0 max-w-sm text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
            Now scanning
          </p>
          <p className="mt-0.5 text-sm leading-5 text-[var(--color-ink-muted)]">
            {BRAND.tagline}
          </p>
          <Link
            href="/arena?lane=mandate"
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] no-underline hover:underline"
          >
            <Eye className="h-3 w-3" aria-hidden />
            Inspect the gating policy
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
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
      {/* Backdrop layers — WaveGrid self-handles reduced motion (static frame). */}
      <WaveGrid />
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="fc-backdrop">
          <div className="fc-backdrop__grid" />
        </div>
      </div>

      {/* Content — single column, max-w-6xl */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        {/* Header — compressed, glass on scroll */}
        <header
          ref={headerRef}
          className={`operator-header sticky top-3 z-50 flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4 ${scrolled ? 'border-[var(--color-rule)]' : ''}`}
          style={{
            borderColor: scrolled ? 'var(--color-rule)' : 'transparent',
          }}
        >
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          <LandingMobileNav />
        </header>

        {/* ── Hero (full viewport) ── */}
        <Hero />

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
          <TrustStatsStrip />
        </ParallaxReveal>

        {/* ── Proof lifecycle (replaces receipt panel + footer receipt) ── */}
        <ParallaxReveal speed={0.05} className="px-4 pb-12 sm:px-6 lg:px-8">
          <ProofTimeline />
        </ParallaxReveal>
      </div>
    </main>
  );
}
