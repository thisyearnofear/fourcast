import React from 'react';

/**
 * SignalCard - Unified display for multi-domain signals
 * Supports Weather 🌤️ and Mobility 🚗 visualization
 */
export default function SignalCard({ signal, isNight = false }) {
  const isWeather = signal.domain === 'weather' || signal.weather_json;
  const isMobility = signal.domain === 'mobility' || (!isWeather && signal.market_title.includes('Turnout'));
  
  const domainIcon = isWeather ? '🌤️' : (isMobility ? '🚗' : '🔮');
  const domainName = isWeather ? 'Weather' : (isMobility ? 'Mobility' : 'General');
  
  // Dynamic Styles
  const bgStyle = isNight 
    ? 'bg-slate-900/60 border-white/20 text-white' 
    : 'bg-white/60 border-black/20 text-black';
  
  const badgeStyle = isWeather
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-orange-500/20 text-orange-400 border-orange-500/30';

  // Format timestamp
  const timeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-5 transition-all hover:scale-[1.02] ${bgStyle}`}>
      {/* Header: Domain + Confidence */}
      <div className="flex justify-between items-start mb-3">
        <div className={`flex items-center space-x-2 px-2 py-1 rounded-full border text-xs font-medium ${badgeStyle}`}>
          <span>{domainIcon}</span>
          <span>{domainName} Signal</span>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-60">Confidence</div>
          <div className={`font-bold ${signal.confidence === 'HIGH' ? 'text-green-400' : 'text-yellow-400'}`}>
            {signal.confidence}
          </div>
        </div>
      </div>

      {/* Market Title */}
      <h3 className="text-lg font-light leading-snug mb-2">{signal.market_title}</h3>
      
      {/* Venue/Location */}
      <div className="flex items-center space-x-1 text-xs opacity-60 mb-4">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{signal.venue}</span>
        <span>•</span>
        <span>{timeAgo(signal.timestamp)}</span>
      </div>

      {/* AI Analysis Digest */}
      <div className={`p-3 rounded-xl text-sm leading-relaxed border ${isNight ? 'bg-black/20 border-white/10' : 'bg-white/40 border-black/10'}`}>
        <span className="opacity-70">Analysis: </span>
        <span className="font-medium opacity-90">{signal.ai_digest}</span>
      </div>
      
      {/* Action Footer */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-xs opacity-50 font-mono">
          ID: {signal.event_id?.slice(0, 8)}...
        </div>
        <button className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${isNight ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
          View On-Chain ↗
        </button>
      </div>
    </div>
  );
}
