'use client';

import { useEffect, useState } from 'react';

/**
 * useContextualData — fetches free macro/sentiment data points relevant
 * to a given market title. Used by the ContextualDataStrip on the landing
 * page so each cycling market shows real context (spot price, Fear & Greed,
 * TVL, Fed funds rate, etc.) instead of just a title and odds.
 *
 * - Fetches on mount and whenever the title changes.
 * - Debounced: only fires after the title has been stable for 500ms.
 * - Falls back to an empty array if the API is unreachable.
 * - Respects prefers-reduced-motion (single fetch, no polling).
 */
export function useContextualData(title) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!title) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contextual?title=${encodeURIComponent(title)}`);
        if (!res.ok) throw new Error(`contextual API ${res.status}`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setItems(data.items || []);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [title]);

  return { items, loading };
}

export default useContextualData;
