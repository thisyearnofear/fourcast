'use client';

import React, { useEffect, useState } from 'react';
import SignalCard from './SignalCard';

/**
 * Unified Signal Feed
 * Replaces the old "RecentPredictions" with a multi-domain feed
 */
export default function RecentPredictions({ chainId = 56, isNight = false }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL'); // ALL, WEATHER, MOBILITY

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Fetch from our consolidated signals API
        const res = await fetch('/api/signals?limit=10');
        const json = await res.json();
        if (json.success) {
          setSignals(json.signals || []);
        }
      } catch (err) {
        console.error('Failed to load signals:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filteredSignals = signals.filter(s => {
    if (filter === 'ALL') return true;
    const isWeather = s.weather_json || s.market_title.toLowerCase().includes('rain');
    if (filter === 'WEATHER') return isWeather;
    if (filter === 'MOBILITY') return !isWeather;
    return true;
  });

  const textColor = isNight ? 'text-white' : 'text-black';
  const tabClass = (active) => `
    text-xs px-3 py-1 rounded-full transition-all 
    ${active 
      ? (isNight ? 'bg-white text-black font-medium' : 'bg-black text-white font-medium') 
      : 'opacity-60 hover:opacity-100'}
  `;

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex justify-between items-center px-1">
        <h3 className={`text-sm font-light ${textColor}`}>Live Signals</h3>
        <div className="flex space-x-1">
          <button onClick={() => setFilter('ALL')} className={tabClass(filter === 'ALL')}>All</button>
          <button onClick={() => setFilter('WEATHER')} className={tabClass(filter === 'WEATHER')}>🌤️</button>
          <button onClick={() => setFilter('MOBILITY')} className={tabClass(filter === 'MOBILITY')}>🚗</button>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
        {loading && (
          <div className={`text-center py-8 opacity-50 text-sm ${textColor}`}>
            Initializing Edge Nodes...
          </div>
        )}
        
        {!loading && filteredSignals.length === 0 && (
          <div className={`text-center py-8 opacity-50 text-sm ${textColor}`}>
            No active signals found.
          </div>
        )}

        {filteredSignals.map((signal) => (
          <SignalCard 
            key={signal.id} 
            signal={{
              ...signal,
              // Helper to detect domain on client side if API doesn't send it explicitly yet
              domain: signal.weather_json ? 'weather' : 'mobility' 
            }} 
            isNight={isNight} 
          />
        ))}
      </div>
    </div>
  );
}
