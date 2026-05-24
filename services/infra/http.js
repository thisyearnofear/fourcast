/**
 * HTTP Resilience Primitives
 *
 * Shared infrastructure for all external API calls (Polymarket, Kalshi,
 * Venice, SynthData, OpenMeteo). Eliminates bespoke error handling in each
 * provider by providing a single, tested primitive.
 *
 * Features:
 *  - ProviderError (standard error type)
 *  - CircuitBreaker (per-provider state machine)
 *  - fetchWithBudget (timeout + retries + circuit-breaker integration)
 *  - Simple in-memory TTL cache
 */

// ─── ProviderError ──────────────────────────────────────────────────────────

export class ProviderError extends Error {
  /**
   * @param {string} provider  – short name, e.g. "polymarket", "kalshi", "venice"
   * @param {string} code      – machine-readable code, e.g. "TIMEOUT", "RATE_LIMITED"
   * @param {string} message   – human-readable message
   * @param {object} [options]
   * @param {boolean} [options.retryable=true]  – whether the operation can be retried
   * @param {number}  [options.statusCode]       – HTTP status code if applicable
   */
  constructor(provider, code, message, options = {}) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.code = code;
    this.retryable = options.retryable !== false;
    this.statusCode = options.statusCode;

    // Capture stack, keeping constructor out of the trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

/**
 * Per-provider circuit breaker.
 *
 * After `failureThreshold` consecutive failures the circuit opens.
 * After `resetTimeoutMs` it transitions to half-open; if the next call
 * succeeds it closes, otherwise it re-opens.
 */
class CircuitBreaker {
  constructor(options = {}) {
    this._failureThreshold = options.failureThreshold ?? 5;
    this._halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1;
    this._resetTimeoutMs = options.resetTimeoutMs ?? 30_000;

    this._state = STATE.CLOSED;
    this._failureCount = 0;
    this._lastFailureTime = 0;
    this._halfOpenCalls = 0;
  }

  get state() { return this._state; }

  /** Call before every external request. Throws if the circuit is open. */
  call() {
    this._tryTransition();

    if (this._state === STATE.OPEN) {
      throw new ProviderError(
        this._provider,
        'CIRCUIT_OPEN',
        `Circuit breaker open for ${this._provider}. ` +
        `Retry after ${Math.ceil((this._lastFailureTime + this._resetTimeoutMs - Date.now()) / 1000)}s.`,
        { retryable: true },
      );
    }
  }

  /** Call after a successful request. */
  success() {
    if (this._state === STATE.HALF_OPEN) {
      this._halfOpenCalls = 0;
    }
    this._state = STATE.CLOSED;
    this._failureCount = 0;
  }

  /** Call after a failed request. */
  failure() {
    this._failureCount += 1;
    this._lastFailureTime = Date.now();

    if (this._state === STATE.HALF_OPEN) {
      this._state = STATE.OPEN;
      this._halfOpenCalls = 0;
    } else if (this._failureCount >= this._failureThreshold) {
      this._state = STATE.OPEN;
    }
  }

  reset() {
    this._state = STATE.CLOSED;
    this._failureCount = 0;
    this._lastFailureTime = 0;
    this._halfOpenCalls = 0;
  }

  // ── private ──

  set _provider(val) { /* noop — kept for getter consistency */ }
  get _provider() { return 'unknown'; }

  _tryTransition() {
    if (this._state === STATE.OPEN &&
        Date.now() - this._lastFailureTime >= this._resetTimeoutMs) {
      this._state = STATE.HALF_OPEN;
      this._halfOpenCalls = 0;
    }
    if (this._state === STATE.HALF_OPEN) {
      if (this._halfOpenCalls >= this._halfOpenMaxCalls) {
        throw new ProviderError(
          this._provider,
          'CIRCUIT_HALF_BUSY',
          `Circuit half-open; max probe calls (${this._halfOpenMaxCalls}) reached.`,
          { retryable: true },
        );
      }
      this._halfOpenCalls += 1;
    }
  }
}

const circuitBreakers = new Map();

function getCircuitBreaker(provider) {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, new CircuitBreaker());
  }
  return circuitBreakers.get(provider);
}

/**
 * Reset circuit breaker state for a provider (useful for testing or
 * administrative recovery).
 */
export function resetCircuitBreaker(provider) {
  const cb = circuitBreakers.get(provider);
  if (cb) cb.reset();
}

// ─── In-memory TTL cache ───────────────────────────────────────────────────

const cacheStore = new Map();

/**
 * Thin in-memory TTL cache.  Keys are auto-derived from the request params.
 * For Redis-backed caching see services/redisService.js.
 */
export function clearMemoryCache() {
  cacheStore.clear();
}

