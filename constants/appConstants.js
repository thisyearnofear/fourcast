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
  APTOS: {
    id: 'aptos',
    name: 'Aptos',
    display: 'Signals (Aptos)',
    icon: '📡',
    color: 'purple',
    purpose: 'Publish signals',
    capabilities: ['Publish signals', 'Build track record'],
    disabled: ['Receive tips']
  },
  MOVEMENT: {
    id: 'movement',
    name: 'Movement',
    display: 'Signals + Tips (Movement)',
    icon: '💎',
    color: 'amber',
    purpose: 'Publish & monetize',
    capabilities: ['Publish signals', 'Build track record', 'Receive tips'],
    disabled: [],
    moduleAddress: '0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c'
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
  }
};

// Aptos Networks
export const APTOS_NETWORKS = {
  MAINNET: {
    id: 'aptos-mainnet',
    name: 'Aptos Mainnet',
    display: 'Aptos Mainnet',
    rpcUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
    isDefault: true
  },
  TESTNET: {
    id: 'aptos-testnet',
    name: 'Aptos Testnet',
    display: 'Aptos Testnet',
    rpcUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
    isDefault: false
  }
};

// Movement Networks
export const MOVEMENT_NETWORKS = {
  MAINNET: {
    id: 'movement-mainnet',
    name: 'Movement Mainnet',
    display: 'Movement Mainnet',
    rpcUrl: 'https://mainnet.movement.network/v1',
    chainId: 250, // Movement Bardock testnet (update when mainnet launches)
    isDefault: true
  },
  TESTNET: {
    id: 'movement-testnet',
    name: 'Movement Testnet',
    display: 'Movement Testnet (Bardock)',
    rpcUrl: 'https://testnet.movementnetwork.xyz/v1',
    chainId: 250,
    isDefault: false
  }
};

// Network Switching Configs (for wallet adapter changeNetwork calls)
export const NETWORK_SWITCH_CONFIGS = {
  'aptos-mainnet': {
    name: 'mainnet',
    chainId: 1,
    url: 'https://fullnode.mainnet.aptoslabs.com/v1'
  },
  'aptos-testnet': {
    name: 'testnet',
    chainId: 2,
    url: 'https://fullnode.testnet.aptoslabs.com/v1'
  },
  'movement-mainnet': {
    name: 'custom',
    chainId: 250,
    url: 'https://mainnet.movement.network/v1'
  },
  'movement-testnet': {
    name: 'custom',
    chainId: 250,
    url: 'https://testnet.movementnetwork.xyz/v1'
  }
};