import { executeAnalysis } from '../route.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const encoder = new TextEncoder();

function event(controller, payload) {
  controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
}

/**
 * Streams only truthful lifecycle events from the canonical analysis route.
 * The final `complete` payload is the exact response that /api/analyze would
 * return, so market callers do not lose any existing analysis fields.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid analysis request' }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const report = ({ stage, label }) => event(controller, { type: 'stage', stage, label });
      try {
        event(controller, { type: 'stage', stage: 'accepted', label: 'Analysis request accepted' });
        const analysisRequest = new Request(new URL('/api/analyze', request.url), {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify(body),
        });
        const response = await executeAnalysis(analysisRequest, report);
        const result = await response.json();
        event(controller, {
          type: result.success ? 'complete' : 'error',
          status: response.status,
          ...result,
        });
      } catch (error) {
        console.error('Analysis stream error:', error);
        event(controller, { type: 'error', success: false, error: 'Analysis failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
