import { ethers } from 'ethers'
import { savePrediction } from '@/services/db'
import { getChainConfig, getSigner } from '@/services/chainConfig'

export const runtime = 'nodejs';

const RATE_LIMIT = 50
const WINDOW_MS = 60 * 60 * 1000
const rateMap = new Map()

function identFromReq(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ua = request.headers.get('user-agent')
  return forwarded?.split(',')[0]?.trim() || realIp?.trim() || ua || 'unknown'
}

function checkLimit(id) {
  const now = Date.now()
  const arr = rateMap.get(id) || []
  const valid = arr.filter(t => now - t < WINDOW_MS)
  if (valid.length >= RATE_LIMIT) return false
  valid.push(now)
  rateMap.set(id, valid)
  return true
}

const CONTRACT_ABI = [
  'function placePrediction(uint256 marketId, string side, uint256 stakeWei, uint16 oddsBps, string uri) external payable returns (bytes32)'
]

function computeFee(stakeWei, bps) {
  const basis = BigInt(bps || 100)
  return (stakeWei * basis) / 10000n
}

function buildTxData(contractAddress, payload, feeBps) {
  const iface = new ethers.Interface(CONTRACT_ABI)
  const data = iface.encodeFunctionData('placePrediction', [
    payload.marketId,
    payload.side,
    payload.stakeWei,
    payload.oddsBps,
    payload.uri || ''
  ])
  const fee = computeFee(payload.stakeWei, feeBps)
  return { to: contractAddress, data, value: fee }
}

function serializeTxRequest(tx) {
  return {
    to: tx.to,
    data: tx.data,
    value: typeof tx.value === 'bigint' ? tx.value.toString() : tx.value
  }
}

export async function POST(request) {
  try {
    const id = identFromReq(request)
    if (!checkLimit(id)) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json()
    const { marketID, price, side, size, walletAddress, metadataUri, chainId } = body

    if (!marketID || price === undefined || !side || !size || !walletAddress) {
      return Response.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    const oddsBps = Math.max(0, Math.min(10000, Math.round(parseFloat(price) * 10000)))
    const stakeWei = ethers.parseEther(String(size))

    const cfg = getChainConfig(chainId)
    if (!cfg.address) {
      const idNum = Number(chainId || 0)
      if (idNum === 137 || idNum === 80001) {
        return Response.json({ success: true,
          mode: 'unsupported_chain',
          note: 'Polygon ERC20 receipt not configured. Deploy and set PREDICTION_CONTRACT_ADDRESS_POLYGON to enable.'
        }, { status: 200 })
      }
      const txReq = buildTxData('0x0000000000000000000000000000000000000000', {
        marketId: Number(marketID),
        side,
        stakeWei,
        oddsBps,
        uri: metadataUri || ''
      }, cfg.feeBps)
      return Response.json({
        success: true,
        mode: 'client_signature_required',
        txRequest: serializeTxRequest(txReq),
        note: 'Set chain-specific prediction contract address to enable server-side address resolution'
      }, { status: 200 })
    }

    // Ensure feeBps aligns with on-chain contract config
    let effectiveFeeBps = cfg.feeBps
    try {
      const provider = new ethers.JsonRpcProvider(cfg.rpcUrl)
      const contract = new ethers.Contract(cfg.address, ['function feeBps() view returns (uint16)'], provider)
      const chainFee = await contract.feeBps()
      effectiveFeeBps = Number(chainFee)
    } catch (_) { /* ignore */ }

    const txRequest = buildTxData(cfg.address, {
      marketId: Number(marketID),
      side,
      stakeWei,
      oddsBps,
      uri: metadataUri || ''
    }, effectiveFeeBps)

    const wallet = getSigner(chainId)
    if (!wallet) {
      return Response.json({ success: true, txRequest: serializeTxRequest(txRequest), mode: 'client_signature_required' }, { status: 200 })
    }
    
    // Retry logic for transient failures
    let tx, receipt
    const maxRetries = 2
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        tx = await wallet.sendTransaction(txRequest)
        receipt = await tx.wait()
        break
      } catch (txError) {
        if (attempt === maxRetries) throw txError
        if (txError.code === 'NONCE_EXPIRED' || txError.code === 'REPLACEMENT_UNDERPRICED') {
          await new Promise(r => setTimeout(r, 2000)) // Wait 2s before retry
          continue
        }
        throw txError // Don't retry other errors
      }
    }

    // Save to database for analytics
    const predictionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'string', 'uint256', 'uint16', 'uint256'],
        [walletAddress, Number(marketID), side, stakeWei, oddsBps, Date.now()]
      )
    )

    await savePrediction({
      id: predictionId,
      userAddress: walletAddress,
      marketId: String(marketID),
      marketTitle: body.marketTitle || null,
      side,
      stakeWei: stakeWei.toString(),
      oddsBps,
      chainId: Number(chainId || 56),
      txHash: tx.hash,
      metadataUri: metadataUri || null,
      timestamp: Math.floor(Date.now() / 1000)
    })

    return Response.json({
      success: true,
      txHash: tx.hash,
      receipt,
      order: {
        marketID,
        side,
        price,
        size
      },
      timestamp: new Date().toISOString()
    }, { status: 201 })
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    service: 'BNB Predictions',
    status: 'available',
    capabilities: { buildTxRequest: true, serverSubmit: !!process.env.BNB_PRIVATE_KEY },
    network: 'BNBChain',
    contract: process.env.PREDICTION_CONTRACT_ADDRESS_BNB || null,
    feeBps: parseInt(process.env.PREDICTION_FEE_BPS_BNB || process.env.PREDICTION_FEE_BPS || '100', 10)
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}