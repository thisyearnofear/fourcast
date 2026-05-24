'use client';

export default function MarketsError({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-subtle rounded-2xl p-8 text-center max-w-md w-full">
        <div className="text-4xl mb-4 opacity-50">📊</div>
        <h2 className="text-xl font-light text-white mb-2">Markets failed to load</h2>
        <p className="text-sm text-white/50 mb-6">{error?.message || 'An unexpected error occurred'}</p>
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm hover:bg-white/20 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
