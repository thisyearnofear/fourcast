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
 <div className="mb-4 flex h-14 w-14 items-center justify-center border border-[var(--color-rule)] bg-white/[0.04] text-[var(--color-accent)]/80">
 {ActiveIcon ? <ActiveIcon className="h-6 w-6" /> : <Diamond className="h-6 w-6" />}
 </div>
 <h3 className="text-lg font-medium text-[var(--color-ink-muted)] mb-2">
 No {category || 'active'} markets right now
 </h3>
 <p className="text-sm text-[var(--color-ink-faint)] mb-6 max-w-sm leading-relaxed">
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
 className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
 bg-[var(--color-paper-raised)] hover:bg-[var(--color-paper-soft)] border border-[var(--color-rule)] hover:border-[var(--color-rule-strong)]
 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-all"
 >
 {SuggestionIcon && <SuggestionIcon className="h-3.5 w-3.5" />}
 <span>Browse {cat}</span>
 <ArrowRight className="h-3 w-3 text-[var(--color-ink-faint)]" />
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
 className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink-faint)] underline underline-offset-2 transition-colors"
 >
 Clear filters and browse all markets
 </button>
 </div>
 );
}
