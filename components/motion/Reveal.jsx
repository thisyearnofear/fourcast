'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reveal — one-shot scroll-triggered entrance.
 *
 * Content enters with a 260ms fade + 10px rise (--dur-panel / --ease-out)
 * the first time it intersects the viewport, then behaves like a normal
 * element. Interruptible and one-shot: no restart-prone keyframes, no
 * re-hiding on scroll-back. Falls open (visible) when IntersectionObserver
 * is unavailable or the user prefers reduced motion.
 *
 * Props:
 *   as        — element to render (default 'div')
 *   delay     — stagger offset in ms, applied via transition-delay
 *   className — merged onto the element
 */
export default function Reveal({ as = 'div', delay = 0, className, children, ...rest }) {
  const Tag = as;
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const reduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${seen ? 'reveal--in' : ''} ${className ?? ''}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
