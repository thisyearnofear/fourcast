/**
 * Evidence Retriever — Exa search as the forecaster's grounding layer.
 *
 * Purpose-built retrieval for LLM reasoning: one POST per question returns
 * recent, citable web snippets (title/url/publishedDate/text) that get
 * injected straight into the forecast prompt. Provider-agnostic — works with
 * NVIDIA's free llama, OpenRouter, Venice, whatever answers next.
 *
 * Cost: ~$0.005/query with text contents. A 6h per-question cache caps spend
 * (hourly agent cycles → ≤4 refreshes/question/day).
 */

if (typeof window !== 'undefined') {
  throw new Error('evidenceRetriever is server-only');
}

const ENDPOINT = 'https://api.exa.ai/search';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

/**
 * Retrieve web evidence for a market question.
 * @param {string} question
 * @param {{ numResults?: number, maxCharacters?: number }} opts
 * @returns {Promise<{ query: string, snippets: Array<{title: string, url: string,
 *           publishedDate: string|null, text: string}> } | null>}
 */
export async function retrieveEvidence(question, { numResults = 5, maxCharacters = 700 } = {}) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey || !question) return null;

  const key = `${question.toLowerCase().trim()}|${numResults}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.value;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: question,
        type: 'auto',
        numResults,
        contents: { text: { maxCharacters } },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[evidenceRetriever] exa ${res.status}: ${body.slice(0, 120)}`);
      return null;
    }

    const data = await res.json();
    const snippets = (data.results || [])
      .map((r) => ({
        title: r.title || '',
        url: r.url || '',
        publishedDate: r.publishedDate || null,
        text: (r.text || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((s) => s.text.length > 40);

    if (snippets.length === 0) return null;
    const value = { query: question, snippets };
    cache.set(key, { ts: Date.now(), value });
    return value;
  } catch (err) {
    console.warn(`[evidenceRetriever] failed: ${err.message.slice(0, 100)}`);
    return null;
  }
}

export default { retrieveEvidence };
