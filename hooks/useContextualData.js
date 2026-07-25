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
 * - Deduplicates: multiple components with the same title share a single
 *   in-flight request via a module-scoped Map.
 * - Falls back to an empty array if the API is unreachable.
 * - Respects prefers-reduced-motion (single fetch, no polling).
 */

// Module-scoped in-flight request cache so multiple components requesting
// the same title share a single fetch. Cleared once the response arrives.
const inflight = new Map();

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
        // Deduplicate: if another component already has a request in flight
        // for this title, piggyback on it instead of firing a second fetch.
        let promise = inflight.get(title);
        if (!promise) {
          promise = fetch(`/api/contextual?title=${encodeURIComponent(title)}`)
            .then((res) => {
              if (!res.ok) throw new Error(`contextual API ${res.status}`);
              return res.json();
            })
            .then((data) => (data.success ? data.items || [] : []))
            .catch(() => [])
            .finally(() => inflight.delete(title));
          inflight.set(title, promise);
        }

        const result = await promise;
        if (!cancelled) setItems(result);
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
