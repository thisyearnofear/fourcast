/**
 * Walrus Memory text contract (`fourcast.memory/v1`)
 *
 * MemWal gives us three things and takes away three:
 *   - namespaces are FLAT, exact-match strings (no hierarchy, no prefix search)
 *   - remember() is APPEND-ONLY — there is no upsert, so a corrected number is
 *     a new memory, not an edit
 *   - recall() is SIMILARITY-ranked and returns decrypted text, while
 *     listMemories() returns metadata only (no text)
 *
 * So the key cannot live in the namespace (one namespace per analyst would be
 * unenumerable and would blow past the 255-byte cap on a busy ledger). It lives
 * in the text, as a machine-parseable first line:
 *
 *   analyst 0xabc… v=7 as_of=2026-10-21T00:00:00Z n=142 brier=0.1871 logloss=0.5123 hit=0.6338 buckets=LOW:0.410/MED:0.580/HIGH:0.790 trigger_receipt=<sha256> source=db:signals+agent_forecasts
 *
 * Retrieval is semantic (that is what the relayer is good at); truth is this
 * deterministic parse. When the two disagree, the parse wins.
 *
 * Field values are forbidden from containing whitespace or '=' so the header
 * round-trips without quoting. Everything is ASCII: a non-ASCII byte in a memory
 * text is a silent UTF-8 decrypt failure waiting to happen in `restore()`.
 */

import crypto from 'crypto';

export const MEMORY_SCHEMA = 'fourcast.memory/v1';

/** Four flat namespaces, one per memory kind. Exact-match, ≤255 bytes. */
export const NAMESPACES = Object.freeze({
  analyst: 'fourcast.analyst',
  source: 'fourcast.source',
  signal: 'fourcast.signal',
  window: 'fourcast.window',
});

export const KINDS = Object.freeze(Object.keys(NAMESPACES));

const NAMESPACE_MAX_BYTES = 255;

/** Values we emit for a metric we genuinely do not have. Never a guess. */
export const UNKNOWN = 'NA';

function bad(msg) {
  const err = new Error(msg);
  err.code = 'MEMORY_FORMAT';
  return err;
}

export function isKnownKind(kind) {
  return Object.prototype.hasOwnProperty.call(NAMESPACES, kind);
}

export function namespaceFor(kind) {
  const ns = NAMESPACES[kind];
  if (!ns) throw bad(`Unknown memory kind: ${JSON.stringify(kind)} (kinds: ${KINDS.join(', ')})`);
  if (Buffer.byteLength(ns, 'utf8') > NAMESPACE_MAX_BYTES) {
    throw bad(`Namespace ${ns} exceeds the ${NAMESPACE_MAX_BYTES}-byte MemWal limit`);
  }
  return ns;
}

export function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/**
 * The SDK scopes idempotency keys per (owner, namespace) and answers 409 if a
 * key is reused with different text, so the key must bind the content: same
 * facts → same key (retry collapses), changed facts → new key (append).
 */
export function buildIdempotencyKey({ kind, key, version, contentHash }) {
  if (!isKnownKind(kind)) throw bad(`Unknown memory kind: ${kind}`);
  if (!key) throw bad('buildIdempotencyKey requires the memory key');
  if (!Number.isInteger(version) || version < 1) throw bad('buildIdempotencyKey requires an integer version >= 1');
  return sha256Hex(`${kind}|${key}|v${version}|${contentHash}`);
}

function sanitizeKey(key) {
  const value = String(key ?? '').trim();
  if (!value) throw bad('Memory key is required');
  if (/\s/.test(value)) throw bad(`Memory key may not contain whitespace: ${JSON.stringify(value)}`);
  if (!/^[\x21-\x7E]+$/.test(value)) throw bad(`Memory key must be printable ASCII: ${JSON.stringify(value)}`);
  if (value.length > 128) throw bad(`Memory key exceeds 128 chars (${value.length})`);
  return value;
}

function sanitizeValue(name, value) {
  if (value === null || value === undefined || value === '') return UNKNOWN;
  const out = String(value);
  if (/[\s=]/.test(out)) throw bad(`Field ${name} may not contain whitespace or '=': ${JSON.stringify(out)}`);
  if (!/^[\x21-\x7E]*$/.test(out)) throw bad(`Field ${name} must be printable ASCII: ${JSON.stringify(out)}`);
  return out;
}

/**
 * Fixed-point, or UNKNOWN when the number is missing.
 *
 * `null` is checked before `Number()` because Number(null) is 0 — the same
 * absent-becomes-a-zero confusion that made the calibration curve plot every
 * bucket at hit rate 0. A missing metric is written as NA, never as 0.
 */
export function num(value, digits = 4) {
  if (value === null || value === undefined || value === '') return UNKNOWN;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : UNKNOWN;
}

