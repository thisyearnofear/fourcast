/**
 * Streaming analysis transport — POST to /api/analyze/stream and surface
 * progress + final result to the caller.
 *
 * Extracted from app/markets/page.js so the page shell stays thin and the
 * stream contract has one home.
 */

/**
 * Map the server's semantic stage names to a 0..3 ordinal used by the UI
 * (loading dots progress + LoadingAnalysisState). Unknown stages fall back
 * to 0 so progress never goes backwards.
 */
export const STAGE_INDEX = {
 accepted: 0,
 context: 0,
 market: 1,
 sources: 1,
 forecast: 2,
 complete: 3,
};

/**
 * POST a payload to /api/analyze/stream and consume the chunked NDJSON
 * event stream. Calls `onStage(ordinal)` whenever the server emits a stage
 * event, and resolves with the final `complete`/`error` payload.
 *
 * Throws on transport failure or when the result reports `success: false`.
 * The thrown error carries `.status` so callers can detect 429s.
 */
export async function requestStreamingAnalysis(payload, onStage) {
 const response = await fetch('/api/analyze/stream', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });

 if (!response.body) throw new Error('Analysis stream unavailable');

 const reader = response.body.getReader();
 const decoder = new TextDecoder();
 let buffer = '';
 let complete = null;

 let streamDone = false;
 while (!streamDone) {
 const { done, value } = await reader.read();
 streamDone = done;
 buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
 const lines = buffer.split('\n');
 buffer = lines.pop() || '';

 for (const line of lines) {
 if (!line.trim()) continue;
 const event = JSON.parse(line);
 if (event.type === 'stage') onStage(STAGE_INDEX[event.stage] ?? 0);
 if (event.type === 'complete' || event.type === 'error') complete = event;
 }
 }

 if (!complete) throw new Error('Analysis stream ended without a result');
 if (!complete.success) {
 const error = new Error(complete.error || 'Analysis failed');
 error.status = complete.status;
 throw error;
 }
 return complete;
}
