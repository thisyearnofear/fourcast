'use client';

import { useEffect, useState } from 'react';

/* --------------------------------------------------------------------------
   useMotionBudget — keeps canvas-ui effects from accumulating on a single
   screen. design.md says "continuous animation is reserved for genuinely
   live indicators" and the recommendation doc calls for "one canvas effect
   per viewport".

   Mechanism: module-scoped registry. Each effect opts in by passing a
   stable id and a priority. Effects above the budget (default 1) get
   `allowed: false` and bail out. Highest-priority wins; lower-priority
   peers render `null` until the leader leaves the viewport.

   Use sparingly — wrap the *child* of a canvas-ui component, not the
   canvas-ui component itself, since each effect holds its own WebGL
   context. Example:

     function MyRipple() {
       const { allowed } = useMotionBudget('hero-ripple', 10);
       if (!allowed) return <button>Open proof theatre</button>;
       return (
         <Ripple options={...}>
           <button>Open proof theatre</button>
         </Ripple>
       );
     }
   -------------------------------------------------------------------------- */

const MAX_CONCURRENT_DEFAULT = 1;

let subscribers = new Map(); // id -> Set<fn>
let active = new Map(); // id -> { priority, visible }

function getMax(max) {
  return Math.max(1, max);
}

function recompute(max) {
  const visible = [...active.entries()].filter(([, v]) => v.visible);
  const sorted = visible.sort((a, b) => b[1].priority - a[1].priority);
  const allowed = new Set(sorted.slice(0, getMax(max)).map(([id]) => id));
  for (const [id, fns] of subscribers) {
    const next = allowed.has(id);
    for (const fn of fns) fn(next);
  }
}

export function useMotionBudget(id, options = {}) {
  const { priority = 0, max = MAX_CONCURRENT_DEFAULT, visible = true } = options;
  const [allowed, setAllowed] = useState(active.get(id)?.allowed ?? false);

  useEffect(() => {
    if (typeof id !== 'string' || !id) return undefined;
    active.set(id, { priority, visible, allowed: active.get(id)?.allowed ?? false });
    if (!subscribers.has(id)) subscribers.set(id, new Set());
    subscribers.get(id).add(setAllowed);
    recompute(max);
    return () => {
      active.delete(id);
      if (subscribers.has(id)) {
        subscribers.get(id).delete(setAllowed);
        if (subscribers.get(id).size === 0) subscribers.delete(id);
      }
      recompute(max);
    };
  }, [id, priority, max, visible]);

  return { allowed };
}

/**
 * Convenience helper for canvas-ui surfaces: returns the allowed flag and
 * the "should render fallback" boolean in one tuple.
 */
export function useCanvasEffectAllowed(id, options) {
  return useMotionBudget(id, options).allowed;
}