/** `LOW:0.410/MED:0.580/HIGH:0.790` — the shape WP3 reads back for sizing. */
export function bucketField(buckets) {
  if (!buckets) return UNKNOWN;
  const entries = Array.isArray(buckets)
    ? buckets.filter((b) => b?.bucket).map((b) => [b.bucket, b.hitRate ?? b.hit_rate])
    : Object.entries(buckets).map(([bucket, value]) => [
        bucket,
        value && typeof value === 'object' ? value.hitRate : value,
      ]);
  const parts = entries
    .filter(([, rate]) => rate !== null && rate !== undefined && Number.isFinite(Number(rate)))
    .map(([bucket, rate]) => `${String(bucket).toUpperCase()}:${num(rate, 3)}`);
  return parts.length ? parts.join('/') : UNKNOWN;
}

/**
 * `polymarket:9/kalshi:3` — a breakdown by whichever label the row carries.
 * Deliberately counts only: no rate is emitted here, because a per-venue hit
 * rate belongs on the row that can state its own sample size. Also carries the
 * per-bucket counts (`HIGH:21`), which is what lets a stored bucket rate clear
 * the same evidence floor the live curve applies.
 */
export function sourceField(sources) {
  if (!sources) return UNKNOWN;
  const list = Array.isArray(sources) ? sources : [sources];
  const parts = list
    .filter(Boolean)
    .map((s) => {
      const label = typeof s === 'object' ? s.source ?? s.venue ?? s.outcome ?? s.bucket ?? s.key : s;
      const count = typeof s === 'object' ? s.count : 1;
      return `${String(label).replace(/\s+/g, '_')}:${num(count, 0)}`;
    });
  return parts.length ? parts.join('/') : UNKNOWN;
}

/**
 * One line per memory kind, all of them carrying the same spine (`kind key v
 * as_of trigger_receipt source`) plus their own metrics. `note` is an optional
 * second line: it exists so `recall()` has prose to embed against, and it is
 * built from the same facts as the header — never a claim the header lacks.
 */
export function formatMemory({ kind, key, fields = {}, note = null }) {
  const safeKind = String(kind);
  if (!isKnownKind(safeKind)) throw bad(`Unknown memory kind: ${safeKind}`);
  const safeKey = sanitizeKey(key);

  const ordered = [
    ['v', sanitizeValue('v', fields.v)],
    ['as_of', sanitizeValue('as_of', fields.as_of)],
    ...Object.entries(fields)
      .filter(([name]) => name !== 'v' && name !== 'as_of')
      .map(([name, value]) => [name, sanitizeValue(name, value)]),
  ];

  const header = [safeKind, safeKey, ...ordered.map(([name, value]) => `${name}=${value}`)].join(' ');
  if (!note) return header;

  // Control characters go, but tab and newline survive: the single-line rule
  // below has to be able to *see* a multi-line note and reject it, rather than
  // quietly concatenating it into the memory. (A code-point filter rather than
  // /[\x00-\x08\x0B-\x1F\x7F]/, which eslint blocks as no-control-regex.)
  const prose = String(note)
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 0x09 || code === 0x0a) return true;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .trim();
  if (!prose) return header;
  if (/\n/.test(prose)) throw bad('Memory note must be a single line');
  return `${header}\n${prose}`;
}

/**
 * Deterministic truth: parse the header. A text that does not parse is reported
 * as such — it is never coerced into a partial record, because a half-parsed
 * credibility number is exactly the class of bug WP1 removed.
 */
export function parseMemoryText(text) {
  const firstLine = String(text ?? '').split('\n')[0].trim();
  if (!firstLine) return { ok: false, error: 'empty text' };

  const tokens = firstLine.split(/\s+/);
  if (tokens.length < 2) return { ok: false, error: `header too short: ${firstLine.slice(0, 80)}` };

  const [kind, key, ...rest] = tokens;
  if (!isKnownKind(kind)) return { ok: false, error: `unknown kind ${kind}` };

  const fields = {};
  for (const token of rest) {
    const idx = token.indexOf('=');
    if (idx < 1) return { ok: false, error: `malformed field ${token}` };
    fields[token.slice(0, idx)] = token.slice(idx + 1);
  }

  const note = String(text ?? '').split('\n').slice(1).join('\n').trim() || null;
  return { ok: true, schema: MEMORY_SCHEMA, kind, key, fields, note, header: firstLine };
}

export function isUnknown(value) {
  return value === undefined || value === null || value === UNKNOWN;
}

/** `NA` round-trips as null so callers can tell "absent" from "zero". */
export function fieldValue(fields, name) {
  const raw = fields?.[name];
  return isUnknown(raw) ? null : raw;
}

export function fieldNumber(fields, name) {
  const raw = fieldValue(fields, name);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Buckets as `{HIGH: 0.79, ...}` for Kelly sizing. Unparseable bucket strings
 * yield null rather than a partial object — a missing bucket means "factor
 * 1.0, no shrinkage", which is the fail-closed direction.
 */
export function fieldBuckets(fields, name = 'buckets') {
  const raw = fieldValue(fields, name);
  if (raw === null) return null;
  const out = {};
  for (const part of String(raw).split('/')) {
    const idx = part.indexOf(':');
    if (idx < 1) return null;
    const bucket = part.slice(0, idx).toUpperCase();
    const rate = Number(part.slice(idx + 1));
    if (!Number.isFinite(rate)) return null;
    out[bucket] = rate;
  }
  return Object.keys(out).length ? out : null;
}
