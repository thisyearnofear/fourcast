'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Fingerprint, ShieldCheck, LineChart, Compass, Lock, FileCheck, Scale } from 'lucide-react';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import { useAudience, AUDIENCE_META } from '@/hooks/useAudience';
import Ripple from '@/components/canvasui/Ripple';
import Reveal from '@/components/motion/Reveal';
import ProofChain from '@/components/ProofChain';
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

// The four-stage receipt flow shown in the hero. Values are pulled from the
// canonical ALLOCATE receipt (18175981.receipt.json) — the one that was
// actually settled on-chain for 0.1 SOL. The PASS variant
// (18175981.pass.receipt.json) is a separate refusal scenario where the edge
// did NOT meet threshold; it is not the settled receipt.
const RECEIPT_STAGES = [
  { icon: Scale, label: 'Mandate', value: 'v1', detail: 'Versioned policy' },
  { icon: LineChart, label: 'Decision', value: 'ALLOCATE', detail: 'Edge 5.7% · Kelly 2.1%' },
  { icon: Lock, label: 'Sealed', value: 'SHA-256', detail: 'Before outcome' },
  { icon: FileCheck, label: 'Reconciled', value: 'TxLINE', detail: 'Outcome verified' },
];

// Primary-customer doors. The README positions the customer as both the
// operator running capital AND the allocator diligencing them. Order
// matches the README narrative: Mandate → Diligence → Analyst.
const AUDIENCE_DOORS = [
  {
    id: 'operator',
    href: '/agent',
    icon: LineChart,
    eyebrow: 'I run capital',
    title: 'Mandate Control',
    body: 'An autonomous decision engine operating under a versioned policy, sealing each decision into a SHA-256 receipt before the outcome is known. Self-serve: configure your mandate, run a dry-run, get a public Track Record URL.',
    preview: 'Historical replay · dry-run available',
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

// Supporting capabilities — secondary routes that don't belong in the
// primary narrative but should be discoverable from the landing page.
const SUPPORTING_CAPS = [
  { href: '/markets', label: 'Markets', desc: 'Edge discovery across Polymarket & Kalshi' },
  { href: '/canton', label: 'Private Markets', desc: 'Hidden-size settlement on Canton' },
  { href: '/signals', label: 'Signals', desc: 'Verified analyst signal marketplace' },
  { href: '/labs', label: 'Labs', desc: 'Autopilot execution & builder tools' },
];

export default function SearchLanding() {
  const { mode } = useAudience();

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

  // Mode-aware door ordering — the audience's primary door leads.
  const orderedDoors = useMemo(() => {
    const others = AUDIENCE_DOORS.filter((d) => d.id !== mode);
    const lead = AUDIENCE_DOORS.find((d) => d.id === mode);
    return lead ? [lead, ...others] : AUDIENCE_DOORS;
  }, [mode]);

  return (
    <main className="fc-grain relative min-h-screen overflow-x-hidden text-[var(--ink)]">
      <div className="fc-backdrop" aria-hidden>
        <div className="fc-backdrop__grid" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="operator-header sticky top-3 z-50 flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4">
          <HomeLink />
          <div className="hidden sm:block">
            <PageNav />
          </div>
          {/* On the landing page, replace wallet connect with a proof CTA.
              WalletConnect remains on all other routes via AppShell. */}
          <a
            href="#verify-receipt"
            className="fc-action inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            View verified receipt
          </a>
        </header>

        {/* Hero — outcome-led headline + the canonical 4-stage receipt flow.
            The receipt flow is deterministic and always present; it never
            depends on an upstream API being available. */}
        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-14">
          <div className="max-w-xl">
            <p className="fc-kicker">
              Flight recorder for autonomous capital
            </p>

            <h1 className="fc-display mt-4 text-4xl font-extrabold leading-[0.95] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-[3.75rem]">
              Know what your agent knew before it risked capital.
            </h1>

            <p className="mt-5 max-w-md text-lg leading-7 text-[var(--color-ink-muted)] sm:text-xl">
              An auditable record for every autonomous capital decision — what the agent knew, which policy constrained it, what it decided before the outcome, and how that decision performed.
            </p>

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
            </p>
          </div>

          {/* 4-stage receipt flow — the core differentiator above the fold.
              Shows the canonical proof chain: Mandate → Decision → Sealed →
              Reconciled. Always present, always truthful. */}
          <div className="relative">
            <div className="absolute -inset-4 bg-[var(--color-accent)]/5 blur-3xl" aria-hidden />
            <div className="fc-instrument edge-reveal relative overflow-hidden p-1 shadow-2xl shadow-black/50">
              <div className="fc-instrument__inner p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="fc-kicker">
                    Decision receipt · {VERIFIED_RECEIPT.stage}
                  </p>
                  <span className="fc-status fc-status--positive shrink-0 px-2.5 py-1">
                    Verified
                  </span>
                </div>

                <p className="mt-3 font-display text-lg font-semibold text-[var(--color-ink)] sm:text-xl">
                  {VERIFIED_RECEIPT.home} <span className="text-[var(--color-ink-faint)]">v</span> {VERIFIED_RECEIPT.away}
                </p>
                <p className="mt-1 font-mono text-sm text-[var(--color-accent)]">
                  Final {VERIFIED_RECEIPT.score}
                </p>

                {/* 4-stage flow rail */}
                <div className="mt-5 flex items-stretch gap-1 overflow-x-auto pb-1">
                  {RECEIPT_STAGES.map((stage, i) => {
                    const StageIcon = stage.icon;
                    return (
                      <div key={stage.label} className="flex flex-1 items-stretch">
                        <div className="flex flex-1 flex-col items-center gap-1.5 border border-[var(--color-rule)] bg-white/[0.02] p-3 text-center">
                          <StageIcon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.5} />
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
                            {stage.label}
                          </span>
                          <span className="font-display text-sm font-bold text-[var(--color-ink)]">
                            {stage.value}
                          </span>
                          <span className="font-mono text-[8px] leading-tight text-[var(--color-ink-faint)]">
                            {stage.detail}
                          </span>
                        </div>
                        {i < RECEIPT_STAGES.length - 1 && (
                          <div className="flex items-center px-0.5" aria-hidden>
                            <ArrowRight className="h-3 w-3 text-[var(--color-ink-faint)]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--color-rule)] pt-4">
                  <p className="text-xs leading-5 text-[var(--color-ink-faint)]">
                    <TweenNumber
                      value={0.1}
                      duration={800}
                      format={(v) => `${v.toFixed(2)} SOL`}
                      className="font-mono text-[var(--color-ink-muted)]"
                    /> settled trustlessly via <span className="font-mono text-[var(--color-ink-muted)]">match-escrow</span> CPI.
                  </p>
                  <Link
                    href={`/world-cup?fixture=${VERIFIED_RECEIPT.fixtureId}`}
                    className="fc-action px-3 py-2 text-xs"
                  >
                    Open Proof Theatre
                    <ArrowRight className="ml-1 inline h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Primary-customer doors — route by role. No Reveal wrapper to
            reduce scroll-animation saturation; these are above the fold
            on most viewports. */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:mt-2" aria-label="Primary-customer entry points">
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
        </section>

        {/* Verify a real receipt — the single most differentiated artifact.
            A real World Cup fixture with a real Merkle proof anchored on
            Solana devnet, settled on-chain via match-escrow CPI. Deep-links
            into Proof Theatre with the fixture pre-selected. */}
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

        {/* Supporting capabilities — secondary routes grouped compactly.
            The primary narrative (mandate → receipt → proof → reputation)
            is told above; these are tools that support it. */}
        <section className="mt-10 border-t border-[var(--color-rule)] pt-6" aria-label="Supporting capabilities">
          <p className="fc-kicker mb-4">Supporting capabilities</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUPPORTING_CAPS.map((cap) => (
              <Link
                key={cap.href}
                href={cap.href}
                className="group flex flex-col gap-1 border border-[var(--color-rule)] bg-white/[0.02] p-4 transition hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/[0.04]"
              >
                <span className="font-display text-sm font-semibold text-[var(--color-ink)]">
                  {cap.label}
                </span>
                <span className="text-xs leading-5 text-[var(--color-ink-muted)]">
                  {cap.desc}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-accent)]/80">
                  Open
                  <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
