import { aiService } from '@/services/aiService'

const analysisRateLimit = new Map()
const ANALYSIS_RATE_LIMIT = 10
const ANALYSIS_WINDOW = 60 * 60 * 1000

function checkAnalysisRateLimit(identifier) {
  const now = Date.now()
  const userRequests = analysisRateLimit.get(identifier) || []
  const validRequests = userRequests.filter(timestamp => now - timestamp < ANALYSIS_WINDOW)
  if (validRequests.length >= ANALYSIS_RATE_LIMIT) return false
  validRequests.push(now)
  analysisRateLimit.set(identifier, validRequests)
  return true
}

function getClientIdentifier(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const userAgent = request.headers.get('user-agent')
  return forwarded?.split(',')[0]?.trim() || realIp?.trim() || userAgent || 'unknown'
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { eventType, location, weatherData, currentOdds, participants, marketID, eventDate, mode = 'deep' } = body

    if (!eventType || !location || !weatherData || !currentOdds) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields: eventType, location, weatherData, currentOdds' }) + '\n', {
        status: 400,
        headers: { 'Content-Type': 'application/x-ndjson' }
      })
    }

    const clientId = getClientIdentifier(request)
    const limitPerHour = mode === 'deep' ? 10 : ANALYSIS_RATE_LIMIT
    if (!checkAnalysisRateLimit(clientId)) {
      return new Response(JSON.stringify({ success: false, error: 'Analysis rate limit exceeded. Please try again later.' }) + '\n', {
        status: 429,
        headers: { 'Content-Type': 'application/x-ndjson' }
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        ;(async () => {
          try {
            const result = await aiService.analyzeWeatherImpact({
              eventType,
              location,
              weatherData,
              currentOdds,
              participants,
              marketId: marketID,
              eventDate,
              mode
            })

            const meta = {
              type: 'meta',
              success: true,
              marketId: marketID,
              assessment: {
                weather_impact: result.assessment?.weather_impact || 'UNKNOWN',
                odds_efficiency: result.assessment?.odds_efficiency || 'UNKNOWN',
                confidence: result.assessment?.confidence || 'LOW'
              },
              cached: result.cached || false,
              source: result.source || 'unknown',
              web_search: mode === 'deep',
              timestamp: new Date().toISOString()
            }
            controller.enqueue(encoder.encode(JSON.stringify(meta) + '\n'))

            const text = String(result.analysis || '')
            const parts = text.split(/(?<=\.)\s+/)
            for (const p of parts) {
              const chunk = { type: 'chunk', text: p }
              controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
              await new Promise(r => setTimeout(r, 60))
            }

            const complete = {
              type: 'complete',
              success: true,
              assessment: meta.assessment,
              analysis: result.analysis || '',
              key_factors: result.key_factors || [],
              recommended_action: result.recommended_action || 'Monitor manually',
              cached: meta.cached,
              source: meta.source,
              citations: result.citations || [],
              limitations: result.limitations || null,
              web_search: meta.web_search,
              timestamp: meta.timestamp
            }
            controller.enqueue(encoder.encode(JSON.stringify(complete) + '\n'))
            controller.close()
          } catch (err) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', success: false, error: 'Analysis failed' }) + '\n'))
            controller.close()
          }
        })()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Analysis failed' }) + '\n', {
      status: 500,
      headers: { 'Content-Type': 'application/x-ndjson' }
    })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}