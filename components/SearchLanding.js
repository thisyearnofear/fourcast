'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Fingerprint, ShieldCheck, LineChart, Compass, Lock, FileCheck, Scale } from 'lucide-react';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import { useAudience } from '@/hooks/useAudience';
import { useInView } from '@/hooks/useInView';
import { usePointerGlow } from '@/hooks/usePointerGlow';
import { useParallax } from '@/hooks/useParallax';
import Ripple from '@/components/canvasui/Ripple';
import Reveal from '@/components/motion/Reveal';
import ProofChain from '@/components/ProofChain';
import TweenNumber from '@/components/motion/TweenNumber';
import LiveUTCClock from '@/components/motion/LiveUTCClock';
import TrustStatsStrip from '@/components/TrustStatsStrip';

// The canonical real receipt — France 3-0 Sweden, World Cup Round of 32.
// The ALLOCATE receipt itself was a dry-run (execution.dryRun: true); a
// separate 0.1 SOL escrow policy on the same fixture settled on-chain via
// the match-escrow program CPI-calling txoracle::validate_stat (see
// TXLINE_SUBMISSION.md). Deep-linking /world-cup?fixture=<id> opens the
// Proof Theatre on it.
const VERIFIED_RECEIPT = {
  fixtureId: '18175981',
  home: 'France',
  away: 'Sweden',
  score: '3–0',
  stage: 'World Cup · Round of 32',
  escrowProgramId: 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ',
  settlementTx: '3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB',
};

