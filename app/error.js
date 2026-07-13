'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-white flex items-center justify-center px-5">
      <main className="max-w-md w-full text-center">
        <div className="text-5xl mb-6">⚠️</div>
        <h2 className="text-xl font-light text-slate-200 mb-3">
          Something went wrong
        </h2>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="text-sm font-semibold px-5 py-3 rounded-lg border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20 transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-sm font-medium px-5 py-3 rounded-lg bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08] transition-colors no-underline"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
