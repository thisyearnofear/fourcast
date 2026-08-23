'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import WaveGrid from '@/components/WaveGrid';
import { useMotionBudget } from '@/hooks/useMotionBudget';

/**
 * LiquidField — the landing's Tier 3 backdrop: a WebGL liquid wave field
 * (custom displacement shader, rebuilt from scratch — the reference demo
 * is CC BY-NC and cannot ship in a commercial product).
 *
 * Capability-gated: mounts the R3F scene only when the client has WebGL,
 * a fine pointer, no reduced-motion preference, and no Save-Data. Every
 * other client gets the 2D WaveGrid, which renders the same visual family
 * (and carries the venue peaks). three.js is dynamically imported, so it
 * never loads for incapable clients.
 *
 * Motion budget: the scene is a WebGL context, so it registers with
 * useMotionBudget at priority 30 — above the hero ParticleReveal (20).
 * Per design.md's one-canvas-effect-per-viewport rule, the particle CTA
 * degrades to its plain (still magnetic, still pressable) fallback while
 * the field is live.
 *
 * Scroll fade: the field dims as you scroll past the hero so it never
 * fights below-fold content.
 */

const LiquidFieldScene = dynamic(() => import('@/components/LiquidFieldScene'), {
  ssr: false,
});

function detectCapability() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
  if (navigator.connection?.saveData) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function LiquidField() {
  const [capable, setCapable] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setCapable(detectCapability());
  }, []);

  // Register with the motion budget only when the scene will actually run,
  // so incapable clients don't steal the canvas slot from ParticleReveal.
  const { allowed } = useMotionBudget(capable ? 'liquid-field' : null, { priority: 30 });
  const useLiquid = capable && allowed;

  // Scroll fade — opacity only, rAF-coalesced, skipped under reduced motion
  // (which never reaches here, but kept defensive).
  useEffect(() => {
    if (!useLiquid) return undefined;
    const node = wrapRef.current;
    if (!node) return undefined;
    let frame = 0;
    let last = Infinity;
    const apply = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight || 1;
      const t = Math.min(1, Math.max(0, window.scrollY / max));
      const o = Math.max(0.25, 1 - t * 0.9);
      if (Math.abs(o - last) < 0.01) return;
      last = o;
      node.style.opacity = o.toFixed(2);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [useLiquid]);

  if (!useLiquid) return <WaveGrid />;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ transition: 'opacity 0.3s linear' }}
    >
      <LiquidFieldScene />
    </div>
  );
}