// The four-stage receipt flow shown in the hero. Values are pulled from the
// canonical ALLOCATE receipt (18175981.receipt.json) — a dry-run decision;
// the on-chain 0.1 SOL settlement was a separate escrow policy on the same
// fixture. The PASS variant (18175981.pass.receipt.json) is a separate
// refusal scenario where the edge did NOT meet threshold.
const RECEIPT_STAGES = [
  { icon: Scale, label: 'Mandate', value: 'v1', detail: 'Versioned policy', gloss: 'Mandate: the written policy the agent runs under — minimum edge, max position size, loss limits. Versioned and public.' },
  { icon: LineChart, label: 'Decision', value: 'ALLOCATE', detail: 'Edge 5.7% · Kelly 2.1%', gloss: 'Decision: the agent\'s call. Edge is the gap between fair odds and market price; Kelly sizing decides how much to stake.' },
  { icon: Lock, label: 'Sealed', value: 'SHA-256', detail: 'Before outcome', gloss: 'Sealed: evidence, odds, and the risk decision are SHA-256 fingerprinted before the outcome is known — history can\'t be rewritten.' },
  { icon: FileCheck, label: 'Reconciled', value: 'TxLINE', detail: 'Outcome verified', gloss: 'Reconciled: TxLINE checks the real-world outcome against the sealed decision and grades it.' },
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

// A primary-customer door with cursor-following glow and subtle tilt on
// fine pointers. Extracted so each card can own its usePointerGlow ref.
function DoorCard({ door, isLead, spanClass, delay }) {
  const glowRef = usePointerGlow({ tilt: 2 });
  const Icon = door.icon;
  return (
    <Link
      ref={glowRef}
      href={door.href}
      style={{ '--door-delay': `${delay}ms` }}
      className={`fc-door fc-glow fc-tilt group relative flex flex-col gap-2 overflow-hidden border p-5 transition sm:p-6 ${
        isLead
          ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-quiet)] hover:border-[var(--color-accent)]/70 hover:bg-[var(--color-accent-atmosphere)]'
          : 'border-[var(--color-rule)] bg-white/[0.02] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/[0.04]'
      } ${spanClass}`}
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
}

export default function SearchLanding() {
  const { mode } = useAudience();

  // Hero print sequence — once the card has printed its fields (~950ms),
  // the seal flashes and the SOL value counts up. Reduced motion lands
  // everything immediately.
  const [heroPrinted, setHeroPrinted] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHeroPrinted(true);
      return undefined;
    }
    const t = window.setTimeout(() => setHeroPrinted(true), 950);
    return () => window.clearTimeout(t);
  }, []);

  // Door-card stagger — one-shot reveal when the section first intersects.
  const [doorsRef, doorsIn] = useInView({ threshold: 0.05, rootMargin: '0px' });

  // Ambient interactivity — cursor glow on the hero receipt instrument and
  // a subtle scroll parallax on the backdrop grid. Both bail on reduced motion.
  const heroGlowRef = usePointerGlow();
  const gridRef = useParallax();

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
        <div ref={gridRef} className="fc-backdrop__grid" />
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
            <p className="fc-kicker fc-print">
              Flight recorder for autonomous capital
            </p>

            <h1 className="fc-display fc-print mt-4 text-4xl font-extrabold leading-[0.95] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-[3.75rem]" style={{ '--print-delay': '70ms' }}>
              Know what your agent knew before it risked capital.
            </h1>

            <p className="fc-print mt-5 max-w-md text-lg leading-7 text-[var(--color-ink-muted)] sm:text-xl" style={{ '--print-delay': '140ms' }}>
              An auditable record for every autonomous capital decision — what the agent knew, which policy constrained it, what it decided before the outcome, and how that decision performed.
            </p>

            <div className="fc-print mt-8 flex flex-wrap gap-3" style={{ '--print-delay': '210ms' }}>
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
                Audit a settled proof
              </a>
            </div>

            <p className="fc-print mt-6 text-sm text-[var(--color-ink-faint)]" style={{ '--print-delay': '280ms' }}>
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
            <div ref={heroGlowRef} className={`fc-instrument fc-glow edge-reveal relative overflow-hidden p-1 shadow-2xl shadow-black/50 ${heroPrinted ? 'mc-seal-animate' : ''}`}>
              <div className="fc-instrument__inner p-5 sm:p-6">
                <div className="fc-print flex items-center justify-between gap-3" style={{ '--print-delay': '200ms' }}>
                  <p className="fc-kicker">
                    Decision receipt · {VERIFIED_RECEIPT.stage}
                  </p>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
                      <span className="fc-rec-lamp" aria-hidden />
                      Rec <LiveUTCClock />
                    </span>
                    <span className="fc-status fc-status--positive inline-flex items-center gap-1.5 px-2.5 py-1">
                      <span className="mc-lamp mc-lamp--live !h-1.5 !w-1.5" aria-hidden />
                      Verified
                    </span>
                  </span>
                </div>

                <p className="fc-print mt-3 font-display text-lg font-semibold text-[var(--color-ink)] sm:text-xl" style={{ '--print-delay': '280ms' }}>
                  {VERIFIED_RECEIPT.home} <span className="text-[var(--color-ink-faint)]">v</span> {VERIFIED_RECEIPT.away}
                </p>
                <p className="fc-print mt-1 font-mono text-sm text-[var(--color-accent)]" style={{ '--print-delay': '340ms' }}>
                  Final {VERIFIED_RECEIPT.score}
                </p>

                {/* 4-stage flow rail */}
                <div className="mt-5 flex items-stretch gap-1 overflow-x-auto pb-1">
                  {RECEIPT_STAGES.map((stage, i) => {
                    const StageIcon = stage.icon;
                    return (
                      <div key={stage.label} className="fc-print flex flex-1 items-stretch" style={{ '--print-delay': `${420 + i * 90}ms` }}>
                        <div title={stage.gloss} className="flex min-w-[80px] flex-1 flex-col items-center gap-1.5 border border-[var(--color-rule)] bg-white/[0.02] p-3 text-center">
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

                <p className="fc-print mt-2 font-mono text-[9px] leading-4 tracking-[0.04em] text-[var(--color-ink-faint)]" style={{ '--print-delay': '780ms' }}>
                  Mandate = the rules · Kelly = how much to stake · SHA-256 = tamper-proof fingerprint · TxLINE = outcome check
                </p>

                <div className="fc-print mt-5 flex items-center justify-between gap-3 border-t border-[var(--color-rule)] pt-4" style={{ '--print-delay': '800ms' }}>
                  <p className="text-xs leading-5 text-[var(--color-ink-faint)]">
                    A <TweenNumber
                      value={heroPrinted ? 0.1 : 0}
                      duration={800}
                      format={(v) => `${v.toFixed(2)} SOL`}
                      className="font-mono text-[var(--color-ink-muted)]"
                    /> escrow policy on this fixture settled trustlessly via <span className="font-mono text-[var(--color-ink-muted)]">match-escrow</span> CPI.{' '}
                    <a
                      href={`https://explorer.solana.com/tx/${VERIFIED_RECEIPT.settlementTx}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-2 transition hover:text-[var(--color-ink)]"
                    >
                      view tx ↗
                    </a>
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
            <p className="fc-print mt-3 text-center text-xs leading-5 text-[var(--color-ink-faint)]" style={{ '--print-delay': '880ms' }}>
              Plain English: the AI&rsquo;s rules, its bet, and its reasoning are fingerprinted and locked before the game is played — so the record can&rsquo;t be rewritten after the fact.
            </p>
          </div>
        </section>

        {/* Primary-customer doors — route by role. One-shot slide-in stagger
            (≤300ms total) when the section first intersects; no persistent
            scroll animation. */}
        <section
          ref={doorsRef}
          className={`fc-doors mt-4 grid gap-3 sm:grid-cols-2 lg:mt-2 ${doorsIn ? 'fc-doors--in' : ''}`}
          aria-label="Primary-customer entry points"
        >
          {orderedDoors.map((door, doorIndex) => (
            <DoorCard
              key={door.href}
              door={door}
              isLead={door.id === mode}
              spanClass={orderedDoors.length === 3 && door.id === 'analyst' ? 'sm:col-span-2 lg:col-span-1' : ''}
              delay={doorIndex * 80}
            />
          ))}
        </section>

        {/* Aggregate proof-of-use numbers. Renders nothing on API failure or
            all-zero data — never fabricates a trust signal. */}
        <TrustStatsStrip />

        {/* Verify a real proof — the single most differentiated artifact.
            A real World Cup fixture with a real Merkle proof anchored on
            Solana devnet; a 0.1 SOL escrow policy on it settled on-chain
            via match-escrow CPI. Deep-links into Proof Theatre with the
            fixture pre-selected. */}
        <div ref={receiptRef} id="verify-receipt" className="scroll-mt-24">
        <Reveal as="section" className="mt-12" aria-label="Verify a real decision on Solana">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
            <div>
              <p className="fc-kicker">Verify a real decision on Solana</p>
              <h2 className="mt-2 max-w-xl font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--color-ink)] sm:text-3xl">
                A proof already settled on-chain. Audit it yourself.
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
                  A <TweenNumber
                    value={receiptSealed ? 0.1 : 0}
                    duration={800}
                    format={(v) => `${v.toFixed(2)} SOL`}
                    className="font-mono text-[var(--color-ink-muted)]"
                  /> escrow policy on this fixture settled trustlessly via <span className="font-mono text-[var(--color-ink-muted)]">match-escrow</span> CPI → <span className="font-mono text-[var(--color-ink-muted)]">txoracle::validate_stat</span>. No intermediary.
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
                <a
                  href={`https://explorer.solana.com/tx/${VERIFIED_RECEIPT.settlementTx}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="mc-nav-link no-underline inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs"
                >
                  <FileCheck className="h-3 w-3" />
                  Settlement tx on devnet
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
