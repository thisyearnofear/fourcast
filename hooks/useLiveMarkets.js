'use client';

import { useEffect, useRef, useState } from 'react';
import { signalFor, countEdges } from '@/utils/marketEdge';

/**
 * useLiveMarkets — polls the real /api/markets endpoint on an interval so
 * the landing page surfaces genuinely live Polymarket + Kalshi odds.
 *
 * No fake data. The instrument panel, signal ticker, and operator metrics
 * all reflect real market state. If the API is unreachable the hook falls
 * back to a static "no data" snapshot (never invents activity).
 *
 * - Polls every REFRESH_MS (default 15s).
 * - Pauses when the tab is hidden (visibilitychange).
 * - Respects prefers-reduced-motion (single fetch, no polling).
 * - Deduplicates by marketID so the list does not grow unboundedly.
 */

const REFRESH_MS = 15_000;

function emptySnapshot() {
  return {
    loading: true,
    markets: [],
    signals: [],
    scanCount: 0,
    edgeCount: 0,
    isLive: false,
    error: null,
  };
}

/**
 * useLiveMarkets — returns a snapshot of real market data.
 */
export function useLiveMarkets() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const intervalRef = useRef(0);
  const lastMarketIds = useRef(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const url = `/api/markets/live`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`markets API ${res.status}`);
        const data = await res.json();
        if (cancelled || !data.success) return;

        const markets = data.markets || [];

        // Derive signals from real edge scores.
        const signals = markets
          .map(signalFor)
          .filter(Boolean)
          .slice(0, 4);

        // Track which markets are new since the last poll to flash them.
        const newIds = new Set();
        for (const m of markets) {
          const id = m.marketID || m.id;
          if (id && !lastMarketIds.current.has(id)) newIds.add(id);
        }
        lastMarketIds.current = new Set(markets.map((m) => m.marketID || m.id));

        // Edge count from real edges >= 5%.
        const edgeCount = countEdges(markets);

        setSnapshot({
          loading: false,
          markets,
          signals,
          scanCount: markets.length,
          edgeCount,
          isLive: true,
          error: null,
        });
      } catch (err) {
        if (!cancelled) {
          setSnapshot((prev) => ({
            ...prev,
            loading: false,
            isLive: false,
            error: err.message || 'market data unavailable',
          }));
        }
      }
    };

    load();

    // Respect reduced motion: fetch once, do not poll.
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return undefined;

    intervalRef.current = window.setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);

    const onVisibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalRef.current);
      intervalRef.current = 0;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return snapshot;
}

export default useLiveMarkets;
