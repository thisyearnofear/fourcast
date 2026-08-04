'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* --------------------------------------------------------------------------
   SealMoment — the signature viral artifact of Fourcast.

   Stages the moment a decision is sealed into a SHA-256 receipt. This is the
   "tx confirmed" of prediction markets: the hash rolls in like a departure-
   board split-flap, the border flashes sealed-amber, and a single calm
   "click" scale pulse lands. No confetti, no bounce — institutional evidence
   made visceral.

   Three phases, all interruptible and reduced-motion-safe:
     1. ROLL  — each hex character flips from a random glyph to its final
                value, staggered left-to-right (the flap-board effect).
     2. SEAL  — the border flashes sealed-amber (mc-seal-flash) and the
                "SEALED" stamp stamps in.
     3. DONE  — the hash sits, static, with a faint emerald "verified" rail.

   Props:
     hash        — the full SHA-256 hex string (64 chars). If absent, renders
                  a "pending" state.
     sealed      — boolean trigger. When it flips true, the sequence plays
                   once. Re-keying `hash` replays.
     label       — small caption above the hash (default "SHA-256 receipt")
     compact     — render a single-line hash strip instead of the block
   -------------------------------------------------------------------------- */

const FLAP_CHARS = '0123456789abcdef';

function randomHexChar() {
  return FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
}

// Per-character flap state. Each slot cycles random hex chars until it
// "lands" on its final value at its staggered delay.
function useFlapRoll(target, armed, { charDelay = 18, settleMs = 520 } = {}) {
  const [display, setDisplay] = useState('');
  const rafRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!target || !armed) {
      setDisplay(target || '');
      return undefined;
    }
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(target);
      return undefined;
    }

    const chars = target.split('');
    // Each character settles at charDelay * index + settleMs.
    const start = performance.now();
    const totalMs = charDelay * chars.length + settleMs;

    const tick = () => {
      const elapsed = performance.now() - start;
      const next = chars
        .map((final, i) => {
          const settleAt = i * charDelay;
          if (elapsed >= settleAt + settleMs) return final;
          if (elapsed < settleAt) return randomHexChar();
          // Final flutter: slow the random flips as it approaches settle.
          const progress = (elapsed - settleAt) / settleMs;
          // Higher progress → higher chance of showing the real char.
          return Math.random() < progress ? final : randomHexChar();
        })
        .join('');
      setDisplay(next);
      if (elapsed < totalMs) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, armed, charDelay, settleMs]);

  return display;
}

export default function SealMoment({
  hash,
  sealed = false,
  label = 'SHA-256 receipt',
  compact = false,
  className = '',
}) {
  const [armed, setArmed] = useState(false);
  const rootRef = useRef(null);

  // Arm the sequence when the element first scrolls into view (or immediately
  // if reduced motion / no IntersectionObserver). This makes the seal play
  // when the viewer reaches it, not on page load.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setArmed(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Re-arm when a new hash arrives so a fresh receipt re-plays the seal.
  useEffect(() => {
    if (hash) setArmed(false);
    // Re-arm on next frame so the IntersectionObserver re-triggers.
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, [hash]);

  const rolled = useFlapRoll(hash || '', armed && sealed);
  const hasHash = Boolean(hash);
  const showSealed = armed && sealed && hasHash;

  // Truncate for display: compact mode shows first 12 … last 8 so a long
  // Solana tx signature (88 chars) never overflows its container. The flap
  // plays across the full hash internally; only the visible slice is short.
  const visible = useMemo(() => {
    if (!rolled) return '';
    if (compact && rolled.length > 24) return `${rolled.slice(0, 12)}…${rolled.slice(-8)}`;
    return rolled;
  }, [rolled, compact]);

  if (compact) {
    return (
      <span
        ref={rootRef}
        className={`fc-seal-moment fc-seal-moment--compact inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.04em] ${showSealed ? 'is-sealed' : ''} ${className}`}
      >
        <span className="fc-seal-moment__hash text-[var(--color-ink-muted)]">
          {hasHash ? visible : 'pending…'}
        </span>
        {showSealed && (
          <span className="ml-2 inline-flex items-center gap-1 text-[var(--color-sealed)]">
            <span className="fc-seal-moment__dot" aria-hidden />
            sealed
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`fc-seal-moment relative overflow-hidden border p-4 sm:p-5 ${showSealed ? 'is-sealed mc-seal-animate' : 'border-[var(--color-rule)] bg-[var(--color-paper-deep)]'} ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="mc-kicker">{label}</span>
        {showSealed ? (
          <span className="mc-stamp mc-stamp--pass">
            <span className="fc-seal-moment__dot" aria-hidden />
            sealed
          </span>
        ) : hasHash ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
            sealing…
          </span>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
            pending
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[var(--color-ink-faint)] select-none">0x</span>
        <span
          className="fc-seal-moment__hash font-mono text-sm leading-6 break-all text-[var(--color-ink)] sm:text-base"
          aria-label={`receipt hash ${hash || 'pending'}`}
        >
          {hasHash ? visible : '—'.repeat(32)}
        </span>
      </div>

      <p className="mt-3 font-mono text-[9px] leading-4 tracking-[0.04em] text-[var(--color-ink-faint)]">
        {showSealed
          ? 'Fingerprint of evidence, policy, and decision — locked before the outcome was known.'
          : hasHash
            ? 'Computing SHA-256 over the decision payload…'
            : 'Awaiting first sealed decision.'}
      </p>
    </div>
  );
}
