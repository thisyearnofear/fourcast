'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PortfolioCard({ isNight = false }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    fetch('/api/agent/track-record')
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        if (data.success && data.stats) {
          setStats(data.stats);
        } else {
          setStats(null);
        }
      })
      .catch(() => { if (mounted) setStats(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Show placeholder when no data available
  if (!loading && !stats) {
    return (
      <div className={`rounded-2xl border p-4 text-center mb-4 bg-white/5 border-white/10`}>
        <p className={`text-sm text-white/40`}>No portfolio data yet</p>
        <p className={`text-xs mt-1 text-white/25`}>
          Connect wallet and publish signals to build your portfolio
        </p>
      </div>
    );
  }

  const textColor = 'text-white';
  const mutedColor = 'text-white/50';
  const cardBg = 'bg-white/5 border-white/10';
  const glassClass = 'glass-subtle';

  // Loading skeleton
  if (loading) {
    return (
      <div className={`rounded-2xl border ${cardBg} p-4 mb-4 animate-pulse`}>
        <div className="flex items-center gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-10 w-20 rounded-lg bg-white/10`} />
          ))}
        </div>
      </div>
    );
  }

  const totalForecasts = stats?.totalForecasts || stats?.totalPredictions || 0;
  const winRate = stats?.winRate || 0;
  const winRateDisplay = typeof winRate === 'number'
    ? `${(winRate * 100).toFixed(0)}%`
    : '—';

  return (
    <div className={`rounded-2xl border ${cardBg} ${glassClass} p-4 mb-4 transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Signals */}
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <div>
              <div className={`text-xs ${mutedColor}`}>Signals</div>
              <div className={`text-lg font-semibold ${textColor}`}>{totalForecasts}</div>
            </div>
          </div>

          {/* Win Rate */}
          {winRate > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <div className={`text-xs ${mutedColor}`}>Win Rate</div>
                <div className={`text-lg font-semibold ${textColor}`}>{winRateDisplay}</div>
              </div>
            </div>
          )}

          {/* Brier Score */}
          {stats?.brierScore !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <div>
                <div className={`text-xs ${mutedColor}`}>Brier</div>
                <div className={`text-lg font-semibold ${textColor}`}>{stats.brierScore.toFixed(3)}</div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/signals')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all whitespace-nowrap
            bg-white/10 hover:bg-white/20 text-white/70 hover:text-white`}
        >
          Full stats →
        </button>
      </div>
    </div>
  );
}
