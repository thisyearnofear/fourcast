import { ethers } from 'ethers'

export const runtime = 'nodejs';

const ABI = [
  'function feeBps() view returns (uint16)',
  'function treasury() view returns (address)',
  'function paused() view returns (bool)',
  'event PredictionPlaced(address indexed user,uint256 indexed marketId,bytes32 indexed id,string side,uint256 stakeWei,uint16 oddsBps,string uri,uint256 timestamp)'
]

function getProvider(rpcUrl) {
  const url = rpcUrl || process.env.NEXT_PUBLIC_BNB_RPC_URL || 'https://bsc-dataseed.binance.org'
  return new ethers.JsonRpcProvider(url)
}

function getChainConfig(chainId) {
  const id = Number(chainId || 56)
  if (id === 56 || id === 97) {
    return {
      address: process.env.PREDICTION_CONTRACT_ADDRESS_BNB,
      rpcUrl: process.env.NEXT_PUBLIC_BNB_RPC_URL
    }
  }
  return {
    address: process.env.PREDICTION_CONTRACT_ADDRESS_BNB,
    rpcUrl: process.env.NEXT_PUBLIC_BNB_RPC_URL
  }
}

async function fetchRecentEvents(provider, address, iface, topic, latest, lookback, chunk, maxEvents) {
  const events = []
  const startBlock = Math.max(1, Number(latest) - lookback)
  let toBlock = Number(latest)
  let step = chunk
  while (toBlock >= startBlock && events.length < maxEvents) {
    const fromBlock = Math.max(startBlock, toBlock - step + 1)
    try {
      const logs = await provider.getLogs({ address, topics: [topic], fromBlock, toBlock })
      for (const l of logs) {
        const parsed = iface.parseLog(l)
        events.push({
          txHash: l.transactionHash,
          blockNumber: l.blockNumber,
          user: parsed.args.user,
          marketId: parsed.args.marketId.toString(),
          id: parsed.args.id,
          side: parsed.args.side,
          stakeWei: parsed.args.stakeWei.toString(),
          oddsBps: Number(parsed.args.oddsBps),
          uri: parsed.args.uri,
          timestamp: Number(parsed.args.timestamp)
        })
        if (events.length >= maxEvents) break
      }
      toBlock = fromBlock - 1
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('eth_getLogs') && msg.includes('rate limit')) {
        step = Math.max(100, Math.floor(step / 2))
        continue
      }
      break
    }
  }
  return events
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const chainId = Number(searchParams.get('chainId') || 56)
    const lookback = Math.min(20000, Math.max(500, Number(searchParams.get('lookback') || 5000)))
    const chunk = Math.min(5000, Math.max(100, Number(searchParams.get('chunk') || 1000)))
    const maxEvents = Math.min(25, Math.max(1, Number(searchParams.get('max') || 10)))

    const cacheKey = `${chainId}:${lookback}:${chunk}:${maxEvents}`
    const now = Date.now()
    const cached = _cache.get(cacheKey)
    if (cached && now - cached.time < TTL_MS) {
      return Response.json(cached.data, { status: 200 })
    }

    const cfg = getChainConfig(chainId)
    if (!cfg.address) {
      return Response.json({ success: false, error: 'Missing contract address for chain', chainId }, { status: 400 })
    }

    const provider = getProvider(cfg.rpcUrl)
    const contract = new ethers.Contract(cfg.address, ABI, provider)
    const [fee, tre, isPaused, latest] = await Promise.all([
      contract.feeBps(),
      contract.treasury(),
      contract.paused(),
      provider.getBlockNumber()
    ])

    const iface = new ethers.Interface(ABI)
    const topic = ethers.id('PredictionPlaced(address,uint256,bytes32,string,uint256,uint16,string,uint256)')

    let events = []
    try {
      events = await fetchRecentEvents(provider, cfg.address, iface, topic, latest, lookback, chunk, maxEvents)
    } catch (_) { /* empty */ }

    const payload = {
      success: true,
      chainId,
      address: cfg.address,
      feeBps: Number(fee),
      treasury: tre,
      paused: !!isPaused,
      recentEvents: events,
      meta: { latestBlock: Number(latest), lookback, chunk, maxEvents }
    }
    _cache.set(cacheKey, { time: now, data: payload })
    return Response.json(payload, { status: 200 })
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
const _cache = new Map()
const TTL_MS = 30000