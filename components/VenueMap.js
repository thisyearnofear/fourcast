'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInView } from '@/hooks/useInView';

/**
 * VenueMap — interactive surface grid replacing the old doors.
 *
 * Three surfaces (Markets, Positions, Arena) as open sections that tilt
 * toward the cursor on fine pointers and grow an accent rule on hover
 * (clip/scale reveal). Entrance reuses the fc-doors stagger vocabulary
 * (fc-market-slide-in + --door-delay), which already handles reduced motion.
 *
 * design.md: hover movement runs only on fine-pointer devices; cards stay
 * open sections (no nested bordered containers), pressable scale feedback
 * comes from the shared :where(a.fc-door...) active rule.
 */

const SURFACES = [
  { href: '/markets', title: 'Markets', desc: 'Live edge across venues', icon: '◈' },
  { href: '/positions', title: 'Positions', desc: 'Your book, one view', icon: '◇' },
  { href: '/arena', title: 'Arena', desc: 'The agent, live', icon: '◎' },
];

export default function VenueMap() {
  const [ref, inView] = useInView({ threshold: 0.05, rootMargin: '0px' });
  return (
    <section
      ref={ref}
      className={`reveal grid gap-3 sm:grid-cols-3 ${inView ? 'reveal--in' : ''}`}
      aria-label="Execution surfaces"
    >
      {SURFACES.map((s) => (
        <VenueCard key={s.href} surface={s} />
      ))}
    </section>
  );
}

function VenueCard({ surface: s }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const fineRef = useRef(false);

  useEffect(() => {
    fineRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!fineRef.current) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: y * -2, y: x * 2 });
  }, []);

  const handlePointerOut = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }, []);

  return (
    <Link
      ref={cardRef}
      href={s.href}
      className="fc-door group relative flex flex-col gap-1 border border-[var(--color-rule)] bg-white/[0.02] p-4 no-underline transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/[0.04]"
      style={{
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition:
          'transform 0.25s var(--ease-out), border-color 0.2s linear, background 0.2s linear',
        transformStyle: 'preserve-3d',
      }}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onPointerEnter={() => setHovered(true)}
    >
      {/* Accent top bar — slides in on hover */}
      <span
        className="absolute left-0 top-0 h-[2px] w-full origin-left bg-[var(--color-accent)]"
        style={{
          transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 0.3s var(--ease-out)',
        }}
        aria-hidden
      />

      {/* Icon + title */}
      <span
        className="font-display text-base font-semibold text-[var(--color-ink)]"
        style={{ transform: 'translateZ(4px)' }}
      >
        {s.icon} {s.title}
      </span>
      <span className="text-xs text-[var(--color-ink-muted)]">{s.desc}</span>
    </Link>
  );
}
