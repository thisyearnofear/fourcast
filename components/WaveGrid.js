'use client';

import { useEffect, useRef } from 'react';
import { onBackdropPulse } from '@/components/BackdropProvider';

/**
 * WaveGrid — the landing's living backdrop.
 *
 * A 2D-canvas perspective wave field (3d-wave-grid technique, no WebGL
 * context) that behaves as a genuinely live indicator per design.md:
 *
 *   - breathes slowly at idle,
 *   - ripples toward the pointer (fine-pointer only),
 *   - horizon glow + top vignette give the field light and keep the header
 *     readable, near rows run brighter/teal-shifted for depth fog,
 *   - the horizon drifts down as you scroll (parallax plane, not wallpaper),
 *   - sweeps state-colored radial pulses when agent decisions land, via the
 *     shared BackdropProvider pulse bus — reconciled/scanning emerald,
 *     review violet, breach red, sealed faint amber — so the field is a
 *     seismograph of the agent's judgment, not generic atmosphere,
 *   - four venue peaks stand in the field (presentational landmarks, same
 *     status as the old radar blips); each flashes as a pulse wavefront
 *     sweeps past it.
 *
 * Fallback: the static CSS grid (.fc-backdrop__grid) stays underneath, so
 * reduced-motion users (one static frame here) and no-canvas environments
 * still get depth. Performance: rAF loop, dpr capped at 1.5, pauses on
 * tab blur, resize debounced.
 */

// ── Pulse bridge ───────────────────────────────────────────────────────────
// The WaveGrid subscribes to the shared BackdropProvider pulse bus so the
// same emitBackdropPulse() that ripples the CSS grid also sweeps this wave
// field. One source of truth for every surface.

/** Backdrop state → pulse color (rgb). Mirrors BackdropProvider semantics. */
const STATE_COLORS = {
  idle: [121, 245, 183],
  scanning: [121, 245, 183], // --color-accent
  sealed: [245, 197, 107], // --color-sealed (amber)
  breach: [255, 122, 111], // --color-breach (red)
  review: [196, 181, 253], // --color-review (violet)
  reconciled: [121, 245, 183], // strong green
};
const DEFAULT_COLOR = [121, 245, 183];

// ── Venue peaks ────────────────────────────────────────────────────────────
// Presentational landmarks in field space: nx = horizontal (0..1),
// ny = depth (0 = horizon, 1 = near). Canton stays quiet (amber) as before.
const VENUES = [
  { name: 'Polymarket', nx: 0.22, ny: 0.52 },
  { name: 'Kalshi', nx: 0.7, ny: 0.4 },
  { name: 'Delphi', nx: 0.84, ny: 0.68 },
  { name: 'Canton', nx: 0.38, ny: 0.26, quiet: true },
];
const EMERALD = [121, 245, 183];
const AMBER = [240, 190, 110]; // --color-sealed

