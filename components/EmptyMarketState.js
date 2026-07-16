'use client';

import { useRouter } from 'next/navigation';
import { Bitcoin, Trophy, Landmark, CloudRain, Diamond, ArrowRight } from 'lucide-react';

const CATEGORY_SUGGESTIONS = {
  Crypto: ['Sports', 'Politics', 'Weather'],
  Sports: ['Crypto', 'Politics', 'Weather'],
  Politics: ['Crypto', 'Sports', 'Weather'],
  Weather: ['Crypto', 'Sports', 'Politics'],
};

const CATEGORY_ICONS = {
  Crypto: Bitcoin,
  Sports: Trophy,
  Politics: Landmark,
  Weather: CloudRain,
};

export default function EmptyMarketState({ category, onSwitchCategory, message }) {
  const router = useRouter();
  const suggestions = (CATEGORY_SUGGESTIONS[category] || ['Sports', 'Politics', 'Crypto']).filter(
    (c) => c !== 'Weather'
  );

  const ActiveIcon = CATEGORY_ICONS[category];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300/80">
        {ActiveIcon ? <ActiveIcon className="h-6 w-6" /> : <Diamond className="h-6 w-6" />}
      </div>
      <h3 className="text-lg font-medium text-white/70 mb-2">
        No {category || 'active'} markets right now
      </h3>
      <p className="text-sm text-white/40 mb-6 max-w-sm leading-relaxed">
        {message || 'Try a different category, expand your filters, or check back later.'}
      </p>
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {suggestions.map((cat) => {
          const SuggestionIcon = CATEGORY_ICONS[cat];
          return (
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
              {SuggestionIcon && <SuggestionIcon className="h-3.5 w-3.5" />}
              <span>Browse {cat}</span>
              <ArrowRight className="h-3 w-3 text-white/30" />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => {
          if (onSwitchCategory) {
            onSwitchCategory('all');
          } else {
            router.push('/markets');
          }
        }}
        className="text-xs text-white/30 hover:text-white/50 underline underline-offset-2 transition-colors"
      >
        Clear filters and browse all markets
      </button>
    </div>
  );
}
