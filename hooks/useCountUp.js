'use client';

import { useEffect, useState } from 'react';
import { useInView } from '@/hooks/useInView';

/**
 * useCountUp — returns [ref, value] where value animates from 0 to the
 * target once the element scrolls into view. Combines IntersectionObserver
 * with a simple rAF tween (reusing the same ease-out cubic as TweenNumber).
 *
 * This is the shared primitive for the common "count up on scroll" pattern
 * across /signals, /markets, /agent, /positions, /notifications, /world-cup,
 * /labs/weather, and /status. It avoids the overhead of mounting a full
 * <TweenNumber> component when you just need a numeric state value.
 *
 * Reduced-motion users get the final value immediately (no tween).
 *
 * @param {number} target - the number to count up to
 * @param {object} [options]
 * @param {number} [options.duration=800] - tween duration in ms
 * @param {number} [options.threshold=0.2] - intersection threshold
 * @returns {[React.RefObject, number]} - [ref, currentValue]
 */
export function useCountUp(target, { duration = 800, threshold = 0.2 } = {}) {
  const [ref, inView] = useInView({ threshold });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;

    const reduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || duration <= 0) {
      setValue(target);
      return undefined;
    }

    let raf;
    const start = performance.now();
    const from = 0;

    const tick = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return [ref, value];
}

export default useCountUp;
