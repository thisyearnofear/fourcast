// Application-wide constants
export const APP_NAME = 'Fourcast';
export const VERSION = '0.1.0';

// API Configuration
export const API_TIMEOUT = 10000; // 10 seconds
export const DEFAULT_PAGE_SIZE = 20;

// Cache Durations (milliseconds)
export const SHORT_CACHE = 5 * 60 * 1000; // 5 minutes
export const MEDIUM_CACHE = 30 * 60 * 1000; // 30 minutes
export const LONG_CACHE = 24 * 60 * 60 * 1000; // 24 hours

// Weather Constants
export const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';
export const DEFAULT_LOCATION = 'Nairobi';

// Market Constants
export const MIN_VOLUME_THRESHOLD = 50000;
export const MAX_DAYS_TO_RESOLUTION = 14;

// Confidence Levels
export const CONFIDENCE_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

// Event Types
export const EVENT_TYPES = {
  SPORTS: 'Sports',
  WEATHER: 'Weather',
  POLITICS: 'Politics',
  ECONOMICS: 'Economics',
  ALL: 'all'
};

// Chain Configuration
export const CHAINS = {
  EVM: {
    id: 'evm',
    name: 'EVM',
    display: 'Trading (EVM)',
    icon: '📊',
    color: 'blue',
    purpose: 'Trade on markets',
    capabilities: ['Place market orders', 'Participate in trading'],
    disabled: ['Publish signals', 'Receive tips']
  },
  // APTOS/MOVEMENT are display-only legacy constants: the chain stacks were
  // retired, but historical signals rows carry chain_origin = 'APTOS'/'MOVEMENT'
  // and their badges must still render. Do not wire new functionality to these.
  APTOS: {
    id: 'aptos',
    name: 'Aptos',
    display: 'Signals (Aptos · legacy)',
    icon: '📡',
    color: 'slate',
    legacy: true
  },
  MOVEMENT: {
    id: 'movement',
    name: 'Movement',
    display: 'Signals (Movement · legacy)',
    icon: '💎',
    color: 'slate',
    legacy: true
  },
  ARC: {
    id: 'arc',
    name: 'Arc',
    display: 'Settlement (Arc · USDC)',
    icon: '🌀',
    color: 'emerald',
    purpose: 'Primary settlement — signals, subs, tips in USDC',
    capabilities: ['USDC subscriptions', 'Sub-second finality', 'USDC tipping (rolling out)', 'Paymaster gas in USDC'],
    disabled: []
  }
};

// Supported EVM Networks for Trading
export const EVM_NETWORKS = {
  POLYGON: {
    id: 'polygon',
    chainId: 137,
    name: 'Polygon',
    display: 'Polygon (USDC)',
    icon: '🟣',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    isDefault: true
  },
  ETHEREUM: {
    id: 'ethereum',
    chainId: 1,
    name: 'Ethereum',
    display: 'Ethereum',
    icon: '⟠',
    rpcUrl: 'https://eth.public-rpc.com',
    explorerUrl: 'https://etherscan.io',
    isDefault: false
  },
  ARBITRUM: {
    id: 'arbitrum',
    chainId: 42161,
    name: 'Arbitrum',
    display: 'Arbitrum',
    icon: '🔵',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    isDefault: false
  },
  ARC: {
    id: 'arc',
    chainId: 5042002,
    name: 'Arc',
    display: 'Arc Testnet (USDC)',
    icon: '🌀',
    rpcUrl: 'https://rpc.testnet.arc.network/',
    explorerUrl: 'https://explorer.testnet.arc.network/',
    isDefault: false
  }
};

// Arc block-explorer URL helper. Strips the trailing slash from
// EVM_NETWORKS.ARC.explorerUrl so callers don't have to remember whether the
// constant includes one. Use this anywhere an Arc tx-hash link is built — keeps
// the URL in one place and kills future url-drift bugs (the previous round of
// URL swaps shipped explorer strings as raw templates in 3 places).
export const ARC_EXPLORER_TX = (txHash) =>
  `${EVM_NETWORKS.ARC.explorerUrl.replace(/\/$/, '')}/tx/${txHash}`;

