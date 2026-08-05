'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Fingerprint, Lock, EyeOff, FileCheck, Menu, X } from 'lucide-react';
import PageNav, { HomeLink, PRIMARY_NAV, OVERFLOW_NAV } from '@/app/components/PageNav';
import { useInView } from '@/hooks/useInView';
import { useParallax } from '@/hooks/useParallax';
import Ripple from '@/components/canvasui/Ripple';
import Reveal from '@/components/motion/Reveal';
import ProofChain from '@/components/ProofChain';
import TweenNumber from '@/components/motion/TweenNumber';
import TrustStatsStrip from '@/components/TrustStatsStrip';

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

// Asymmetric venue doors: Private is the differentiator, markets/positions
// are reduced to a compact secondary line.
const PRIVATE_DOOR = {
  href: '/proof?chain=canton',
  title: 'Private settle',
  short: 'Hidden size. Escrow-locked stake. Atomic CBTC payout.',
  cta: 'Run the privacy check',
};

const SECONDARY_VENUES = [
  { href: '/markets', title: 'Markets', short: 'odds, edge, one action' },
  { href: '/positions', title: 'Positions', short: 'public + private track record' },
];

const SUPPORTING_CAPS = [
  { href: '/signals', label: 'Signals', desc: 'Verified analyst calls' },
  { href: '/agent', label: 'Mandate', desc: 'Policy-bound agent loop' },
  { href: '/labs', label: 'Labs', desc: 'Autopilot & builder tools' },
  { href: '/positions?view=private', label: 'Claim win', desc: 'Holder settle on Canton' },
];

function PrivateDoor() {
  return (
    <Link
      href={PRIVATE_DOOR.href}
      style={{ '--door-delay': '0ms' }}
      className="fc-door fc-door--primary group relative flex flex-col gap-2 overflow-hidden border border-[var(--color-accent)]/35 p-6 transition hover:border-[var(--color-accent)]/60 sm:p-8"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-3xl">
          {PRIVATE_DOOR.title}
        </h3>
        <Lock className="h-5 w-5 text-[var(--color-accent)]/70 transition group-hover:text-[var(--color-accent)]" />
      </div>
      <p className="max-w-md text-sm leading-6 text-[var(--color-ink-muted)] sm:text-base">
        {PRIVATE_DOOR.short}
      </p>
      <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
        {PRIVATE_DOOR.cta}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

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
 * CantonHero — the confession line owns the canvas. No card, no clock, one
 * doorway. A single fragment of the holder/book duet sits under the claim;
 * the full act plays on Private.
 */
function CantonHero() {
  return (
    <section className="fc-hero-stage fc-life-stage" aria-label="Private prediction markets on Canton">
      <p className="fc-kicker fc-print text-[var(--color-accent)] inline-flex items-center gap-2">
        <span className="mc-lamp mc-lamp--live" aria-hidden="true" />
        Fourcast · Canton
      </p>

      <h1 className="fc-display fc-print mt-4 max-w-5xl text-4xl font-extrabold leading-[1.0] tracking-tight text-[var(--color-ink)] sm:text-6xl lg:text-7xl" style={{ '--print-delay': '70ms' }}>
        Every size bet in public is a confession.
        <span className="text-[var(--color-accent)]"> Not here.</span>
      </h1>

      <div className="fc-hero-fragment fc-print mt-9" style={{ '--print-delay': '160ms' }} aria-hidden="true">
        <div className="fc-hero-fragment__seat">
          <span className="fc-hero-fragment__label">Your seat</span>
          <span className="fc-hero-fragment__value fc-hero-fragment__value--see">500 · YES</span>
        </div>
        <div className="fc-hero-fragment__seat fc-hero-fragment__seat--blind">
          <span className="fc-hero-fragment__label inline-flex items-center gap-1.5">
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            The public book
          </span>
          <span className="fc-hero-fragment__value">— · —</span>
        </div>
      </div>

      <div className="fc-print mt-9" style={{ '--print-delay': '250ms' }}>
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
            href="/proof?chain=canton"
            className="fc-action mc-action--primary fc-action--pulse inline-flex items-center justify-center gap-2 px-6 py-3 text-sm sm:text-base"
          >
            See Private
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Ripple>
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

        <CantonHero />

        {/* Asymmetric venue doors: Private dominant, others a quiet line */}
        <section
          ref={doorsRef}
          className={`fc-doors mt-4 ${doorsIn ? 'fc-doors--in' : ''}`}
          aria-label="Venue entry points"
        >
          <PrivateDoor />
          <p className="fc-venue-line">
            <span>Also:</span>
            {SECONDARY_VENUES.map((v, i) => (
              <span key={v.href} className="inline-flex items-baseline gap-2">
                {i > 0 && <span aria-hidden="true">·</span>}
                <Link href={v.href}>
                  {v.title}
                  <span className="fc-venue-line__desc"> — {v.short}</span>
                </Link>
              </span>
            ))}
          </p>
        </section>

        <TrustStatsStrip />

        {/* Supporting strip — mandate depth without a competing hero */}
        <section className="mt-10 border-t border-[var(--color-rule)] pt-6" aria-label="Also on Fourcast">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="fc-kicker">Also on Fourcast</p>
              <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-2xl">
                Mandate-bound decisions with sealed receipts
              </h2>
            </div>
            <Link
              href="/agent"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)]"
            >
              Open Mandate
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

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
