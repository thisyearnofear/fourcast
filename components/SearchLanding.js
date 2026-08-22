'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Eye, FileCheck, Fingerprint, Menu, Radar, X } from 'lucide-react';
import PageNav, { HomeLink, PRIMARY_NAV, OVERFLOW_NAV } from '@/app/components/PageNav';
import { useInView } from '@/hooks/useInView';
import { useParallax } from '@/hooks/useParallax';
import ParticleReveal from '@/components/canvasui/ParticleReveal';
import Ripple from '@/components/canvasui/Ripple';
import Reveal from '@/components/motion/Reveal';
import TweenNumber from '@/components/motion/TweenNumber';
import TrustStatsStrip from '@/components/TrustStatsStrip';
import ArenaStrip from '@/components/ArenaStrip';
import EventTape from '@/components/EventTape';
import LiveTicker from '@/components/LiveTicker';
import DecisionRadar from '@/components/DecisionRadar';
import LatestExecutionCard from '@/components/LatestExecutionCard';
import { BRAND } from '@/constants/brand';

// Canonical Solana receipt — kept behind progressive disclosure as depth,
// not competing with the hero.
const VERIFIED_RECEIPT = {
  fixtureId: '18175981',
  home: 'France',
  away: 'Sweden',
  score: '3–0',
  stage: 'World Cup · Round of 32',
  escrowProgramId: 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ',
  settlementTx: '3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB',
};

// The doors the agent walks through. "Private" is no longer a door — privacy
// is a knob inside proof, surfaced only when size demands it.
const DOORS = [
  { href: '/markets', title: 'Markets', short: 'the edge, live across venues' },
  { href: '/positions', title: 'Positions', short: 'your book, one view' },
  { href: '/arena', title: 'Arena', short: 'the agent, proving it live' },
];

const SUPPORTING_CAPS = [
  { href: '/signals', label: 'Signals', desc: 'Calls worth following' },
  { href: '/labs', label: 'Labs', desc: 'Autopilot & builder tools' },
  { href: '/proof?chain=canton', label: 'Private settle', desc: 'Hidden size, only when needed' },
  { href: '/status', label: 'Status', desc: 'Provider health, live' },
];

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
    if (!open) return undefined;
    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return undefined;
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

  const menu =
    open && mounted && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: coords.top, right: coords.right }}
            className="fixed z-[200] w-56 border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] p-1 shadow-xl backdrop-blur-[18px] backdrop-saturate-[1.2]"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
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
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
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
/**
 * ExplorePanel — progressive disclosure. The fold is hero + live tape. The
 * rest of the product news (doors, proof depth, receipt maths) collapses
 * behind a native <details> so the primary viewport stays alive and the
 * scroll stays short. Accessible out of the box, no JS required.
 */
function ExplorePanel({ title, blurb, children }) {
  return (
    <details className="fc-xp group">
      <summary className="fc-xp__summary">
        <span className="inline-flex items-center gap-1.5 text-[var(--color-ink)]">
          {title}
          <span className="hidden text-xs font-normal normal-case tracking-normal text-[var(--color-ink-faint)] sm:inline">
            {blurb}
          </span>
        </span>
        <ChevronDown className="fc-xp__chev h-4 w-4 text-[var(--color-ink-muted)] transition-transform" aria-hidden />
      </summary>
      <div className="fc-xp__body">{children}</div>
    </details>
  );
}

/**
 * ArenaHero — the agent owns the fold. One claim, radar + tape beside it,
 * one doorway (the ledger). Strategy: lead with the agent core; privacy is a
 * knob inside proof, not the thesis.
 */
