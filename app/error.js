'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
 useEffect(() => {
 console.error(error);
 }, [error]);

 return (
 <div className="min-h-screen bg-[var(--app-bg)] text-[var(--color-ink)] flex items-center justify-center px-5">
 <main className="max-w-md w-full text-center">
 <div className="text-5xl mb-6">⚠️</div>
 <h2 className="text-xl font-light text-[var(--color-ink)] mb-3">
 Something went wrong
 </h2>
 <p className="text-sm text-[var(--color-ink-faint)] mb-8 leading-relaxed">
 {error?.message || 'An unexpected error occurred. Please try again.'}
 </p>
 <div className="flex flex-col sm:flex-row gap-3 justify-center">
 <button
 onClick={() => reset()}
 className="text-sm font-semibold px-5 py-3 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition"
 >
 Try again
 </button>
 <Link
 href="/"
 className="text-sm font-medium px-5 py-3 bg-white/[0.04] text-[var(--color-ink-muted)] border border-[var(--color-rule)] hover:bg-white/[0.08] transition-colors no-underline"
 >
 Go home
 </Link>
 </div>
 </main>
 </div>
 );
}
