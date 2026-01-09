// Centralized chain configuration - single source of truth
import { ethers } from 'ethers'

const CHAIN_CONFIGS = {
  56: { // BNB Mainnet
    name: 'BNB Chain',
    addressKey: 'PREDICTION_CONTRACT_ADDRESS_BNB',
    feeBpsKey: 'PREDICTION_FEE_BPS_BNB',
    rpcUrlKey: 'NEXT_PUBLIC_BNB_RPC_URL',
    signerKeyKey: 'BNB_PRIVATE_KEY',
    fallbackRpc: 'https://bsc-dataseed.binance.org',
    usdcAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' // Binance-Peg USDC
  },
  97: { // BNB Testnet
    name: 'BNB Testnet',
    addressKey: 'PREDICTION_CONTRACT_ADDRESS_BNB',
    feeBpsKey: 'PREDICTION_FEE_BPS_BNB',
    rpcUrlKey: 'NEXT_PUBLIC_BNB_RPC_URL',
    signerKeyKey: 'BNB_PRIVATE_KEY',
    fallbackRpc: 'https://bsc-testnet.publicnode.com',
    usdcAddress: '0x64544969ed7EBf5f083679233325356EbE738930' // Mock USDC
  },
  137: { // Polygon
    name: 'Polygon',
    addressKey: 'PREDICTION_CONTRACT_ADDRESS_POLYGON',
    feeBpsKey: 'PREDICTION_FEE_BPS_POLYGON',
    rpcUrlKey: 'POLYGON_RPC_URL',
    signerKeyKey: 'POLYGON_PRIVATE_KEY',
    fallbackRpc: 'https://polygon-rpc.com',
    usdcAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC.e
  },
  80001: { // Polygon Mumbai
    name: 'Polygon Mumbai',
    addressKey: 'PREDICTION_CONTRACT_ADDRESS_POLYGON',
    feeBpsKey: 'PREDICTION_FEE_BPS_POLYGON',
    rpcUrlKey: 'POLYGON_RPC_URL',
    signerKeyKey: 'POLYGON_PRIVATE_KEY',
    fallbackRpc: 'https://rpc-mumbai.maticvigil.com',
    usdcAddress: '0x0FA8781a83E46826621b3BC094Ea2A0212e71B23' // Mock USDC
  },
  42161: { // Arbitrum
    name: 'Arbitrum',
    addressKey: 'PREDICTION_CONTRACT_ADDRESS_ARBITRUM',
    feeBpsKey: 'PREDICTION_FEE_BPS_ARBITRUM',
    rpcUrlKey: 'ARB_RPC_URL',
    signerKeyKey: 'ARB_PRIVATE_KEY',
    fallbackRpc: 'https://arb1.arbitrum.io/rpc',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' // Native USDC
  }
}

export function getChainConfig(chainId) {
  const id = Number(chainId || 56)
  const config = CHAIN_CONFIGS[id]
  
  if (!config) {
    // Fallback to BNB
    return getChainConfig(56)
  }

  return {
    chainId: id,
    name: config.name,
    address: process.env[config.addressKey],
    feeBps: parseInt(process.env[config.feeBpsKey] || process.env.PREDICTION_FEE_BPS || '100', 10),
    rpcUrl: process.env[config.rpcUrlKey] || config.fallbackRpc,
    signerKey: process.env[config.signerKeyKey],
    usdcAddress: config.usdcAddress
  }
}

// Cache healthy providers to avoid repeated health checks
const providerCache = new Map()
const PROVIDER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getHealthyProvider(chainId) {
  const config = getChainConfig(chainId)
  const cacheKey = `${chainId}_${config.rpcUrl}`
  
  // Check cache
  const cached = providerCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < PROVIDER_CACHE_TTL) {
    return cached.provider
  }

  // Try primary RPC
  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl)
    await provider.getBlockNumber() // Health check
    providerCache.set(cacheKey, { provider, timestamp: Date.now() })
    return provider
  } catch (error) {
    console.warn(`Primary RPC failed for chain ${chainId}, using fallback`)
    const fallbackProvider = new ethers.JsonRpcProvider(config.fallbackRpc)
    providerCache.set(cacheKey, { provider: fallbackProvider, timestamp: Date.now() })
    return fallbackProvider
  }
}

export function getProvider(chainId) {
  const config = getChainConfig(chainId)
  return new ethers.JsonRpcProvider(config.rpcUrl)
}

export function getSigner(chainId) {
  const config = getChainConfig(chainId)
  if (!config.signerKey) return null
  
  const provider = getProvider(chainId)
  return new ethers.Wallet(config.signerKey, provider)
}
