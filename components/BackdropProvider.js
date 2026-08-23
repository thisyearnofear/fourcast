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
 */

export const BACKDROP_STATES = /** @type {const} */ ({
  idle: 'idle',
  scanning: 'scanning',
  sealed: 'sealed',
  breach: 'breach',
  review: 'review',
  reconciled: 'reconciled',
});

/** Palette for each backdrop state. */
const PALETTES = {
  idle: {
    glow: 'rgba(121, 245, 183, 0.05)',     // subtle green hint
    glow2: 'rgba(245, 197, 107, 0.03)',    // faint amber
    grid: 'rgba(243, 240, 231, 0.035)',    // hairline
    grid2: 'rgba(243, 240, 231, 0.035)',
    breatheMin: 0.25,
    breatheMax: 0.4,
  },
  scanning: {
    glow: 'rgba(121, 245, 183, 0.1)',
    glow2: 'rgba(121, 245, 183, 0.04)',
    grid: 'rgba(243, 240, 231, 0.06)',
    grid2: 'rgba(243, 240, 231, 0.055)',
    breatheMin: 0.35,
    breatheMax: 0.55,
  },
  sealed: {
    glow: 'rgba(245, 197, 107, 0.08)',
    glow2: 'rgba(245, 197, 107, 0.04)',
    grid: 'rgba(245, 197, 107, 0.05)',
    grid2: 'rgba(243, 240, 231, 0.04)',
    breatheMin: 0.3,
    breatheMax: 0.5,
  },
  breach: {
    glow: 'rgba(255, 122, 111, 0.1)',
    glow2: 'rgba(255, 122, 111, 0.05)',
    grid: 'rgba(255, 122, 111, 0.05)',
    grid2: 'rgba(255, 150, 140, 0.03)',
    breatheMin: 0.4,
    breatheMax: 0.7,
  },
  review: {
    glow: 'rgba(196, 181, 253, 0.1)',
    glow2: 'rgba(196, 181, 253, 0.05)',
    grid: 'rgba(196, 181, 253, 0.045)',
    grid2: 'rgba(243, 240, 231, 0.03)',
    breatheMin: 0.3,
    breatheMax: 0.55,
  },
  reconciled: {
    glow: 'rgba(121, 245, 183, 0.14)',
    glow2: 'rgba(121, 245, 183, 0.06)',
    grid: 'rgba(121, 245, 183, 0.07)',
    grid2: 'rgba(243, 240, 231, 0.05)',
    breatheMin: 0.35,
    breatheMax: 0.6,
  },
};

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

  return (
    <BackdropContext.Provider value={{ state, setState: setStateSafe }}>
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