function ArenaHero() {
  return (
    <section className="fc-hero-stage fc-life-stage" aria-label="Verifiable autonomous agent">
      <p className="fc-kicker fc-print text-[var(--color-accent)] inline-flex items-center gap-2">
        <span className="mc-lamp mc-lamp--live" aria-hidden="true" />
        Fourcast · {BRAND.agent.badge}
      </p>

      <h1
        className="fc-display fc-print mt-4 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-tight text-[var(--color-ink)] sm:text-6xl lg:text-6xl"
        style={{ '--print-delay': '70ms' }}
      >
        An agent that proves every decision —{' '}
        <span className="text-[var(--color-accent)]">before the outcome lands.</span>
      </h1>

      <p
        className="fc-print mt-4 max-w-xl text-base text-[var(--color-ink-muted)] sm:text-lg"
        style={{ '--print-delay': '140ms' }}
      >
        It wakes up, scans every market, sizes each call under strict policy,
        and writes the receipt before the game is decided. You get the tape,
        not the selling.
      </p>

      <div
        className="fc-print mt-7 flex flex-wrap items-center gap-4"
        style={{ '--print-delay': '220ms' }}
      >
        <ParticleReveal
          priority={20}
          options={{ radius: 240, softness: 0.7, size: 1.2, scatter: 30, drift: 0.8, aberration: 12 }}
          style={{ display: 'inline-block' }}
        >
          <Link
            href="/arena"
            className="fc-action mc-action--primary inline-flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base"
          >
            Watch it decide
            <ArrowRight className="h-4 w-4" />
          </Link>
        </ParticleReveal>
        <Link
          href="/markets"
          className="mc-nav-link no-underline inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)]"
        >
          <Radar className="h-4 w-4" aria-hidden />
          Scan today&rsquo;s markets
        </Link>
      </div>

      {/* Live instrument rail — radar sweep + scan readout, side by side. */}
      <div
        className="fc-print mt-9 flex flex-wrap items-center gap-x-8 gap-y-5"
        style={{ '--print-delay': '300ms' }}
      >
        <DecisionRadar />
        <div className="min-w-0 max-w-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
            Now scanning
          </p>
          <p className="mt-1 text-sm leading-5 text-[var(--color-ink-muted)]">
            {BRAND.tagline} Every venue gets the same operator fintech —
            fairness of edge is the whole product.
          </p>
          <Link
            href="/arena?lane=mandate"
            className="mc-nav-link no-underline mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)]"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Inspect the gating policy
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
export default function SearchLanding() {
  const [doorsRef, doorsIn] = useInView({ threshold: 0.05, rootMargin: '0px' });
  const gridRef = useParallax();
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

  return (
    <main className="fc-grain relative min-h-screen overflow-x-hidden text-[var(--ink)]">
      <div className="fc-backdrop" aria-hidden>
        <div ref={gridRef} className="fc-backdrop__grid" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="operator-header sticky top-3 z-50 flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4">
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          <div className="flex items-center gap-2">
            <LandingMobileNav />
          </div>
        </header>

        <ArenaHero />

        {/* The fold never rests — live tape + live heartbeat, always on. */}
        <div className="fc-print mt-6" style={{ '--print-delay': '360ms' }}>
          <LiveTicker />
        </div>

        <ArenaStrip />

        <div className="fc-print mt-6" style={{ '--print-delay': '420ms' }}>
          <EventTape />
        </div>

        {/* ── Progressive disclosure: the machine, only when you ask ── */}
        <section className="mt-9 space-y-4" aria-label="Explore Fourcast">
          <ExplorePanel title="Explore the machine" blurb="doors · proof depth · the math">
            {/* Venue doors */}
            <div
              ref={doorsRef}
              className={`fc-doors grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${doorsIn ? 'fc-doors--in' : ''}`}
            >
              {DOORS.map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="fc-door group flex flex-col gap-1 border border-[var(--color-rule)] bg-white/[0.02] p-4 no-underline transition hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/[0.04]"
                >
                  <span className="font-display text-base font-semibold text-[var(--color-ink)]">
                    {d.title}
                  </span>
                  <span className="text-xs text-[var(--color-ink-muted)]">{d.short}</span>
                </Link>
              ))}
            </div>
{/* Live execution + settled proof depth */}
            <div ref={receiptRef} id="verify-receipt" className="scroll-mt-24">
              <Reveal as="section" aria-label="Live execution and settled proof">
                <LatestExecutionCard />
              </Reveal>
            </div>

            <TrustStatsStrip />

            {/* Supporting caps */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SUPPORTING_CAPS.map((cap) => (
                <Link
                  key={cap.href}
                  href={cap.href}
                  className="group flex flex-col gap-1 border border-[var(--color-rule)] bg-white/[0.02] p-3.5 transition hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/[0.04]"
                >
                  <span className="font-display text-sm font-semibold text-[var(--color-ink)]">
                    {cap.label}
                  </span>
                  <span className="text-xs leading-5 text-[var(--color-ink-muted)]">{cap.desc}</span>
                </Link>
              ))}
            </div>
          </ExplorePanel>

          <ExplorePanel title="A receipt you can open" blurb="the sealed proof, settled on-chain">
            <div className="mc-panel flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
                  Settled fixture · {VERIFIED_RECEIPT.stage}
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-[var(--color-ink)]">
                  {VERIFIED_RECEIPT.home}{' '}
                  <span className="text-[var(--color-ink-faint)]">v</span> {VERIFIED_RECEIPT.away}
                  <span className="ml-2 font-mono text-sm text-[var(--color-accent)]">
                    Final {VERIFIED_RECEIPT.score}
                  </span>
                </p>
                <p className="mt-2 max-w-md text-xs leading-5 text-[var(--color-ink-faint)]">
                  <TweenNumber
                    value={receiptSealed ? 0.1 : 0}
                    duration={800}
                    format={(v) => `${v.toFixed(2)} SOL`}
                    className="font-mono text-[var(--color-ink-muted)]"
                  />{' '}
                  escrow settled via match-escrow CPI. Receipt committed before the outcome.
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
                    href={`/proof?chain=solana&fixture=${VERIFIED_RECEIPT.fixtureId}`}
                    className="fc-action inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm"
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    Open receipt
                  </Link>
                </Ripple>
                <a
                  href={`https://explorer.solana.com/tx/${VERIFIED_RECEIPT.settlementTx}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="mc-nav-link no-underline inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs"
                >
                  <FileCheck className="h-3 w-3" />
                  Settlement tx
                </a>
              </div>
            </div>
          </ExplorePanel>
        </section>
      </div>
    </main>
  );
}
