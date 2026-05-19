'use client';

import { useRouter } from 'next/navigation';

const CATEGORY_SUGGESTIONS = {
  Crypto: ['Sports', 'Politics', 'Weather'],
  Sports: ['Crypto', 'Politics', 'Weather'],
  Politics: ['Crypto', 'Sports', 'Weather'],
  Weather: ['Crypto', 'Sports', 'Politics'],
};

const CATEGORY_ICONS = {
  Crypto: '₿',
  Sports: '⚽',
  Politics: '🏛',
  Weather: '🌤',
};

export default function EmptyMarketState({ category, onSwitchCategory, message }) {
  const router = useRouter();
  const suggestions = CATEGORY_SUGGESTIONS[category] || ['Sports', 'Politics', 'Weather'];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4 opacity-60">
        {CATEGORY_ICONS[category] || '📊'}
      </div>
      <h3 className="text-lg font-medium text-white/70 mb-2">
        No {category || 'active'} markets right now
      </h3>
      <p className="text-sm text-white/40 mb-6 max-w-sm leading-relaxed">
        {message || 'Try a different category, expand your filters, or check back later.'}
      </p>
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {suggestions.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              if (onSwitchCategory) {
                onSwitchCategory(cat);
              } else {
                router.push(`/markets?category=${cat}`);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
              bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20
              text-white/60 hover:text-white/80 transition-all"
          >
            <span>{CATEGORY_ICONS[cat]}</span>
            <span>Browse {cat}</span>
            <span className="text-white/30">→</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          if (onSwitchCategory) {
            onSwitchCategory('Crypto');
          } else {
            router.push('/weather');
          }
        }}
        className="text-xs text-white/30 hover:text-white/50 underline underline-offset-2 transition-colors"
      >
        Check weather predictions instead
      </button>
    </div>
  );
}
