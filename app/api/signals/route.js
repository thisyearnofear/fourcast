import { saveSignal, getLatestSignals, updateSignalTxHash } from '@/services/db.js'
import { createHash } from 'crypto'

export async function POST(request) {
  try {
    const body = await request.json()
    const market = body.market
    const analysis = body.analysis
    const authorAddress = body.authorAddress || null

    if (!market || !analysis) {
      return Response.json({ success: false, error: 'missing market or analysis' }, { status: 400 })
    }

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

    const now = Math.floor(Date.now() / 1000)
    const id = `${eventId}-${now}`

    const confidence = analysis.assessment?.confidence || null
    const oddsEfficiency = analysis.assessment?.odds_efficiency || null
    const aiDigest = analysis.reasoning || analysis.analysis || null

    const venue = market.location || market.venue || null

    const res = await saveSignal({
      id,
      event_id: eventId,
      market_title: snapshot.title,
      venue,
      event_time: eventTime,
      market_snapshot_hash: snapshotHash,
      weather_json: null, // AI digest contains venue weather analysis
      ai_digest: aiDigest,
      confidence,
      odds_efficiency: oddsEfficiency,
      author_address: authorAddress,
      tx_hash: null,
      timestamp: now
    })

    if (!res.success) {
      return Response.json({ success: false, error: res.error }, { status: 500 })
    }

    const aiDigestHash = aiDigest ? createHash('sha256').update(String(aiDigest)).digest('hex') : null
    return Response.json({ success: true, id, snapshotHash, aiDigestHash })
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const res = await getLatestSignals(limit)
    if (!res.success) {
      return Response.json({ success: false, error: res.error }, { status: 500 })
    }
    return Response.json({ success: true, signals: res.signals })
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { id, tx_hash } = body

    if (!id || !tx_hash) {
      return Response.json({ success: false, error: 'missing id or tx_hash' }, { status: 400 })
    }

    const res = await updateSignalTxHash(id, tx_hash)
    if (!res.success) {
      return Response.json({ success: false, error: res.error }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
