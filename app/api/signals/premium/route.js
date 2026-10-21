import { createHash } from 'crypto'
import { saveSignal } from '@/services/db.js'
import { notifyFollowers } from '@/services/notificationService.js'
import { listMemoryWrites } from '@/services/memory/writeLedger.js'
import { deliverAfterSettlement } from '@/services/payments/x402Sui/settle.js'
import { buildPaymentRequirement, encodePaymentRequirement, requestHash } from '@/services/payments/x402Sui/verify.js'
import {
  PAYMENT_REASONS,
  X402_VERSION,
  fromBaseUnits,
  isEnabled,
  premiumPrice,
  sellerAddress,
  settlementNetwork
} from '@/services/payments/x402Sui/types.js'

export const runtime = 'nodejs'

/**
 * Premium signal — the paid half of the signal feed (WP5).
 *
 * The unpaid path answers 402 with a `Payment-Required` header naming the
 * price, the payee and the settlement network. The paid path re-reads the
 * buyer's transaction through the Tatum Sui RPC and only then publishes the
 * signal — the resource is produced after settlement, never before.
 *
 * Payment is settled on Sui. The network is echoed in every response and
 * defaults to testnet: the mainnet-memory deliverable is carried by WP2/WP3,
 * so this leg must not be able to move real money by accident.
 */

/** Slug form used by the memory layer for signal keys. */
function slug(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw.replace(/\s+/g, '_').replace(/[^\x21-\x7E]/g, '').slice(0, 120) || null
}

/**
 * The blob id of the memory for this signal, read from the memory ledger.
 *
 * We never re-derive a blob id: it comes from `memory_writes`, which is the
 * local record of what was actually appended on chain. Memories are written on
 * resolution, so a freshly published signal usually has none yet — that is
 * reported as `null`, not guessed at.
 */
async function findSignalBlobId(candidateKeys) {
  for (const memkey of candidateKeys) {
    if (!memkey) continue
    try {
      const rows = await listMemoryWrites({ kind: 'signal', memkey, limit: 1 })
      const row = rows.find((r) => r && r.blob_id)
      if (row) return { blobId: row.blob_id, memkey, memoryId: row.memory_id || null, version: row.version || null }
    } catch (err) {
      console.error('[API/Signals/Premium] memory lookup failed:', err?.message || err)
      return { blobId: null, memkey: null, memoryId: null, version: null }
    }
  }
  return { blobId: null, memkey: null, memoryId: null, version: null }
}

function buildSignalPayload(body) {
  const market = body.market
  const analysis = body.analysis
  const eventId = market.id || market.marketID || market.tokenID || market.event_id || 'unknown'
  const eventTimeStr = market.resolutionDate || market.endDate || market.expiresAt || null
  const eventTime = eventTimeStr ? Math.floor(new Date(eventTimeStr).getTime() / 1000) : null

  const snapshot = {
    title: market.title || market.question || null,
    ask: market.ask,
    bid: market.bid,
    odds: market.currentOdds || null,
    volume24h: market.volume24h || market.volume || null,
    liquidity: market.liquidity || null,
    tags: market.tags || null
  }
  const snapshotHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')

  const confidence = analysis.assessment?.confidence || null
  const oddsEfficiency = analysis.assessment?.odds_efficiency || null
  const aiDigest = analysis.reasoning || analysis.analysis || null
  const aiDigestHash = aiDigest ? createHash('sha256').update(String(aiDigest)).digest('hex') : null

  return {
    eventId,
    eventTime,
    snapshot,
    snapshotHash,
    confidence,
    oddsEfficiency,
    aiDigest,
    aiDigestHash,
    authorAddress: body.authorAddress?.toLowerCase() || null,
    venue: market.location || market.venue || null,
    chainOrigin: body.chainOrigin || 'ARC'
  }
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body?.market || !body?.analysis) {
    return Response.json({ success: false, error: 'missing market or analysis' }, { status: 400 })
  }

  const payload = buildSignalPayload(body)
  const price = premiumPrice(process.env).baseUnits
  const answerKey = body.answerKey || `signal:${payload.eventId}:${payload.snapshotHash}`

  const response = await deliverAfterSettlement(
    request,
    async ({ settlement }) => {
      const now = Math.floor(Date.now() / 1000)
      // The digest suffix keeps two purchases of the same market apart — the
      // signal id is the primary key of the signals table.
      const id = `${payload.eventId}-${now}-${String(settlement.txDigest || '').slice(0, 8)}`

      const res = await saveSignal({
        id,
        event_id: payload.eventId,
        market_title: payload.snapshot.title,
        venue: payload.venue,
        event_time: payload.eventTime,
        market_snapshot_hash: payload.snapshotHash,
        weather_json: null,
        ai_digest: payload.aiDigest,
        confidence: payload.confidence,
        odds_efficiency: payload.oddsEfficiency,
        author_address: payload.authorAddress,
        tx_hash: settlement.txDigest,
        timestamp: now,
        chain_origin: payload.chainOrigin
      })

      if (!res.success) {
        throw new Error(`signal publish failed: ${res.error}`)
      }

      const memory = await findSignalBlobId([slug(id), slug(payload.eventId)])
      if (payload.authorAddress) {
        notifyFollowers(payload.authorAddress, {
          id,
          market_title: payload.snapshot.title,
          ai_digest: payload.aiDigest,
          confidence: payload.confidence,
          venue: payload.venue
        }).catch(err => {
          console.error('[API/Signals/Premium] notifyFollowers failed (non-fatal):', err)
        })
      }

      return {
        id,
        signalId: id,
        eventId: payload.eventId,
        snapshotHash: payload.snapshotHash,
        aiDigestHash: payload.aiDigestHash,
        confidence: payload.confidence,
        blobId: memory.blobId,
        memoryKey: memory.memkey,
        memoryStatus: memory.blobId ? 'written' : 'not-yet-written'
      }
    },
    {
      priceUsdc: price,
      seller: sellerAddress(process.env),
      answerKey,
      runId: body.runId || null,
      requestHash: requestHash(body),
      resource: '/api/signals/premium',
      description: 'Fourcast premium signal'
    }
  )

  return response
}

export async function GET(request) {
  // Unpaid by definition: the requirement IS the answer. A buyer can quote
  // against this without spending anything.
  const net = settlementNetwork(process.env)
  const price = premiumPrice(process.env).baseUnits
  const seller = sellerAddress(process.env)

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

  const requirement = buildPaymentRequirement({
    seller,
    amountUsdc: price,
    network: net.network,
    resource: '/api/signals/premium',
    description: 'Fourcast premium signal'
  })

  return Response.json(
    {
      success: false,
      error: 'payment required',
      x402Version: X402_VERSION,
      accepts: requirement.accepts,
      price: { baseUnits: price, usdc: fromBaseUnits(price) },
      settlementNetwork: net.network
    },
    { status: 402, headers: { 'Payment-Required': encodePaymentRequirement(requirement) } }
  )
}
