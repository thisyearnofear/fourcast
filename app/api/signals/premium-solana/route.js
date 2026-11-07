import { getLatestSignals } from '@/services/db.js'
import { deliverAfterSettlementSolana, requestHash } from '@/services/payments/x402Solana/settle.js'
import { buildPaymentRequirement, encodePaymentRequirement } from '@/services/payments/x402Solana/verify.js'
import {
  PAYMENT_REASONS,
  X402_VERSION,
  assetMint,
  fromBaseUnits,
  isEnabled,
  premiumPrice,
  sellerAddress,
  settlementNetwork
} from '@/services/payments/x402Solana/types.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Premium signal brief — the Solana x402 rail (Encode "Best Use of x402"
 * track).
 *
 * The unpaid path answers 402 with a `Payment-Required` header naming the
 * price, the payee, the mint and the settlement network. The paid path hands
 * us a buyer-signed transaction; we verify the SPL transferChecked against
 * the requirement, simulate, broadcast, confirm, re-read the balance delta,
 * and only then deliver the latest signal brief — the resource is produced
 * after settlement, never before.
 *
 * Settlement is on Solana (devnet by default). Every response echoes
 * `settlementNetwork` so nobody has to guess which chain the money moved on.
 */

const RESOURCE = '/api/signals/premium-solana'
const DESCRIPTION = 'Fourcast premium signal brief (latest agent signals + settlement receipt)'

function quote() {
  const net = settlementNetwork(process.env)
  const asset = assetMint(process.env)
  const price = premiumPrice(process.env, asset.decimals ?? 6).baseUnits
  const seller = sellerAddress(process.env)
  return { net, asset, price, seller, mint: asset.mint }
}

export async function GET(request) {
  const { net, asset, price, seller, mint } = quote()

  if (!isEnabled(process.env)) {
    return Response.json(
      { success: false, error: PAYMENT_REASONS.X402_DISABLED, reason: 'X402_DISABLED', settlementNetwork: net.network },
      { status: 503 }
    )
  }
  if (!seller) {
    return Response.json(
      { success: false, error: PAYMENT_REASONS.SELLER_NOT_CONFIGURED, reason: 'SELLER_NOT_CONFIGURED', settlementNetwork: net.network },
      { status: 503 }
    )
  }
  if (!mint) {
    return Response.json(
      { success: false, error: 'No asset mint configured for this network.', reason: 'ASSET_UNRESOLVED', settlementNetwork: net.network },
      { status: 500 }
    )
  }

  const requirement = buildPaymentRequirement({
    seller,
    amount: price,
    network: net.network,
    asset: mint,
    decimals: asset.decimals,
    symbol: asset.symbol,
    resource: RESOURCE,
    description: DESCRIPTION
  })

  return Response.json(
    {
      success: false,
      error: 'payment required',
      x402Version: X402_VERSION,
      accepts: requirement.accepts,
      price: { baseUnits: price, human: fromBaseUnits(price, asset.decimals ?? 6), asset: mint, symbol: asset.symbol },
      settlementNetwork: net.network
    },
    { status: 402, headers: { 'Payment-Required': encodePaymentRequirement(requirement) } }
  )
}

export async function POST(request) {
  let body = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const { net, asset, price, seller, mint } = quote()
  const limit = Math.min(Math.max(Number(body?.limit) || 5, 1), 20)

  const response = await deliverAfterSettlementSolana(
    request,
    async ({ settlement }) => {
      const latest = await getLatestSignals(limit)
      const signals = (latest.signals || []).map((s) => ({
        id: s.id,
        eventId: s.event_id,
        marketTitle: s.market_title,
        venue: s.venue,
        eventTime: s.event_time,
        confidence: s.confidence,
        oddsEfficiency: s.odds_efficiency,
        aiDigest: s.ai_digest,
        timestamp: s.timestamp,
        txHash: s.tx_hash
      }))

      return {
        resource: RESOURCE,
        description: DESCRIPTION,
        signalCount: signals.length,
        signals,
        paidWith: {
          signature: settlement.txSignature,
          amount: settlement.amountHuman,
          asset: settlement.assetSymbol,
          network: settlement.network,
          explorer: settlement.explorer
        }
      }
    },
    {
      priceBaseUnits: price,
      assetMint: mint,
      seller,
      answerKey: `solana-signal-brief:${limit}`,
      runId: body?.runId || null,
      requestHash: requestHash(body || {}),
      resource: RESOURCE,
      description: DESCRIPTION
    }
  )

  return response
}
