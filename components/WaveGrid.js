'use client';

import { useEffect, useRef } from 'react';

/**
 * WaveGrid — lightweight Canvas 2D wave-grid backdrop.
 *
 * Inspired by franky-adl/3d-wave-grid, projected to 2D so it costs no WebGL
 * context and coexists with the page's single canvas-ui budget. Renders a
 * full-viewport perspective grid mesh with sinusoidal displacement that:
 *   - breathes slowly at idle,
 *   - ripples toward the pointer (fine-pointer only),
 *   - emits a radial pulse when a live agent cycle lands (see
 *     emitWaveGridPulse), so the backdrop reads as a *live indicator*,
 *     not static atmosphere (design.md: continuous motion is reserved
 *     for genuinely live signals).
 *
 * Fallback: the static CSS grid (.fc-backdrop__grid) stays underneath, so
 * reduced-motion users and no-canvas environments still get depth.
 *
 * Performance: rAF loop, dpr capped at 1.5, pauses on tab blur, resize is
 * debounced (never per-frame). Zero dependencies.
 */

// ── Cycle-pulse bus ────────────────────────────────────────────────────────
// Module-scoped so AgentRail can fire a pulse without prop drilling. The
// grid subscribes on mount; multiple pulses stack and decay independently.
const pulseListeners = new Set();

/** Fire a radial wave across the grid. Call when a new arena cycle lands. */
export function emitWaveGridPulse() {
  for (const fn of pulseListeners) fn();
}

