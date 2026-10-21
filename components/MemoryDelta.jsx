'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Link2, RefreshCw, ShieldCheck } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';

const mono = { fontFamily: 'var(--font-mono, monospace)' };

/**
 * MemoryDelta — the Memory lane on /arena.
 *
 * One job: show what Fourcast remembered, and what the memory did to a
 * position. Everything here is read from our own two endpoints; nothing is
 * parsed or computed in the browser that the server also computes, because a
 * lane that re-derives Kelly client-side would be a simulation of the demo.
 * That is also why the rung travels as `memory=1` and not as `buckets=`: a
 * number the page pasted into a query string cannot prove anything about the
 * blob it claims to come from.
 *
 * Spend discipline, inherited from /api/memory/status: the page load costs ONE
 * local read (config + ledger). Reading the version ladder costs a relayer
 * `recall()` for the ladder plus one for the rung the sizing reads, and proving
 * an object costs a Tatum call — so all of it sits behind explicit buttons,
 * labelled with what they will do.
 */

function rate(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function short(value, head = 10, tail = 6) {
  const text = String(value || '');
  if (!text) return '—';
  return text.length > head + tail + 1 ? `${text.slice(0, head)}…${text.slice(-tail)}` : text;
}

function Chip({ label, value, tone = 'neutral', title }) {
  const color =
    tone === 'good' ? 'var(--color-accent)'
      : tone === 'warn' ? 'var(--color-sealed)'
        : tone === 'bad' ? 'var(--color-breach)'
          : 'var(--color-ink-muted)';
  return (
    <span
      className="px-2 py-1 text-[10px] tracking-wider"
      style={{ color, border: `1px solid ${color}`, ...mono }}
      title={title}
    >
      <span className="uppercase opacity-70">{label}</span>
      <span className="ml-1.5 font-semibold">{value}</span>
    </span>
  );
}

function SectionTitle({ index, title, aside }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1 sm:px-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        <span className="mr-2" style={{ ...mono, color: 'var(--color-accent)' }}>{index}</span>
        {title}
      </h2>
      {aside && <span className="text-[11px] text-[var(--color-ink-faint])" style={mono}>{aside}</span>}
    </div>
  );
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.success === false) {
    throw new Error(body?.error || body?.notes?.[0] || `${res.status} ${res.statusText}`);
  }
  return body;
}

/**
 * The what-if URL. With `relayer`, the route reads the newest usable rung itself
 * (one recall() we asked for by clicking) instead of trusting rates this page
 * could have typed.
 */
function whatifUrl({ relayer = false } = {}) {
  return relayer ? '/api/decision/whatif?memory=1' : '/api/decision/whatif';
}

