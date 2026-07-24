'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Markets page error boundary
 * Catches and displays errors in the markets page hierarchy
 */
export default function MarketsError({ error, reset }) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Markets Unavailable"
      message="We encountered an issue loading the markets. This may be due to network connectivity or a temporary service disruption."
      showRetry={true}
    />
  );
}
