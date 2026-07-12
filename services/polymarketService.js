// Polymarket Service — facade re-exporting all sub-modules
// Backward-compatible singleton: same method names as the original class
//
// Consumers import like:
//   import { polymarketService } from '@/services/polymarketService'
//   import polymarketService from '@/services/polymarketService'

import {
  generateCacheKey,
  getCachedMarkets,
  setCachedMarkets,
  getCachedCatalog,
  setCachedCatalog,
  getStatus,
} from './polymarketCache.js';
import * as discovery from './polymarketDiscovery.js';
import * as trading from './polymarketTrading.js';
import * as helpers from './polymarketHelpers.js';

const polymarketService = {
  // Cache methods (from polymarketCache.js)
  generateCacheKey,
  getCachedMarkets,
  setCachedMarkets,
  getCachedCatalog,
  setCachedCatalog,
  getStatus,

  // Discovery methods (from polymarketDiscovery.js)
  ...discovery,

  // Trading methods (from polymarketTrading.js)
  ...trading,

  // Helper methods (from polymarketHelpers.js)
  ...helpers,
};

export { polymarketService };
export default polymarketService;
