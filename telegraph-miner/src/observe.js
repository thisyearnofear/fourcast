/**
 * What this miner is actually asked, what it actually answered, and which
 * upstream failed — kept in memory so it can be read from outside.
 *
 * Season I scored this miner 0 on GAME_RESULT and we could not tell whether the
 * answer was wrong, never arrived, or had nothing to be graded against. This
 * module exists so that question has an answer next time:
 *
 *   GET /api/asked   last ASKED_MAX requests + outcome counters
 *   GET /health      status "degraded" when an upstream failed more recently
 *                    than it succeeded (still HTTP 200 — the node's liveness
 *                    check reads the word, and a 503 for someone else's outage
 *                    gets a miner deregistered)
 *
 * Everything here is per-process and forgotten on restart. That is enough: the
 * point is what the node asks and how we answer, not long-run totals.
 *
 * Privacy: request bodies from the network are stored truncated, with no IP
 * address. The endpoint is public and unauthenticated by design.
 */

export const ASKED_MAX = 50;
const TEXT_MAX = 200;

const asked = [];
const outcomes = Object.create(null);
const upstreams = Object.create(null);
const startedAt = new Date().toISOString();

function clip(value) {
  if (value == null) return null;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > TEXT_MAX ? `${s.slice(0, TEXT_MAX)}…` : s;
}

/**
 * Record one /query exchange.
 *
 * `outcome` is one of: answered | no_result | unsupported | bad_request | error.
 * Those are the distinctions Season I could not make from the score alone.
 */
export function recordAsk({ body, intent, params, outcome, source, reason, latencyMs, userAgent }) {
  const raw = body && typeof body === 'object' ? body : {};
  // Which field the question arrived in — the router and the docs disagree
  // about this, so it is the first thing worth seeing.
  const field = ['query', 'q', 'question', 'text', 'prompt', 'input'].find(
    (k) => typeof raw[k] === 'string' && raw[k].trim()
  );

  asked.unshift({
    at: new Date().toISOString(),
    declared_intent: typeof raw.intent === 'string' ? raw.intent : null,
    resolved_intent: intent ?? null,
    question_field: field ?? null,
    question: field ? clip(raw[field]) : null,
    body_keys: Object.keys(raw).slice(0, 20),
    params: params ? clip(params) : null,
    outcome,
    source: source ?? null,
    reason: clip(reason),
    latency_ms: latencyMs ?? null,
    user_agent: clip(userAgent)?.slice(0, 80) ?? null,
  });
  if (asked.length > ASKED_MAX) asked.length = ASKED_MAX;

  outcomes[outcome] = (outcomes[outcome] || 0) + 1;
}

export function askedReport() {
  const total = Object.values(outcomes).reduce((a, b) => a + b, 0);
  return {
    since: startedAt,
    total,
    outcomes: { ...outcomes },
    max: ASKED_MAX,
    asked: asked.slice(),
  };
}

/** Wrap an upstream call so its last success and last failure are recorded. */
export async function track(name, fn) {
  const entry = (upstreams[name] ??= { ok: 0, failed: 0, last_ok: null, last_fail: null, last_error: null });
  try {
    const out = await fn();
    entry.ok += 1;
    entry.last_ok = new Date().toISOString();
    return out;
  } catch (err) {
    entry.failed += 1;
    entry.last_fail = new Date().toISOString();
    entry.last_error = clip(err?.message ?? String(err));
    throw err;
  }
}

/**
 * Upstream ledger. An upstream is degraded when it has failed and has not
 * succeeded since. The miner as a whole is degraded only when every upstream
 * that has been called is degraded — one working result source still answers.
 */
export function upstreamReport() {
  const calls = {};
  const called = [];
  for (const [name, e] of Object.entries(upstreams)) {
    const degraded = Boolean(e.last_fail) && (!e.last_ok || e.last_fail > e.last_ok);
    calls[name] = { ...e, degraded };
    called.push(degraded);
  }
  return { calls, degraded: called.length > 0 && called.every(Boolean) };
}

/** Test hook. */
export function resetObservations() {
  asked.length = 0;
  for (const k of Object.keys(outcomes)) delete outcomes[k];
  for (const k of Object.keys(upstreams)) delete upstreams[k];
}
