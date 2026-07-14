'use client';

import { useEffect, useState } from 'react';

/**
 * Client status for optional Bright Data enrichment.
 * Defaults to unavailable so UI never promises scrape when credits are out.
 */
export function useBrightDataStatus() {
  const [status, setStatus] = useState({
    loading: true,
    available: false,
    configured: false,
    degraded: false,
    forceDisabled: false,
    products: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/brightdata/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const products = data.products || {};
        setStatus({
          loading: false,
          available: !!data.available,
          configured: !!(
            products.configured?.serp ||
            products.configured?.scrapingBrowser ||
            products.configured?.webUnlocker ||
            data.config?.hasApiKey
          ),
          degraded: !!products.degraded,
          forceDisabled: !!products.forceDisabled,
          products,
          lastError: products.lastError || null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus((prev) => ({ ...prev, loading: false, available: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