export default function WaveGrid() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0;
    let H = 0;
    let raf = 0;
    let running = false;
    let resizeTimer = 0;
    const startTime = performance.now();
    const mouse = { x: -9999, y: -9999 };
    let scrollFade = 0; // 0 at top → 1 deep in the page
    const pulses = []; // { t0, color, faint }

    const ROWS = 18;
    const COLS = 32;
    const VANISH_Y = 0.35; // horizon as fraction of height at scroll top

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

    // The horizon drifts down as you scroll: the field reads as a plane you
    // move over, not wallpaper.
    function horizonY() {
      return (VANISH_Y + scrollFade * 0.1) * H;
    }

    // Screen position of a field coordinate (shared by lines and peaks).
    function fieldXY(nx, ny) {
      const hY = horizonY();
      return {
        x: W * 0.5 + (nx - 0.5) * W * (1.1 + ny * 0.9),
        y: hY + ny * (1 - VANISH_Y) * H,
      };
    }

    // Radial displacement + flash intensity from live pulses at a point.
    // Returns { wave, flash, color } — flash peaks as a wavefront crosses
    // the point; color is the strongest pulse's verdict color.
    function pulseAt(px, py, elapsed) {
      let wave = 0;
      let flash = 0;
      let color = DEFAULT_COLOR;
      const cx = W * 0.5;
      const cy = horizonY() + 0.3 * (1 - VANISH_Y) * H;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const age = (elapsed * 1000 - p.t0) / 1000;
        if (age > 2.4) { pulses.splice(i, 1); continue; }
        const dist = Math.hypot(px - cx, py - cy);
        const front = age * 420;
        const band = Math.exp(-Math.pow((dist - front) / 160, 2));
        const decay = Math.max(0, 1 - age / 2.4);
        const amp = p.faint ? 6 : 14;
        wave += band * decay * amp * Math.sin(dist * 0.02 - age * 6);
        const strength = band * decay;
        if (strength > flash) {
          flash = strength;
          color = p.color;
        }
      }
      return { wave, flash, color };
    }

    // Colored wavefront rings — the visible carrier of verdict color.
    // Drawn as perspective-flattened ellipses expanding from the pulse
    // origin, so an ALLOCATE sweeps emerald across the field, PAPER violet.
    function drawPulseFronts(elapsed) {
      const cx = W * 0.5;
      const cy = horizonY() + 0.3 * (1 - VANISH_Y) * H;
      for (const p of pulses) {
        const age = (elapsed * 1000 - p.t0) / 1000;
        if (age > 2.4) continue;
        const front = age * 420;
        const decay = Math.max(0, 1 - age / 2.4);
        const [r, g, b] = p.color;
        const a = (p.faint ? 0.06 : 0.16) * decay;
        if (a < 0.01) continue;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Flatten vertically: the field is seen at an angle.
        ctx.ellipse(cx, cy, front, front * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Depth fog: near rows brighter and teal-shifted, far rows dim.
    function lineColor(ny, alpha) {
      const r = Math.round(12 + ny * 10);
      const g = Math.round(52 + ny * 40);
      const b = Math.round(38 + ny * 26);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function drawAtmosphere() {
      const hY = horizonY();
      // Horizon glow — the field's light source.
      const glow = ctx.createRadialGradient(W * 0.5, hY, 0, W * 0.5, hY, W * 0.45);
      glow.addColorStop(0, 'rgba(121, 245, 183, 0.05)');
      glow.addColorStop(0.5, 'rgba(121, 245, 183, 0.015)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      // Top vignette — keeps the sticky header readable.
      const vig = ctx.createLinearGradient(0, 0, 0, H * 0.25);
      vig.addColorStop(0, 'rgba(7, 9, 12, 0.4)');
      vig.addColorStop(1, 'rgba(7, 9, 12, 0)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H * 0.25);
    }

    function drawPeaks(elapsed) {
      ctx.textAlign = 'center';
      ctx.font = '500 9px "JetBrains Mono", ui-monospace, monospace';
      for (const v of VENUES) {
        const { x, y } = fieldXY(v.nx, v.ny);
        const { flash, color: pulseColor } = pulseAt(x, y, elapsed);
        const base = v.quiet ? 0.28 : 0.4;
        const glowT = Math.min(1, base + flash);
        // Resting color is the venue's own; a passing wavefront tints the
        // spike with the verdict color that fired it.
        const rest = v.quiet ? AMBER : EMERALD;
        const mix = Math.min(1, flash * 1.4);
        const cr = Math.round(rest[0] + (pulseColor[0] - rest[0]) * mix);
        const cg = Math.round(rest[1] + (pulseColor[1] - rest[1]) * mix);
        const cb = Math.round(rest[2] + (pulseColor[2] - rest[2]) * mix);
        const spikeH = (10 + v.ny * 16) * (1 + flash * 0.8);

        // Spike
        const grad = ctx.createLinearGradient(x, y, x, y - spikeH);
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.05 + glowT * 0.25})`);
        grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, ${0.25 + glowT * 0.6})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - spikeH);
        ctx.stroke();

        // Tip dot
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.35 + glowT * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y - spikeH, 1.5 + flash * 2, 0, Math.PI * 2);
        ctx.fill();

        // Label — brighter on flash, quiet venue stays dimmer.
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.min(0.85, 0.3 + glowT * 0.5)})`;
        ctx.fillText(v.name.toUpperCase(), x, y - spikeH - 6);
      }
    }

    function render() {
      const elapsed = (performance.now() - startTime) / 1000;
      ctx.clearRect(0, 0, W, H);
      const hY = horizonY();

      // Grid fades as you scroll past the hero.
      const alpha = Math.max(0.12, 0.52 - scrollFade * 0.24);

      // Pointer proximity per row (cheap: one distance per row).
      const rowProx = new Array(ROWS + 1);
      for (let r = 0; r <= ROWS; r++) {
        const ny = r / ROWS;
        const screenY = hY + ny * (1 - VANISH_Y) * H;
        rowProx[r] = Math.hypot(mouse.x - W * 0.5, mouse.y - screenY);
      }

      // Horizontal perspective rows.
      ctx.lineWidth = 0.6;
      const segments = 72;
      for (let r = 0; r <= ROWS; r++) {
        const ny = r / ROWS;
        const screenY = hY + ny * (1 - VANISH_Y) * H;
        const dist = rowProx[r];
        const mouseWave = Math.exp(-dist / 520) * 10 * Math.sin(dist * 0.02 - elapsed * 3);
        const rowWave =
          Math.sin(elapsed * 0.4 + ny * 1.5) * 0.18 +
          Math.sin(elapsed * 0.3 + ny * 1.2 + 1.5) * 0.14;

        const lineAlpha = Math.max(0.04, alpha * (0.5 + ny * 0.7) - scrollFade * 0.12);
        ctx.strokeStyle = lineColor(ny, lineAlpha);
        ctx.beginPath();
        for (let s = 0; s <= segments; s++) {
          const nx = s / segments;
          const x = W * 0.5 + (nx - 0.5) * W * 1.2;
          const { wave } = pulseAt(x, screenY, elapsed);
          const y = screenY + rowWave * 20 + mouseWave * 0.3 + wave;
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
        ctx.strokeStyle = lineColor(0.5, lineAlpha);
        ctx.beginPath();
        const topX = W * 0.5 + (nx - 0.5) * W * 1.1;
        const topY = hY - 20;
        const botX = W * 0.5 + (nx - 0.5) * W * 2.0;
        const botY = H + 20;
        const segs = 28;
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const x = topX + (botX - topX) * t;
          const rawY = topY + (botY - topY) * t;
          const ny = (rawY - hY) / ((1 - VANISH_Y) * H);
          const idx = Math.round(Math.max(0, Math.min(ROWS, ny * ROWS)));
          const dist = rowProx[idx] ?? 9999;
          const wave = Math.exp(-dist / 520) * 8 * Math.sin(dist * 0.025 - elapsed * 3);
          const rowDisplace = Math.sin(elapsed * 0.5 + ny * 2) * (1 + ny * 3);
          const { wave: pw } = pulseAt(x, rawY, elapsed);
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
          const { x, y: baseY } = fieldXY(nx, ny);
          const dist = rowProx[r] ?? 9999;
          const mouseWave = Math.exp(-dist / 520) * 12 * Math.sin(dist * 0.02 - elapsed * 3);
          const rowWave = Math.sin(elapsed * 0.4 + ny * 1.5) * 0.18;
          const { wave: pw, flash, color: pulseColor } = pulseAt(x, baseY, elapsed);
          const y = baseY + rowWave * 20 + mouseWave * 0.3 + pw;
          const pulse = (Math.sin(elapsed * 1.2 + r + c * 0.7) + 1) * 0.5;
          const boost = Math.min(1, Math.abs(pw) * 0.06 + flash * 0.5);
          const size = 1 + pulse * 1.5 + boost * 2;
          const nodeAlpha = Math.max(0.04, alpha * 0.6 * pulse + boost * 0.4 - scrollFade * 0.15);
          if (nodeAlpha < 0.03) continue;
          // Nodes take the passing pulse's verdict color while it flashes.
          const mix = Math.min(1, flash * 1.4);
          const nr = Math.round(121 + (pulseColor[0] - 121) * mix);
          const ng = Math.round(245 + (pulseColor[1] - 245) * mix);
          const nb = Math.round(183 + (pulseColor[2] - 183) * mix);
          ctx.fillStyle = `rgba(${nr}, ${ng}, ${nb}, ${nodeAlpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawPulseFronts(elapsed);
      drawAtmosphere();
      drawPeaks(elapsed);

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

    // Subscribe to the shared backdrop pulse bus. Map the backdrop state to
    // a wave color; 'sealed' reads fainter (a receipt is quiet by design).
    const unsubscribe = onBackdropPulse(({ state } = {}) => {
      const color = STATE_COLORS[state] || DEFAULT_COLOR;
      const faint = state === 'sealed';
      pulses.push({ t0: performance.now() - startTime, color, faint });
      if (!running && !reduced) start();
    });

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
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) window.addEventListener('mousemove', onMouseMove, { passive: true });

    if (reduced) {
      render(); // single static frame
    } else {
      start();
    }

    return () => {
      stop();
      unsubscribe();
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
