'use client';

import { useEffect } from 'react';

// Global error page that catches errors not caught by nested error boundaries
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="global-error">
          <h2>Something went wrong!</h2>
          <p>We encountered an unexpected error.</p>
          <button 
            onClick={() => reset()}
            className="retry-button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}