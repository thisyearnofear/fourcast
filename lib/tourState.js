'use client';

/**
 * Unified tour state — one storage object for every first-run guide.
 *
 * Replaces the previous three-system setup:
 *   - 'fourcast_first_run_dismissed'      (markets FirstRunBanner)
 *   - 'fourcast_route_guide_<route>'      (RouteGuide per route)
 *   - 'fourcast_route_guide_tour_reset'   (replay signal)
 *
 * Schema: { dismissed: { [route: string]: true } }
 * A guide is shown when its route is not in `dismissed`.
 * "Replay the tour" clears the whole object so every guide re-shows.
 */
const TOUR_KEY = 'fourcast:tour:v1';

const LEGACY_KEYS = {
  global: 'fourcast_first_run_dismissed',
  routePrefix: 'fourcast_route_guide_',
  reset: 'fourcast_route_guide_tour_reset',
};

const KNOWN_ROUTES = ['markets', 'agent', 'world-cup', 'positions'];

function readState() {
  if (typeof window === 'undefined') return { dismissed: {} };
  try {
    const raw = window.localStorage.getItem(TOUR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.dismissed === 'object') {
        return { dismissed: parsed.dismissed || {} };
      }
    }
    return migrateLegacy();
  } catch {
    return { dismissed: {} };
  }
}

function migrateLegacy() {
  const dismissed = {};
  try {
    if (window.localStorage.getItem(LEGACY_KEYS.global) === '1') {
      dismissed.markets = true;
    }
    for (const route of KNOWN_ROUTES) {
      if (window.localStorage.getItem(LEGACY_KEYS.routePrefix + route) === '1') {
        dismissed[route] = true;
      }
    }
    // A pending legacy tour-reset means "re-show everything now".
    if (window.localStorage.getItem(LEGACY_KEYS.reset)) {
      for (const key of Object.keys(dismissed)) delete dismissed[key];
    }
    // Clean the old keys so migration runs once.
    window.localStorage.removeItem(LEGACY_KEYS.global);
    window.localStorage.removeItem(LEGACY_KEYS.reset);
    for (const route of KNOWN_ROUTES) {
      window.localStorage.removeItem(LEGACY_KEYS.routePrefix + route);
    }
    window.localStorage.setItem(TOUR_KEY, JSON.stringify({ dismissed }));
  } catch {
    /* storage unavailable — best effort */
  }
  return { dismissed };
}

function writeState(state) {
  try {
    window.localStorage.setItem(TOUR_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function isGuideDismissed(route) {
  if (typeof window === 'undefined') return true;
  return Boolean(readState().dismissed[route]);
}

export function dismissGuide(route) {
  const state = readState();
  state.dismissed[route] = true;
  writeState(state);
}

/**
 * Re-show every guide on its next visit. Called by PageNav's
 * "Replay the tour" entry.
 */
export function resetTour() {
  writeState({ dismissed: {} });
}
