/**
 * Services Index - Consolidated service exports
 * Single import point for all services
 */

export { builderService } from './builderService';
export { polymarketService } from './polymarketService';
export { kalshiService } from './kalshiService';
export { weatherService } from './weatherService';
export { synthService } from './synthService';
export { tradingService } from './tradingService';
export { analyzePathDependentMarket, detectPathDependentMarket } from './pathDependentService';
// Re-export from pure utility (no server dependencies) so client components can import safely
// The original in aiService.server.js is identical — this ensures tree-shaking safety
// eslint-disable-next-line no-restricted-imports
export { calculateKellySizing } from '../utils/kellySizing';