function cacheGet(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs) {
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function cacheKey(url, options) {
  const body = options.body ? `:${typeof options.body === 'string' ? options.body : JSON.stringify(options.body)}` : '';
  return `${options.method || 'GET'}:${url}${body}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const _noop = () => {};

/**
 * Create an AbortSignal that fires after `timeoutMs`.
 * Falls back to a no-op if `AbortSignal.timeout` is unavailable.
 */
function _abortSignal(timeoutMs) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  // Node < 16 / edge polyfill
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Sleep helper for retry back-off.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── fetchWithBudget ────────────────────────────────────────────────────────

/**
 * Unified external-request primitive.
 *
 * Every external provider call should go through this function to get
 * timeout, retries, circuit-breaker protection, and optional caching.
 *
 * @param {string}  url                     – full URL to fetch
 * @param {object}  [options]
 * @param {string}  [options.provider]      – provider name (for circuit breaker & error reporting)
 * @param {object}  [options.fetchOptions]  – options passed to the `fetch()` call
 * @param {string}  [options.method]        – HTTP method (default "GET")
 * @param {object}  [options.headers]       – request headers
 * @param {*}       [options.body]          – request body (auto-stringified if object)
 * @param {number}  [options.timeoutMs=10000]
 * @param {number}  [options.retries=2]     – number of *additional* attempts after first failure
 * @param {number}  [options.cacheTtlMs]    – if set, cache the response for this many ms
 * @param {boolean} [options.circuitBreaker=true]
 * @param {(attempt: number) => number} [options.backoffMs]
 *        Custom back-off function.  Defaults to `attempt * 1000` (1s, 2s, …).
 * @returns {Promise<{ data: any, cached: boolean, durationMs: number }>}
 */
export async function fetchWithBudget(url, options = {}) {
  const {
    provider = 'unknown',
    fetchOptions = {},
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 10_000,
    retries = 2,
    cacheTtlMs,
    circuitBreaker: useCircuitBreaker = true,
    backoffMs = (attempt) => attempt * 1000,
  } = options;

  // Normalise body
  const finalBody = body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams)
    ? JSON.stringify(body)
    : body;

  const mergedFetchOptions = {
    ...fetchOptions,
    method,
    headers: {
      'Accept': 'application/json',
      ...(finalBody ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(finalBody ? { body: finalBody } : {}),
  };

  // Cache check
  if (cacheTtlMs && method === 'GET') {
    const cached = cacheGet(cacheKey(url, mergedFetchOptions));
    if (cached != null) {
      return { data: cached, cached: true, durationMs: 0 };
    }
  }

  // Circuit-breaker check
  const cb = useCircuitBreaker ? getCircuitBreaker(provider) : null;
  if (cb) cb.call();

  const start = Date.now();
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...mergedFetchOptions,
        signal: mergedFetchOptions.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      // Rate-limit handling
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        if (attempt < retries) {
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new ProviderError(provider, 'RATE_LIMITED',
          `Rate limited by ${provider}. Retry-After: ${retryAfter}s.`,
          { retryable: true, statusCode: 429 });
      }

      // Server errors (5xx) are retryable
      if (response.status >= 500 && attempt < retries) {
        await sleep(backoffMs(attempt + 1));
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const code = response.status >= 500 ? 'SERVER_ERROR'
                   : response.status === 404 ? 'NOT_FOUND'
                   : response.status === 403 ? 'FORBIDDEN'
                   : response.status === 401 ? 'UNAUTHORIZED'
                   : 'HTTP_ERROR';
        throw new ProviderError(provider, code,
          `${provider} returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
          { retryable: response.status >= 500 || response.status === 429, statusCode: response.status });
      }

      // Parse body
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      const durationMs = Date.now() - start;

      // Mark success on circuit breaker
      if (cb) cb.success();

      // Cache successful GET responses
      if (cacheTtlMs && method === 'GET') {
        cacheSet(cacheKey(url, mergedFetchOptions), data, cacheTtlMs);
      }

      return { data, cached: false, durationMs };
    } catch (err) {
      lastError = err;

      // Don't retry if already a ProviderError with retryable=false
      if (err instanceof ProviderError && !err.retryable) break;

      // Don't retry aborts beyond the first attempt (timeout)
      if (err.name === 'AbortError') {
        lastError = new ProviderError(provider, 'TIMEOUT',
          `Request to ${provider} timed out after ${timeoutMs}ms.`,
          { retryable: true });
        if (attempt >= retries) break;
        await sleep(backoffMs(attempt + 1));
        continue;
      }

      if (attempt < retries) {
        await sleep(backoffMs(attempt + 1));
      }
    }
  }

  // Report failure to circuit breaker
  if (cb) cb.failure();

  // Wrap non-ProviderError as ProviderError
  if (!(lastError instanceof ProviderError)) {
    lastError = new ProviderError(provider, 'UNKNOWN',
      lastError?.message || `Request to ${provider} failed.`,
      { retryable: true });
  }

  throw lastError;
}

// ─── Convenience wrappers ───────────────────────────────────────────────────

export const http = {
  get: (url, opts) => fetchWithBudget(url, { ...opts, method: 'GET' }),
  post: (url, opts) => fetchWithBudget(url, { ...opts, method: 'POST' }),
  put: (url, opts) => fetchWithBudget(url, { ...opts, method: 'PUT' }),
  del: (url, opts) => fetchWithBudget(url, { ...opts, method: 'DELETE' }),
};
