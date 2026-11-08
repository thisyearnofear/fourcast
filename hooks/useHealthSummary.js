'use client';

import { useEffect, useState } from 'react';
import { HEALTH_POLL_MS } from '@/utils/healthBadge';

/**
 * useHealthSummary — polls /api/meta/health on the shared cadence and
 * returns the aggregate summary ('all_healthy' | 'degraded' | 'loading')
 * plus when it last refreshed. Single source for StatusBadge and
 * SystemHealthMenu so the two can never disagree.
 */
export default function useHealthSummary() {
  const [summary, setSummary] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch('/api/meta/health');
        const data = await res.json();
        if (cancelled) return;
        if (data?.success && (data.summary === 'all_healthy' || data.summary === 'degraded')) {
          setSummary(data.summary);
          setLastUpdated(new Date());
        }
      } catch {
        // Silent — leave the last-known state. /status has the full panel
        // for users who want to drill in.
      }
    };

    fetchOnce();
    const id = setInterval(fetchOnce, HEALTH_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { summary, lastUpdated };
}
