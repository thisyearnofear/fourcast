'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import InfoTip from './InfoTip';

/**
 * Personal Stats Dashboard
 */
export function PersonalStatsDashboard({ userAddress, isNight = true, compact = false }) {
  const { address: connectedAddress } = useAccount();
  const displayAddress = userAddress || connectedAddress;

  const [positions, setPositions] = useState([]);
  const [stats, setStats] = useState(null);
  const [trustMetrics, setTrustMetrics] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!displayAddress) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [statsRes, posRes, trustRes] = await Promise.all([
          fetch(`/api/stats?address=${displayAddress}&includeRanking=true`),
          fetch(`/api/positions?address=${displayAddress}&range=${timeRange}`),
          fetch(`/api/agent/backtest?days=${timeRange.replace('d', '')}`)
        ]);
        
        const statsData = await statsRes.json();
        const posData = await posRes.json();
        const trustData = await trustRes.json();

        if (statsData.success) setStats(statsData.stats);
        if (posData.success) setPositions(posData.positions);
        if (trustData.success) setTrustMetrics(trustData.metrics);
      } catch (err) {
        setError('Unable to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [displayAddress, timeRange]);

  if (loading) {
    return <StatsSkeleton isNight={isNight} compact={compact} />;
  }

  if (error || !stats) {
    return null;
  }

  const textColor = 'text-white';
  const tier = stats.tier || { name: 'Predictor', emoji: '📊', color: 'gray' };

  if (compact) {
    return (
      <div className={`glass-subtle rounded-lg p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={`text-xs ${textColor} opacity-60`}>Accuracy</p>
            <p className={`text-2xl font-light ${textColor}`}>
              {stats.accuracyPercent}%
            </p>
          </div>
          <div className="text-center">
            <p className={`text-xs ${textColor} opacity-60`}>Predictions</p>
            <p className={`text-2xl font-light ${textColor}`}>
              {stats.totalPredictions}
            </p>
          </div>
          <div>
            <p className={`text-xs ${textColor} opacity-60`}>Tier</p>
            <p className={`text-lg ${textColor}`}>{tier.emoji}</p>
          </div>
        </div>
        {stats.streak > 0 && (
          <div className={`bg-green-500/20 rounded px-2 py-1 text-center`}>
            <p className={`text-xs ${textColor} opacity-70`}>
              🔥 {stats.streak}-day winning streak
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`glass-subtle rounded-2xl p-6 space-y-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs ${textColor} opacity-60 uppercase tracking-wider`}>Your Tier</p>
          <p className={`text-3xl font-light ${textColor} flex items-center gap-3 mt-1`}>
            {tier.emoji} {tier.name}
          </p>
        </div>
        {stats.rank && (
          <div className="text-right">
            <p className={`text-xs ${textColor} opacity-60 uppercase tracking-wider`}>Leaderboard Rank</p>
            <p className={`text-3xl font-light ${textColor} mt-1`}>#{stats.rank}</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Win Rate" value={`${stats.winRate}%`} subtext={`${stats.wins} wins, ${stats.losses} losses`} isNight={isNight} />
        <StatCard label="Total Predictions" value={stats.totalPredictions} subtext={`${stats.totalResolved} resolved`} isNight={isNight} />
        <StatCard label="Calibration" value={`${Math.round(stats.calibrationScore)}%`} subtext={stats.calibrationScore > 50 ? '✓ Well calibrated' : '⚠ Review confidence'} isNight={isNight} />
        <StatCard label="Best Streak" value={stats.longestWinStreak} subtext="consecutive wins" isNight={isNight} />
      </div>
      <div className="space-y-4 mt-6">
        <div className="flex justify-between items-center">
          <h4 className={`text-sm font-medium ${textColor} uppercase tracking-wider opacity-70`}>Performance Chart</h4>
          <div className="flex gap-1">
            {['7d', '30d', '90d', 'all'].map(range => (
              <button 
                key={range}
                onClick={() => setTimeRange(range)}
                className={`text-[10px] px-2 py-1 rounded ${timeRange === range ? ('bg-blue-500/30 text-blue-200') : 'opacity-50'}`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={positions}>
              <CartesianGrid strokeDasharray="3 3" stroke='#ffffff10' />
              <XAxis dataKey="created_at" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: 'transparent' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line 
                type="monotone" 
                dataKey="realized_pnl" 
                stroke={positions.length > 0 && positions[positions.length - 1].realized_pnl >= 0 ? '#22c55e' : '#ef4444'} 
                strokeWidth={2} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <h4 className={`text-sm font-medium ${textColor} uppercase tracking-wider opacity-70`}>Recent Positions</h4>
        {positions.length > 0 ? (
          <div className="space-y-2">
            {positions.map(pos => (
              <div key={pos.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <p className={`text-sm ${textColor}`}>{pos.market_id}</p>
                  <p className={`text-xs text-white/40`}>{pos.side} @ ${pos.entry_price}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${pos.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pos.realized_pnl >= 0 ? '+' : ''}{pos.realized_pnl} USDC
                  </p>
                  <p className={`text-xs text-white/40`}>{pos.status}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={`text-sm ${textColor} opacity-50 italic`}>No active positions found.</p>
        )}
      </div>
      {trustMetrics && (
        <div className="space-y-4 mt-8">
          <h4 className={`text-sm font-medium ${textColor} uppercase tracking-wider opacity-70`}>Agent Intelligence Trust</h4>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Avg Brier Score" value={trustMetrics.avg_brier.toFixed(3)} subtext="Lower is better (0=perfect)" isNight={isNight} info="brier" />
            <StatCard label="Hit Rate" value={`${Math.round((trustMetrics.hits / trustMetrics.total_forecasts) * 100)}%`} subtext={`${trustMetrics.hits} hits / ${trustMetrics.total_forecasts} total`} isNight={isNight} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, subtext, isNight, info }) {
  const textColor = 'text-white';
  return (
    <div className={`glass-input rounded-lg p-3 text-center`}>
      <p className={`text-xs ${textColor} opacity-60 mb-1`}>
        {label}
        {info && <InfoTip term={info} isNight={isNight} className="ml-1" />}
      </p>
      <p className={`text-2xl font-light ${textColor} mb-1`}>{value}</p>
      <p className={`text-xs ${textColor} opacity-50`}>{subtext}</p>
    </div>
  );
}

function StatsSkeleton({ isNight, compact }) {
  const bgColor = 'bg-white/5';
  const borderColor = 'border-white/10';
  return (
    <div className={`${bgColor} border ${borderColor} rounded-2xl p-6 space-y-4 animate-pulse`}>
      <div className="h-12 w-40 rounded bg-white/10"></div>
    </div>
  );
}
