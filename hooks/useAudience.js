'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Audience mode — who is reading?
 *
 * The product serves three reading intents on the same surfaces:
 *   - analyst  : discovery, edge, probability (default for new visitors)
 *   - operator : mandate, receipt, policy gates (default for /agent)
 *   - allocator: calibration, adherence, reconciliation (default for /positions)
 *
 * The mode reorders / emphasizes sections per surface and is persisted to
 * localStorage. SSR-safe: the hook returns the route-derived default during
 * server render, then hydrates from storage on mount.
 *
 * Heuristic default by route (only used until the user makes a manual choice):
 *   /agent     → operator
 *   /positions → allocator
 *   anything else → analyst
 */

export const AUDIENCE_MODES = ['analyst', 'operator', 'allocator'];

export const AUDIENCE_META = {
  analyst: {
    label: 'Analyst',
    description: 'Lead with evidence & edge',
    homeOrder: ['audience-doors', 'verified-receipt', 'operator-math'],
    agentOrder: ['mandate-control', 'operator-controls', 'historical-lab', 'run-ledger', 'mandate-builder'],
    dossierLead: 'evidence',
  },
  operator: {
    label: 'Operator',
    description: 'Lead with mandate & policy',
    homeOrder: ['audience-doors', 'verified-receipt', 'operator-math'],
    agentOrder: ['mandate-builder', 'mandate-control', 'operator-controls', 'historical-lab', 'run-ledger'],
    dossierLead: 'decision',
  },
  allocator: {
    label: 'Allocator',
    description: 'Lead with calibration & adherence',
    homeOrder: ['audience-doors', 'verified-receipt', 'operator-math'],
    agentOrder: ['run-ledger', 'mandate-control', 'historical-lab', 'operator-controls', 'mandate-builder'],
    dossierLead: 'verification',
  },
};

const STORAGE_KEY = 'fourcast:audience';

function routeDefault(pathname) {
  if (!pathname) return 'analyst';
  if (pathname.startsWith('/positions')) return 'allocator';
  if (pathname.startsWith('/agent')) return 'operator';
  return 'analyst';
}

function isValidMode(value) {
  return AUDIENCE_MODES.includes(value);
}

function readStored() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValidMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStored(mode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage may be disabled; degrade silently */
  }
}

/**
 * Returns [mode, setMode].
 *
 * mode is always one of AUDIENCE_MODES. On the first server render and the
 * first client render it returns the route-derived default. After mount it
 * swaps to the stored value if present. Subsequent setMode() calls write
 * through to localStorage and broadcast a 'fourcast:audience-change' event
 * so other components on the page stay in sync without a global provider.
 */
export function useAudience() {
  const pathname = usePathname();
  const initial = routeDefault(pathname);
  const [mode, setModeState] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored && stored !== mode) {
      setModeState(stored);
    }
    setHydrated(true);

    const onExternalChange = (event) => {
      const next = event?.detail;
      if (isValidMode(next) && next !== mode) {
        setModeState(next);
      }
    };
    window.addEventListener('fourcast:audience-change', onExternalChange);
    return () => window.removeEventListener('fourcast:audience-change', onExternalChange);
  }, []);

  const setMode = useCallback((next) => {
    if (!isValidMode(next)) return;
    setModeState(next);
    writeStored(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fourcast:audience-change', { detail: next }));
    }
  }, []);

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }
    const fresh = routeDefault(pathname);
    setModeState(fresh);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fourcast:audience-change', { detail: fresh }));
    }
  }, [pathname]);

  return { mode, setMode, reset, hydrated };
}