export default function WaveGrid() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // Reduced motion: draw one static frame, no loop, no pulses.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0;
    let H = 0;
    let raf = 0;
    let running = false;
    let resizeTimer = 0;
    const startTime = performance.now();
    const mouse = { x: -9999, y: -9999 };
    let scrollFade = 0; // 0 at top → 1 deep in the page
    const pulses = []; // { t0 } radial waves from live cycles

    const ROWS = 18;
    const COLS = 32;
    const VANISH_Y = 0.35; // horizon as fraction of height

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight || 1;
      scrollFade = Math.min(1, Math.max(0, window.scrollY / max));
    }

    // Radial displacement contributed by live cycle pulses at a screen point.
    function pulseWave(px, py, elapsed) {
      let w = 0;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const age = (elapsed * 1000 - pulses[i].t0) / 1000; // seconds
        if (age > 2.4) { pulses.splice(i, 1); continue; }
        const cx = W * 0.5;
        const cy = H * (VANISH_Y + 0.3);
        const dist = Math.hypot(px - cx, py - cy);
        const front = age * 420; // wavefront radius expands over time
        const band = Math.exp(-Math.pow((dist - front) / 160, 2));
        const decay = Math.max(0, 1 - age / 2.4);
        w += band * decay * 14 * Math.sin(dist * 0.02 - age * 6);
      }
      return w;
    }

    function render() {
      const elapsed = (performance.now() - startTime) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Grid fades as you scroll past the hero.
      const alpha = Math.max(0.12, 0.52 - scrollFade * 0.24);

      // Pointer proximity per row (cheap: one distance per row).
      const rowProx = new Array(ROWS + 1);
      for (let r = 0; r <= ROWS; r++) {
        const ny = r / ROWS;
        const screenY = VANISH_Y * H + ny * (1 - VANISH_Y) * H;
        const dy = mouse.y - screenY;
        const dx = mouse.x - W * 0.5;
        rowProx[r] = Math.hypot(dx, dy);
      }

      // Horizontal perspective rows.
      ctx.lineWidth = 0.6;
      const segments = 72;
      for (let r = 0; r <= ROWS; r++) {
        const ny = r / ROWS;
        const screenY = VANISH_Y * H + ny * (1 - VANISH_Y) * H;
        const dist = rowProx[r];
        const mouseWave = Math.exp(-dist / 520) * 10 * Math.sin(dist * 0.02 - elapsed * 3);
        const rowWave =
          Math.sin(elapsed * 0.4 + ny * 1.5) * 0.18 +
          Math.sin(elapsed * 0.3 + ny * 1.2 + 1.5) * 0.14;

        const lineAlpha = Math.max(0.04, alpha * (0.5 + ny * 0.7) - scrollFade * 0.12);
        ctx.strokeStyle = `rgba(16, 74, 52, ${lineAlpha})`;
        ctx.beginPath();
        for (let s = 0; s <= segments; s++) {
          const nx = s / segments;
          const x = W * 0.5 + (nx - 0.5) * W * 1.2;
          const pw = pulseWave(x, screenY, elapsed);
          const y = screenY + rowWave * 20 + mouseWave * 0.3 + pw;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Vertical lines converging toward the horizon.
      for (let c = 0; c <= COLS; c++) {
        const nx = c / COLS;
        const lineAlpha = Math.max(
          0.04,
          alpha * (0.6 + (1 - Math.abs(nx - 0.5) * 2) * 0.3) - scrollFade * 0.12,
        );
        ctx.strokeStyle = `rgba(14, 62, 44, ${lineAlpha})`;
        ctx.beginPath();
        const topX = W * 0.5 + (nx - 0.5) * W * 1.1;
        const topY = VANISH_Y * H - 20;
        const botX = W * 0.5 + (nx - 0.5) * W * 2.0;
        const botY = H + 20;
        const segs = 28;
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const x = topX + (botX - topX) * t;
          const rawY = topY + (botY - topY) * t;
          const ny = (rawY - VANISH_Y * H) / ((1 - VANISH_Y) * H);
          const idx = Math.round(Math.max(0, Math.min(ROWS, ny * ROWS)));
          const dist = rowProx[idx] ?? 9999;
          const wave = Math.exp(-dist / 520) * 8 * Math.sin(dist * 0.025 - elapsed * 3);
          const rowDisplace = Math.sin(elapsed * 0.5 + ny * 2) * (1 + ny * 3);
          const pw = pulseWave(x, rawY, elapsed);
          const y = rawY + wave + rowDisplace + pw;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Intersection nodes — subtle accent dots that pulse with the wave.
      for (let r = 2; r < ROWS; r += 3) {
        for (let c = 2; c < COLS; c += 3) {
          const ny = r / ROWS;
          const nx = c / COLS;
          const screenY = VANISH_Y * H + ny * (1 - VANISH_Y) * H;
          const x = W * 0.5 + (nx - 0.5) * W * (1.1 + ny * 0.9);
          const dist = rowProx[r] ?? 9999;
          const mouseWave = Math.exp(-dist / 520) * 12 * Math.sin(dist * 0.02 - elapsed * 3);
          const rowWave = Math.sin(elapsed * 0.4 + ny * 1.5) * 0.18;
          const pw = pulseWave(x, screenY, elapsed);
          const y = screenY + rowWave * 20 + mouseWave * 0.3 + pw;
          const pulse = (Math.sin(elapsed * 1.2 + r + c * 0.7) + 1) * 0.5;
          const boost = Math.min(1, Math.abs(pw) * 0.06);
          const size = 1 + pulse * 1.5 + boost * 2;
          const nodeAlpha = Math.max(0.04, alpha * 0.6 * pulse + boost * 0.4 - scrollFade * 0.15);
          if (nodeAlpha < 0.03) continue;
          ctx.fillStyle = `rgba(121, 245, 183, ${nodeAlpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (running) raf = requestAnimationFrame(render);
    }

    function start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(render);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    // Live cycle pulse subscription.
    const onPulse = () => {
      pulses.push({ t0: performance.now() - startTime });
      if (!running && !reduced) start();
    };
    pulseListeners.add(onPulse);

    const onMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!reduced) start();
    };

    resize();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    // Fine-pointer only for the pointer ripple.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) window.addEventListener('mousemove', onMouseMove, { passive: true });

    if (reduced) {
      render(); // single static frame
    } else {
      start();
    }

    return () => {
      stop();
      pulseListeners.delete(onPulse);
      clearTimeout(resizeTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (fine) window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
