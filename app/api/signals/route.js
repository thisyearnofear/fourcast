import { saveSignal, getLatestSignals, updateSignalTxHash, getSignalCountByAuthor } from '@/services/db.js'
import { notifyFollowers } from '@/services/notificationService.js'
import { createHash } from 'crypto'

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json()
    // console.log('[API/Signals] payload received') // Commented out to reduce noise, enable if needed

    const market = body.market
    const analysis = body.analysis
    const authorAddress = body.authorAddress || null

    if (!market || !analysis) {
      console.error('[API/Signals] Missing market or analysis in payload')
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
    const chainOrigin = body.chainOrigin || 'ARC'

    const signalData = {
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
      timestamp: now,
      chain_origin: chainOrigin
    }

    const res = await saveSignal(signalData)

    if (!res.success) {
      console.error('[API/Signals] DB Save Error:', res.error)
      return Response.json({ success: false, error: res.error }, { status: 500 })
    }

    // Fire-and-forget: notify all followers of this author about the new signal.
    // This is the "push" that converts the one-shot share virality into a
    // compounding retention loop (Review Recommendation #3).
    if (authorAddress) {
      notifyFollowers(authorAddress, signalData).catch(err => {
        console.error('[API/Signals] notifyFollowers failed (non-fatal):', err)
      })
    }

    const aiDigestHash = aiDigest ? createHash('sha256').update(String(aiDigest)).digest('hex') : null
    return Response.json({ success: true, id, snapshotHash, aiDigestHash })
  } catch (error) {
    console.error('[API/Signals] Handler Exception:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const author = searchParams.get('author')
    if (author && searchParams.get('countOnly')) {
      const countRes = await getSignalCountByAuthor(author)
      return Response.json({ success: countRes.success, count: countRes.count })
    }
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
