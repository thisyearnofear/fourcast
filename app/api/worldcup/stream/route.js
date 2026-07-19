import txlineService from '@/services/txline/txlineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/worldcup/stream
 *
 * Server-Sent Events proxy that streams TxLINE fixture/odds/score deltas.
 *
 * - The browser opens `new EventSource('/api/worldcup/stream')`. EventSource
 *   can't carry custom headers, so the upstream TxLINE SSE connection (when
 *   TXLINE_SSE_URL is set) is made here with the Authorization + X-Api-Token
 *   headers. When the upstream isn't configured, we fall back to a polling
 *   loop that yields the same delta shape.
 * - The client should merge each delta into its fixtures state keyed by
 *   `delta.fixtureId`. Unknown fixtureIds are dropped silently (the snapshot
 *   endpoint is authoritative for the initial roster).
 * - On client disconnect (request.signal.aborted) we abort the upstream
 *   subscription and close the stream.
 */
export async function GET(request) {
  const encoder = new TextEncoder();
  const cfg = txlineService.getStreamConfig();

  // AbortController fed by either the client signal or our 5-minute idle
  // safety net. EventSource auto-reconnects on disconnect, so the client's
  // NEXT connection will get a fresh stream — no need to keep this one open.
  const abortController = new AbortController();
  const idleTimeout = setTimeout(() => abortController.abort(), 5 * 60_000);

  let closed = false;
  const safeClose = () => {
    if (closed) return;
    closed = true;
    clearTimeout(idleTimeout);
    try { abortController.abort(); } catch { /* noop */ }
  };

  // Tie upstream abort to client disconnect
  if (request.signal) {
    if (request.signal.aborted) safeClose();
    request.signal.addEventListener('abort', safeClose, { once: true });
  }

  const stream = new ReadableStream({
    start(controller) {
      const write = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          safeClose();
        }
      };

      // Initial meta event so the client can show a connection badge immediately
      write('meta', {
        type: 'meta',
        kind: 'stream-open',
        mode: cfg.mode,
        backend: cfg.sseUrl && cfg.mode === 'live' ? 'txline-sse' : 'polling',
        pollIntervalMs: cfg.pollIntervalMs,
        timestamp: new Date().toISOString(),
      });

      // Heartbeat every 25s. EventSource considers a connection dead after
      // ~30-60s of silence; periodic comments keep the TCP path warm.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          safeClose();
        }
      }, 25_000);

      // Pump the upstream generator
      (async () => {
        try {
          for await (const delta of txlineService.streamFixtureUpdates({
            signal: abortController.signal,
          })) {
            if (closed) return;
            // meta deltas are diagnostic; surface them as a separate event so
            // the client can update its connection badge (e.g. fallback notice)
            const eventName =
              delta.type === 'meta'
                ? 'meta'
                : delta.type === 'odds'
                  ? 'odds'
                  : delta.type === 'score'
                    ? 'score'
                    : 'update';
            write(eventName, delta);
          }
        } catch (err) {
          if (!closed) {
            write('meta', { type: 'meta', kind: 'stream-error', error: err.message });
          }
        } finally {
          clearInterval(heartbeat);
          safeClose();
          try { controller.close(); } catch { /* already closed */ }
        }
      })();
    },
    cancel() {
      safeClose();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}