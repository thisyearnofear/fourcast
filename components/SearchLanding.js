'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const QUICK_SEARCHES = [
  { label: 'BTC $100k', query: 'Bitcoin $100k June 2026' },
  { label: 'Chiefs Super Bowl', query: 'Chiefs Super Bowl' },
  { label: 'Fed Rate Cut', query: 'Fed interest rate cut 2026' },
  { label: 'Rain in Miami', query: 'rain in Miami tomorrow' },
];

const CATEGORIES = [
  { id: 'Crypto', icon: '₿', gradient: 'from-purple-600 to-pink-500' },
  { id: 'Sports', icon: '⚽', gradient: 'from-emerald-600 to-teal-500' },
  { id: 'Politics', icon: '🏛', gradient: 'from-indigo-600 to-blue-500' },
  { id: 'Weather', icon: '🌤', gradient: 'from-sky-600 to-cyan-500' },
];

export default function SearchLanding() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSearch = (q) => {
    const searchQuery = q || query.trim();
    if (!searchQuery) return;
    router.push(`/markets?analyze=auto&q=${encodeURIComponent(searchQuery)}`);
  };

  const handleCategoryClick = (cat) => {
    router.push(`/markets?category=${cat.id}&analyze=auto`);
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-radial from-purple-900/40 via-transparent to-transparent animate-pulse-slow" />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-float-delayed" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <div className="text-5xl mb-4">🔮</div>
          <h1 className="text-3xl font-light text-white/90 tracking-tight">
            Fourcast
          </h1>
          <p className="text-sm text-white/40 mt-2 font-light">
            AI-powered prediction intelligence
          </p>
        </div>

        {/* Search Bar — primary action */}
        <div className={`w-full max-w-xl transition-all duration-300 ${focused ? 'scale-105' : ''}`}>
          <div className={`
            flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all duration-300
            ${focused
              ? 'bg-white/10 border-purple-500/50 shadow-lg shadow-purple-500/10'
              : 'bg-white/5 border-white/10 hover:bg-white/8'
            }
          `}>
            <span className="text-lg text-white/30">🔮</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Type a prediction to analyze..."
              className="flex-1 bg-transparent text-white/80 text-base placeholder-white/25 font-light outline-none"
              autoFocus
            />
            <button
              onClick={() => handleSearch()}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-30"
              disabled={!query.trim()}
            >
              Analyze →
            </button>
          </div>
        </div>

        {/* Quick Search Pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-xl">
          {QUICK_SEARCHES.map((item) => (
            <button
              key={item.query}
              onClick={() => handleSearch(item.query)}
              className="px-3.5 py-1.5 rounded-full text-xs text-white/50 bg-white/5 border border-white/5 
                hover:bg-white/10 hover:text-white/70 hover:border-white/10 transition-all"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 w-full max-w-xl">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat)}
              className="group relative p-4 rounded-2xl border border-white/5 bg-white/5 
                hover:bg-white/10 hover:border-white/10 transition-all text-center"
            >
              <div className={`text-2xl mb-1.5 bg-gradient-to-br ${cat.gradient} w-10 h-10 rounded-xl 
                flex items-center justify-center mx-auto text-white shadow-lg`}>
                {cat.icon}
              </div>
              <div className="text-xs text-white/60 font-medium">{cat.id}</div>
            </button>
          ))}
        </div>

        {/* Telegram Reference */}
        <div className="mt-10 text-center">
          <a
            href="https://t.me/fourcasterbot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs text-white/30 
              bg-white/5 border border-white/5 hover:text-white/50 hover:bg-white/10 transition-all"
          >
            <span>💬</span>
            Try @fourcasterbot on Telegram — no setup needed
          </a>
        </div>

        {/* Footer */}
        <div className="mt-8 text-[10px] text-white/15 font-light tracking-wider uppercase">
          Powered by AI · On-chain via Arc · USDC
        </div>
      </div>
    </div>
  );
}
