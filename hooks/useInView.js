'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useInView — returns true once an element scrolls into the viewport.
 *
 * One-shot: stays true after the first intersection. Falls open (true)
 * when IntersectionObserver is unavailable or the user prefers reduced
 * motion. Used by useCountUp and anywhere a scroll-triggered entrance
 * is needed without the full <Reveal> component wrapper.
 *
 * @param {object} [options]
 * @param {number} [options.threshold=0.2] - intersection ratio to trigger
 * @param {string} [options.rootMargin='0px 0px -8% 0px']
 * @returns {[React.RefObject, boolean]} - [ref, inView]
 */
export function useInView({ threshold = 0.2, rootMargin = '0px 0px -8% 0px' } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const reduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}

export default useInView;