export function MemoryDelta() {
  const [status, setStatus] = useState(null);
  const [rungs, setRungs] = useState(null);
  const [delta, setDelta] = useState(null);
  const [deltaError, setDeltaError] = useState(null);
  const [proofs, setProofs] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  // One local read on mount: config + ledger. No relayer, no chain.
  const loadStatus = useCallback(async () => {
    setBusy('status');
    try {
      const body = await getJson('/api/memory/status');
      setStatus(body);
      setError(null);
      return body;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // The sizing delta always comes from our own route: cheap, no chain spend.
  const loadDelta = useCallback(async (opts = {}) => {
    setBusy('delta');
    try {
      setDelta(await getJson(whatifUrl(opts)));
      setDeltaError(null);
    } catch (err) {
      // A failed read must not leave the panel saying "Recomputing…" forever —
      // that is the difference between a slow surface and a lying one.
      setDeltaError(err.message);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (status && !delta) loadDelta();
  }, [status, delta, loadDelta]);

  const readLadder = useCallback(async () => {
    if (!status?.memory?.writable) return;
    setBusy('ladder');
    try {
      const key = status.rows?.find((r) => r.kind === 'window')?.memkey || null;
      const query = key ? `?ladder=1&kind=window&key=${encodeURIComponent(key)}` : '?ladder=1&kind=window';
      const body = await getJson(`/api/memory/status${query}`);
      setRungs(body.rungs || []);
      await loadDelta({ relayer: true });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }, [status, loadDelta]);

  const proveOnChain = useCallback(async () => {
    setBusy('proof');
    try {
      const body = await getJson('/api/memory/status?proof=1');
      setProofs(body.proofs || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }, []);

  const confirmed = status?.ledger?.mainnetConfirmed ?? 0;
  const proofByBlob = useMemo(() => {
    const map = new Map();
    for (const p of proofs || []) map.set(p.blobId, p.onchain);
    return map;
  }, [proofs]);

  if (!status) {
    return (
      <section className="mt-6 px-1 sm:px-3" aria-live="polite">
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          {error ? `Memory status unavailable: ${error}` : 'Reading the memory ledger…'}
        </p>
      </section>
    );
  }

  const chains = status.chains || {};
  const ladderRows = rungs?.length ? rungs : (status.rows || []).filter((r) => r.blob_id);

  return (
    <>
      {/* ── Spine: what exists, on which chain ──────────────────────── */}
      <Reveal>
        <section className="mt-6 px-1 sm:px-3" aria-label="Memory state">
          <div className="flex flex-wrap items-center gap-3">
            <Boxes className="h-4 w-4 text-[var(--color-evidence)]" aria-hidden="true" />
            <p className="text-[13px] text-[var(--color-ink)]">
              <span className="font-semibold">{confirmed}</span> memory{' '}
              {confirmed === 1 ? 'rung' : 'rungs'} confirmed on mainnet,{' '}
              <span className="font-semibold">{status.ledger.confirmed}</span> anywhere.
            </p>
            {!status.memory.writable && (
              <span className="text-[12px] text-[var(--color-ink-faint)]">
                not writable here — {status.memory.reason}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip label="memory" value={chains.memory || '—'} tone={chains.memory === 'mainnet' ? 'good' : 'warn'}
              title="SUI_NETWORK — where append-only memories are written" />
            <Chip label="settlement" value={chains.settlement || '—'}
              tone={chains.aligned ? 'good' : 'warn'}
              title="SETTLEMENT_NETWORK — where a paid answer settles" />
            <Chip label="aligned" value={chains.aligned ? 'yes' : 'no'}
              tone={chains.aligned ? 'good' : 'bad'}
              title={chains.aligned
                ? 'Memories and payments read the same chain'
                : 'The x402 verifier refuses a cross-chain read, so the paid rail is dark until SETTLEMENT_NETWORK and SUI_NETWORK agree (decision gate 1 Nov)'} />
            <a
              href={status.memory.relayerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-[10px] tracking-wider text-[var(--color-ink-muted)]"
              style={{ border: '1px solid var(--color-rule)', ...mono }}
            >
              relayer
            </a>
          </div>
          {chains.aligned === false && (
            <p className="mt-2 max-w-prose text-[11px] leading-5 text-[var(--color-ink-faint)]">
              The paid rail is dark until <span style={mono}>SETTLEMENT_NETWORK</span> names the chain
              the memories live on: the verifier refuses a cross-chain read rather than check a payment
              against the wrong ledger.
            </p>
          )}
        </section>
      </Reveal>

      {/* ── 01 The ladder ───────────────────────────────────────────── */}
      <Reveal>
        <section className="mt-8 first:mt-6" aria-label="Memory version ladder">
          <SectionTitle
            index="01"
            title="Version ladder"
            aside={rungs ? `${rungs.length} rung(s) from the relayer` : 'local intent ledger'}
          />
          <div style={{ borderTop: '1px solid var(--color-rule-strong)', borderBottom: '1px solid var(--color-rule)' }}>
            {ladderRows.length === 0 ? (
              <p className="px-1 py-4 text-[13px] text-[var(--color-ink-faint)] sm:px-3">
                Nothing appended yet. A rung appears when a forecast resolves and the
                resulting metric clears the sample floor — never on a timer, and never
                a number we cannot trace.
              </p>
            ) : (
              <ul>
                {ladderRows.map((row, i) => {
                  const blobId = row.blobId || row.blob_id;
                  const onchain = proofByBlob.get(blobId);
                  return (
                    <li
                      key={`${row.kind}-${row.key || row.memkey}-${row.version}-${i}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 py-3 sm:px-3"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-rule)' }}
                    >
                      <span className="text-[13px] font-semibold text-[var(--color-ink)]" style={mono}>
                        v{row.version}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-ink)]">
                        {row.kind}:{row.key || row.memkey}
                      </span>
                      {row.fields?.buckets && (
                        <span className="text-[11px] text-[var(--color-ink-muted)]" style={mono} title={row.header || null}>
                          {row.fields.buckets}
                        </span>
                      )}
                      {row.fields?.bucket_n && (
                        <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
                          n={row.fields.bucket_n}
                        </span>
                      )}
                      {!row.fields && row.text_sha256 && (
                        <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono} title="sha256 of the memory text we hold locally">
                          text {short(row.text_sha256, 8, 4)}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-[11px]" style={mono}>
                        {row.blobUrl ? (
                          <a
                            href={row.blobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[var(--color-evidence)] hover:opacity-80"
                            title="Public Walrus read. Returns SEAL ciphertext: the blob id is public, the text is owner-scoped."
                          >
                            <Link2 className="h-3 w-3" aria-hidden="true" />
                            {short(blobId, 8, 6)}
                          </a>
                        ) : (
                          <span className="text-[var(--color-ink-faint)]">blob pending</span>
                        )}
                      </span>
                      {row.trigger_receipt && row.trigger_receipt !== 'NA' && (
                        <span className="text-[10px] text-[var(--color-ink-faint)]" style={mono} title="Receipt this write was triggered by">
                          receipt {short(row.trigger_receipt, 8, 4)}
                        </span>
                      )}
                      {onchain && (
                        <span
                          className="flex items-center gap-1 text-[10px]"
                          style={{ ...mono, color: onchain.exists ? 'var(--color-accent)' : 'var(--color-sealed)' }}
                          title={onchain.render || onchain.reason || null}
                        >
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          {onchain.exists ? 'on chain' : onchain.exists === false ? 'not found' : 'unproven'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 px-1 sm:px-3">
            <button
              type="button"
              onClick={readLadder}
              disabled={!status.memory.writable || busy === 'ladder' || busy === 'delta'}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-[var(--color-evidence)] disabled:opacity-40"
              style={{ border: '1px solid var(--color-evidence)' }}
              title="Costs two relayer recall(): the ladder, then the rung this lane sizes on"
            >
              <RefreshCw size={12} className={busy === 'ladder' ? 'animate-spin' : ''} aria-hidden="true" />
              Read the ladder from the relayer
            </button>
            <button
              type="button"
              onClick={proveOnChain}
              disabled={busy === 'proof' || !confirmed}
              className="px-3 py-1.5 text-[12px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-40"
              style={{ border: '1px solid var(--color-rule)' }}
              title={confirmed ? 'Costs one Tatum sui_getObject per ledger row' : 'Nothing to prove until a write is confirmed'}
            >
              Prove on chain via Tatum
            </button>
            {status.notes?.length > 0 && (
              <p className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
                {status.notes.find((n) => /memory|ladder|SEAL|rung/i.test(n)) || status.notes[0]}
              </p>
            )}
          </div>
        </section>
      </Reveal>

      {/* ── 02 The delta ────────────────────────────────────────────── */}
      <Reveal>
        <section className="mt-10 first:mt-6" aria-label="Position size with and without the memory">
          <SectionTitle
            index="02"
            title="What the memory did to the size"
            aside={delta?.input ? `${delta.input.origin}: ${short(delta.input.question, 28, 8)}` : 'no decision loaded'}
          />
          {!delta ? (
            <p className="px-1 text-[13px] text-[var(--color-ink-muted)] sm:px-3" role={deltaError ? 'alert' : undefined}>
              {deltaError
                ? `Sizing comparison unavailable — ${deltaError}`
                : busy === 'delta' ? 'Recomputing…' : 'Sizing comparison unavailable.'}
            </p>
          ) : !delta.input ? (
            <p className="px-1 text-[13px] leading-6 text-[var(--color-ink-faint)] sm:px-3">
              {delta.notes.join(' ')} The panel recomputes a decision that was actually
              made — it will not invent one to fill the space.
            </p>
          ) : (
            <>
              <div
                className="grid grid-cols-1 gap-px sm:grid-cols-3"
                style={{ background: 'var(--color-rule)', border: '1px solid var(--color-rule)' }}
              >
                {delta.scenarios.map((s) => {
                  const isMemory = s.key === 'memory';
                  const applied = delta.applied?.key === s.key;
                  return (
                    <div
                      key={s.key}
                      className="px-3 py-4"
                      style={{ background: applied ? 'var(--color-accent-soft)' : 'transparent' }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                        {s.label}
                      </p>
                      <p className="mt-2 text-[24px] leading-none text-[var(--color-ink)]" style={mono}>
                        {s.sizePct > 0 ? rate(s.sizePct, 1) : '—'}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]" style={mono}>
                        of bankroll
                      </p>
                      <dl className="mt-3 space-y-1 text-[11px]">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--color-ink-faint)]">factor</dt>
                          <dd className="text-[var(--color-ink)]" style={mono}>
                            {s.calibrationFactor == null ? '1.000×' : `${s.calibrationFactor.toFixed(3)}×`}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--color-ink-faint)]">vs uncalibrated</dt>
                          <dd
                            style={{ ...mono, color: s.deltaVsUncalibrated > 0 ? 'var(--color-accent)'
                              : s.deltaVsUncalibrated < 0 ? 'var(--color-breach)' : 'var(--color-ink-muted)' }}
                          >
                            {s.key === 'uncalibrated' ? '—' : `${s.deltaVsUncalibrated > 0 ? '+' : ''}${(s.deltaVsUncalibrated * 100).toFixed(1)} pp`}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--color-ink-faint)]">evidence</dt>
                          <dd className="truncate text-[var(--color-ink-muted)]" style={mono} title={s.bucketField || 'none'}>
                            {s.buckets ? s.bucketField : 'none'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--color-ink-faint)]">n</dt>
                          <dd className="text-[var(--color-ink-muted)]" style={mono}>{s.sampleSize || '—'}</dd>
                        </div>
                      </dl>
                      {isMemory && (
                        <p
                          className="mt-2 text-[10px] leading-4 text-[var(--color-ink-faint)]"
                          style={mono}
                          title={s.provenance?.textHash ? `text sha256 ${s.provenance.textHash}` : null}
                        >
                          {s.blobId ? `blob ${short(s.blobId, 8, 6)}` : 'no blob on this rung'}
                          {s.provenance?.version != null ? ` · v${s.provenance.version}` : ''}
                          {s.provenance?.asOf ? ` as of ${s.provenance.asOf}` : ''}
                          {s.provenance?.how === 'relayer-recall'
                            ? ' — fetched by this route, not typed in'
                            : s.provenance?.how === 'supplied-by-caller'
                              ? ' — rates passed in by the caller'
                              : ''}
                          {s.droppedBuckets?.length ? ` · dropped ${s.droppedBuckets.map((d) => `${d.bucket}:${d.count ?? 'no n'}`).join(', ')}` : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {!delta.scenarios.some((s) => s.key === 'memory') && (
                <p className="mt-2 px-1 text-[11px] leading-5 text-[var(--color-ink-faint)] sm:px-3" style={mono}>
                  No rung in this comparison yet — the memory column appears once the
                  ladder read above brings one back. Reading it costs a recall(), which
                  is spent on your click and never on your page load.
                </p>
              )}
              <p className="mt-3 px-1 text-[11px] leading-5 text-[var(--color-ink-faint)] sm:px-3">
                {delta.applied.reason} Same Kelly function the agent sizes with —{' '}
                {delta.input.probability != null
                  ? `p=${delta.input.probability} vs market ${delta.input.odds}, ${delta.input.bucket} confidence.`
                  : 'no probability loaded.'}
                {delta.notes.length > 0 && ` (${delta.notes.join(' ')})`}
              </p>
            </>
          )}
        </section>
      </Reveal>

      {error && (
        <p className="mt-4 px-1 text-[12px] text-[var(--color-breach)] sm:px-3" role="status">
          {error}
        </p>
      )}
    </>
  );
}

export default MemoryDelta;
