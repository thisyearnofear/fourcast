'use client';

export default function SignalsError({ error, reset }) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4">
 <div className="mc-panel p-8 text-center max-w-md w-full">
 <div className="text-4xl mb-4 opacity-50">📡</div>
 <h2 className="text-xl font-light text-[var(--color-ink)] mb-2">Signals failed to load</h2>
 <p className="text-sm text-[var(--color-ink-faint)] mb-6">{error?.message || 'An unexpected error occurred'}</p>
 <button
 onClick={reset}
 className="px-6 py-2.5 bg-[var(--color-paper-soft)] border border-[var(--color-rule-strong)] text-[var(--color-ink)] text-sm hover:bg-white/20 transition-all"
 >
 Try Again
 </button>
 </div>
 </div>
 );
}
