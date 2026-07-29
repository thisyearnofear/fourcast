'use client';

import { useEffect, useState } from 'react';

/**
 * LiveUTCClock — a ticking HH:MM:SSZ readout.
 *
 * Renders a placeholder until mounted so SSR markup never contains
 * wall-clock time (no hydration mismatch). Pauses while the document is
 * hidden. Keeps ticking under reduced motion: the clock is informational
 * content, not decorative displacement.
 */
export function LiveUTCClock({ className = '' }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    let timer = 0;

    const start = () => {
      setNow(new Date());
      timer = window.setInterval(() => setNow(new Date()), 1000);
    };
    const stop = () => window.clearInterval(timer);

    const onVisibility = () => {
      stop();
      if (!document.hidden) start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const text = now ? `${now.toISOString().slice(11, 19)}Z` : '--:--:--Z';
  return (
    <time dateTime={now ? now.toISOString() : undefined} className={className}>
      {text}
    </time>
  );
}

export default LiveUTCClock;
