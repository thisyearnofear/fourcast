'use client';

/**
 * Barrel re-exports — import SportsTab / DiscoveryTab / MarketCardShared
 * directly so Next can code-split inactive Markets panels.
 */
export { SportsTabContent } from './SportsTab';
export { DiscoveryTabContent } from './DiscoveryTab';
export {
  MarketCard,
  StaggeredMarketCard,
  LoadingAnalysisState,
  ChainRecommendationBadge,
  ChainActionWidget,
} from './MarketCardShared';
