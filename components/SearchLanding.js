'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Fingerprint, FileCheck, Menu, X } from 'lucide-react';
import PageNav, { HomeLink, PRIMARY_NAV, OVERFLOW_NAV } from '@/app/components/PageNav';
import { useInView } from '@/hooks/useInView';
import { useParallax } from '@/hooks/useParallax';
import Ripple from '@/components/canvasui/Ripple';
import Reveal from '@/components/motion/Reveal';
import ProofChain from '@/components/ProofChain';
import TweenNumber from '@/components/motion/TweenNumber';
import TrustStatsStrip from '@/components/TrustStatsStrip';
import ArenaStrip from '@/components/ArenaStrip';
import EventTape from '@/components/EventTape';

// Canonical Solana receipt — kept below the fold as depth, not competing hero.
const VERIFIED_RECEIPT = {
  fixtureId: '18175981',
  home: 'France',
  away: 'Sweden',
  score: '3–0',
  stage: 'World Cup · Round of 32',
  escrowProgramId: 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ',
  settlementTx: '3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB',
};

// Uniform compact doors — every venue gets the same weight; the hero does
// the convincing.
const DOORS = [
  { href: '/markets', title: 'Markets', short: 'odds, edge, one action' },
  { href: '/positions', title: 'Positions', short: 'your book, every venue' },
  { href: '/arena', title: 'Arena', short: 'live proof of discipline' },
  { href: '/proof?chain=canton', title: 'Private', short: 'hidden size · CBTC settle' },
];

const SUPPORTING_CAPS = [
  { href: '/signals', label: 'Signals', desc: 'Verified analyst calls' },
  { href: '/labs', label: 'Labs', desc: 'Autopilot & builder tools' },
  { href: '/positions?view=private', label: 'Claim win', desc: 'Holder settle on Canton' },
  { href: '/status', label: 'Status', desc: 'Provider health live' },
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
          document.body
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
 * ArenaHero — the verifiable agent owns the fold. One claim, one live strip
 * of real decisions, one doorway (the ledger). Strategy: lead with the agent
 * core (STRATEGY.md, 2026-08-10); Canton privacy is a door, not the thesis.
 */
function ArenaHero() {
  return (
    <section className="fc-hero-stage fc-life-stage" aria-label="Verifiable autonomous agent">
      <p className="fc-kicker fc-print text-[var(--color-accent)] inline-flex items-center gap-2">
        <span className="mc-lamp mc-lamp--live" aria-hidden="true" />
        Fourcast · Live agent proof
      </p>

      <h1 className="fc-display fc-print mt-4 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-tight text-[var(--color-ink)] sm:text-6xl lg:text-6xl" style={{ '--print-delay': '70ms' }}>
        An agent that proves every decision —
        <span className="text-[var(--color-accent)]"> before the game ends.</span>
      </h1>

      <p className="fc-print mt-4 max-w-xl text-base text-[var(--color-ink-muted)] sm:text-lg" style={{ '--print-delay': '140ms' }}>
        Watch it trade Delphi live — every call, its evidence, its verdict.
      </p>

      <div className="fc-print" style={{ '--print-delay': '220ms' }}>
        <ArenaStrip />
      </div>

      <div className="fc-print mt-7 flex flex-wrap items-center gap-4" style={{ '--print-delay': '300ms' }}>
        <Ripple
          options={{
            amplitude: 0.32,
            refraction: 55,
            shine: 0.4,
            dispersion: 0.28,
            decay: 1.35,
            wavelength: 70,
          }}
          style={{ display: 'inline-block' }}
        >
          <Link
            href="/arena"
            className="fc-action mc-action--primary fc-action--pulse inline-flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base"
          >
            Open the live ledger
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Ripple>
        <Link href="/markets" className="mc-nav-link no-underline inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)]">
          Browse markets
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
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

        <div className="fc-print mt-6" style={{ '--print-delay': '380ms' }}>
          <EventTape />
        </div>

        {/* Uniform venue doors — same weight, four compact entries */}
        <section
          ref={doorsRef}
          className={`fc-doors mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${doorsIn ? 'fc-doors--in' : ''}`}
          aria-label="Venue entry points"
        >
          {DOORS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="fc-door group flex flex-col gap-1 border border-[var(--color-rule)] bg-white/[0.02] p-4 no-underline transition hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/[0.04]"
            >
              <span className="font-display text-base font-semibold text-[var(--color-ink)]">{d.title}</span>
              <span className="text-xs text-[var(--color-ink-muted)]">{d.short}</span>
            </Link>
          ))}
        </section>

        <TrustStatsStrip />

        {/* Solana proof depth — below the fold */}
        <div ref={receiptRef} id="verify-receipt" className="scroll-mt-24">
          <Reveal as="section" className="mt-10" aria-label="Verify a decision receipt">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
              <div>
                <p className="fc-kicker">Decision receipts · Solana</p>
                <h2 className="mt-1.5 max-w-xl font-display text-xl font-semibold leading-tight tracking-tight text-[var(--color-ink)] sm:text-2xl">
                  A settled proof you can audit
                </h2>
              </div>
            </div>

            <ProofChain />

            <div className="fc-instrument mt-4 overflow-hidden p-1">
              <div className="fc-instrument__inner flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
                    {VERIFIED_RECEIPT.stage}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold text-[var(--color-ink)]">
                    {VERIFIED_RECEIPT.home} <span className="text-[var(--color-ink-faint)]">v</span> {VERIFIED_RECEIPT.away}
                    <span className="ml-2 font-mono text-sm text-[var(--color-accent)]">Final {VERIFIED_RECEIPT.score}</span>
                  </p>
                  <p className="mt-2 max-w-md text-xs leading-5 text-[var(--color-ink-faint)]">
                    <TweenNumber
                      value={receiptSealed ? 0.1 : 0}
                      duration={800}
                      format={(v) => `${v.toFixed(2)} SOL`}
                      className="font-mono text-[var(--color-ink-muted)]"
                    />{' '}
                    escrow settled via match-escrow CPI.
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
            </div>
          </Reveal>
        </div>

        <section className="mt-10 border-t border-[var(--color-rule)] pt-6" aria-label="More">
          <p className="fc-kicker mb-3">More</p>
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
                <span className="text-xs leading-5 text-[var(--color-ink-muted)]">
                  {cap.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
