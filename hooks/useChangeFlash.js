'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useChangeFlash — transient highlight for live data.
 *
 * Returns `flashing: true` for ~900ms whenever `value` changes to a new
 * (non-initial) value, matching the `.fc-tick` wash in index.css. Rows and
 * cells spread `flashing ? 'fc-tick' : ''` onto their className so a price
 * or edge update visibly lands instead of snapping.
 *
 * Skips the initial render (mount is not a "change") and cleans up the
 * timer on unmount. Safe under SSR (effects only run client-side).
 */
export default function useChangeFlash(value, duration = 900) {
  const prev = useRef(value);
  const first = useRef(true);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    if (prev.current === value) return undefined;
    prev.current = value;
    setFlashing(true);
    const id = setTimeout(() => setFlashing(false), duration);
    return () => clearTimeout(id);
  }, [value, duration]);

  return flashing;
}
