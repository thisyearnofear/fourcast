'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <p>{error.message || 'An unexpected error occurred'}</p>
      <button 
        onClick={() => reset()}
        className="retry-button"
      >
        Try again
      </button>
    </div>
  );
}