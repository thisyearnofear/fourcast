'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-5">
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
            className="text-sm font-medium px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-sm font-medium px-5 py-3 rounded-xl bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08] transition-colors no-underline"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
