'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * Backdrop state machine — drives CSS color shifts across the entire app.
 * Each state maps to a distinct palette so the backdrop "breathes" in the
 * right color regardless of which page you're on.
 *
 * States:
 *   idle       — default, no active agent work
 *   scanning   — agent is hunting edge (green accent)
 *   sealed     — receipt written, awaiting outcome (amber)
 *   breach     — policy violation detected (red)
 *   review     — verification under review (violet)
 *   reconciled — outcome settled, matches receipt (strong green)
 *
 * Pulse system:
 *   emitBackdropPulse({ x, y, state? }) creates a one-shot radial ripple
 *   at screen coords. Called from any page — AgentRail, arena feed,
 *   position updates, signal events. CSS does the work on app pages; the
 *   landing's WaveGrid canvas subscribes via onBackdropPulse() and sweeps
 *   the same state-colored wave across its field.
 */

export const BACKDROP_STATES = /** @type {const} */ ({
  idle: 'idle',
  scanning: 'scanning',
  sealed: 'sealed',
  breach: 'breach',
  review: 'review',
  reconciled: 'reconciled',
});

/** mix() keeps every backdrop colour token-sourced — one source in
 *  tokens.css, alpha tuned per state. (Canvas surfaces that cannot resolve
 *  CSS colour functions use BRAND_RGB from constants/brandColors instead.) */
const mix = (token, pct) => `color-mix(in oklab, var(${token}) ${pct}%, transparent)`;

/** Pulse color for each backdrop state. */
const PULSE_COLORS = {
  idle: mix('--color-accent', 15),
  scanning: mix('--color-accent', 18),
  sealed: mix('--color-sealed', 15),
  breach: mix('--color-breach', 22),
  review: mix('--color-review', 18),
  reconciled: mix('--color-accent', 25),
};

/** Palette for each backdrop state. */
const PALETTES = {
  idle: {
    glow: mix('--color-accent', 5),        // subtle green hint
    glow2: mix('--color-sealed', 3),       // faint amber
    grid: mix('--color-ink', 3.5),         // hairline
    grid2: mix('--color-ink', 3.5),
    breatheMin: 0.25,
    breatheMax: 0.4,
  },
  scanning: {
    glow: mix('--color-accent', 10),
    glow2: mix('--color-accent', 4),
    grid: mix('--color-ink', 6),
    grid2: mix('--color-ink', 5.5),
    breatheMin: 0.35,
    breatheMax: 0.55,
  },
  sealed: {
    glow: mix('--color-sealed', 8),
    glow2: mix('--color-sealed', 4),
    grid: mix('--color-sealed', 5),
    grid2: mix('--color-ink', 4),
    breatheMin: 0.3,
    breatheMax: 0.5,
  },
  breach: {
    glow: mix('--color-breach', 10),
    glow2: mix('--color-breach', 5),
    grid: mix('--color-breach', 5),
    grid2: mix('--color-breach', 3),
    breatheMin: 0.4,
    breatheMax: 0.7,
  },
  review: {
    glow: mix('--color-review', 10),
    glow2: mix('--color-review', 5),
    grid: mix('--color-review', 4.5),
    grid2: mix('--color-ink', 3),
    breatheMin: 0.3,
    breatheMax: 0.55,
  },
  reconciled: {
    glow: mix('--color-accent', 14),
    glow2: mix('--color-accent', 6),
    grid: mix('--color-accent', 7),
    grid2: mix('--color-ink', 5),
    breatheMin: 0.35,
    breatheMax: 0.6,
  },
};

// ── Canvas pulse bridge ────────────────────────────────────────────────────
// The landing's WaveGrid canvas subscribes here so the same pulse that
// ripples the CSS grid also sweeps the wave field. Keeps one source of
// truth (emitBackdropPulse) for every surface.
const canvasPulseListeners = new Set();

/**
 * Subscribe to backdrop pulses (used by the WaveGrid canvas).
 * @param {(opts: {x?: number, y?: number, state?: string}) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onBackdropPulse(fn) {
  canvasPulseListeners.add(fn);
  return () => canvasPulseListeners.delete(fn);
}

/**
 * Emit a one-shot radial pulse on the backdrop grid.
 * @param {{ x?: number, y?: number, state?: string }} opts
 *   x/y — screen coords (center of ripple). Defaults to center-screen.
 *   state — backdrop state color to use. Defaults to current.
 */
export function emitBackdropPulse({ x, y, state } = {}) {
  // Notify canvas subscribers (WaveGrid) regardless of DOM availability.
  for (const fn of canvasPulseListeners) {
    try { fn({ x, y, state }); } catch { /* a listener must never break the emitter */ }
  }
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.className = 'fc-backdrop-pulse';
  el.style.setProperty('--pulse-x', x != null ? `${x}px` : '50%');
  el.style.setProperty('--pulse-y', y != null ? `${y}px` : '50%');
  if (state) el.style.setProperty('--pulse-color', PULSE_COLORS[state] ?? PULSE_COLORS.scanning);
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Safety: remove after 1.2s in case animationend doesn't fire (tab hidden etc.)
  setTimeout(() => el.remove(), 1200);
}

// Expose globally for legacy callers (emitWaveGridPulse still works via re-export)
const _emitBackdropPulseGlobal = emitBackdropPulse;
if (typeof window !== 'undefined') {
  window.__emitBackdropPulse = _emitBackdropPulseGlobal;
}

/** @type {React.Context<BackdropCtx | null>} */
const BackdropContext = createContext(null);

export function useBackdrop() {
  const ctx = useContext(BackdropContext);
  if (!ctx) throw new Error('useBackdrop must be used within BackdropProvider');
  return ctx;
}

export function BackdropProvider({ children }) {
  const [state, setState] = useState(BACKDROP_STATES.scanning);
  const [palette, setPalette] = useState(PALETTES[BACKDROP_STATES.scanning]);

  const setStateSafe = useCallback((newState) => {
    setState((prev) => {
      if (prev === newState) return prev;
      setPalette(PALETTES[newState] ?? PALETTES.idle);
      return newState;
    });
  }, []);

  // Push palette to document root so body::before and body gradients use it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--backdrop-glow', palette.glow);
    root.style.setProperty('--backdrop-glow2', palette.glow2);
    root.style.setProperty('--backdrop-grid', palette.grid);
    root.style.setProperty('--backdrop-grid2', palette.grid2);
    root.style.setProperty('--backdrop-breathe-min', String(palette.breatheMin));
    root.style.setProperty('--backdrop-breathe-max', String(palette.breatheMax));
    root.setAttribute('data-backdrop-state', state);
    return () => {
      Object.keys(palette).forEach((k) => {
        root.style.removeProperty(`--backdrop-${k}`);
      });
    };
  }, [state, palette]);

  const emitPulse = useCallback((opts) => {
    emitBackdropPulse({ ...opts, state: opts.state || state });
  }, [state]);

  return (
    <BackdropContext.Provider value={{ state, setState: setStateSafe, emitPulse }}>
      {children}
    </BackdropContext.Provider>
  );
}

/** Convenience hook to reset to idle after a delay. */
export function useBackdropAutoReset(delay = 8000) {
  const { setState } = useBackdrop();
  useEffect(() => {
    const timer = setTimeout(() => setState(BACKDROP_STATES.idle), delay);
    return () => clearTimeout(timer);
  }, [setState, delay]);
}