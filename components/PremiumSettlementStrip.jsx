'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * PremiumSettlementStrip — the paid rail, made visible.
 *
 * WP5 can settle a payment on Sui, but a payment nobody can see is a
 * back-end trick, not a product. This strip is the receipt surface: what the
 * rail is worth, what it settled, and the digest that proves it.
 *
 * Design rules it obeys (docs/DESIGN_CONTRACT.md):
 *   - colour by token name, never a literal; zero radius
 *   - mono for every number that is a claim (amount, digest, timestamps)
 *   - `NA` over `0`: "none yet" is not a zero
 *   - three states, always: loading, empty, error — and the empty state says
 *     WHY it is empty
 *   - the word "verified" is not used here: that word means a real Merkle
 *     root. A payment receipt is *settled* — the money moved and we re-read
 *     the transaction through the Tatum Sui RPC
 */

const EXPLORER_TEMPLATE =
  process.env.NEXT_PUBLIC_SUI_EXPLORER_TX_URL || 'https://suiscan.xyz/{network}/tx/{digest}';

function explorerUrl(network, digest) {
  if (!digest) return null;
  const segment = String(network || '').split(':').pop() || 'testnet';
  try {
    return EXPLORER_TEMPLATE.replace('{network}', segment).replace('{digest}', digest);
  } catch {
    return null;
  }
}

function timeAgo(epochSeconds) {
  if (!epochSeconds) return '—';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - epochSeconds);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function shortDigest(digest) {
  if (!digest) return '—';
  return digest.length > 18 ? `${digest.slice(0, 10)}…${digest.slice(-6)}` : digest;
}

function ReceiptRow({ receipt }) {
  const [open, setOpen] = useState(false);
  const link = explorerUrl(receipt.network, receipt.txDigest);

  return (
    <div style={{ borderTop: '1px solid var(--color-rule)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 text-left sm:px-3"
      >
        <span className="text-[13px] text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-mono)' }}>
          {receipt.amount}
        </span>
        <span className="text-[12px] text-[var(--color-ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
          USDC
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{ color: receipt.status === 'delivered' ? 'var(--color-accent)' : 'var(--color-sealed)' }}
        >
          {receipt.status}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-ink-faint)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {shortDigest(receipt.txDigest)}
        </span>
        <span className="text-[11px] text-[var(--color-ink-faint)]" style={{ fontFamily: 'var(--font-mono)' }}>
          {timeAgo(receipt.createdAt)}
        </span>
        <ChevronDown
          size={14}
          className={`text-[var(--color-ink-faint)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="px-1 pb-3 sm:px-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">digest</dt>
              <dd
                className="min-w-0 break-all text-[11px] text-[var(--color-ink-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {receipt.txDigest || '—'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">network</dt>
              <dd className="text-[11px] text-[var(--color-ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {receipt.network || '—'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">signal</dt>
              <dd
                className="min-w-0 break-all text-[11px] text-[var(--color-ink-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {receipt.signalId || '—'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">blob</dt>
              <dd
                className="min-w-0 break-all text-[11px] text-[var(--color-ink-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {receipt.blobId || '—'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">settled</dt>
              <dd className="text-[11px] text-[var(--color-ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {receipt.deliveredAt ? timeAgo(receipt.deliveredAt) : '—'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">answer</dt>
              <dd
                className="min-w-0 break-all text-[11px] text-[var(--color-ink-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {receipt.answerKey || '—'}
              </dd>
            </div>
          </dl>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-[11px] text-[var(--color-ink-muted)] underline hover:text-[var(--color-ink)]"
            >
              Open the transaction
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function PremiumSettlementStrip() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/signals/premium/settlements?limit=5');
      const payload = await res.json();
      if (!res.ok || payload.success === false) {
        setState({ status: 'error', data: payload, error: payload?.error || 'The settlement ledger could not be read.' });
        return;
      }
      setState({ status: 'ready', data: payload, error: null });
    } catch (err) {
      setState({ status: 'error', data: null, error: err?.message || 'The settlement ledger could not be read.' });
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const data = state.data;
  const network = data?.settlementNetwork || 'sui:testnet';
  const receipts = Array.isArray(data?.settlements) ? data.settlements : [];

  return (
    <section className="mt-4 border-t border-[var(--color-rule)] border-b border-[var(--color-wash)] py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 sm:px-3">
        <h2 className="mc-kicker">Premium · paid on Sui</h2>
        <span className="text-[11px] text-[var(--color-ink-faint)]" style={{ fontFamily: 'var(--font-mono)' }}>
          {network}
        </span>
      </div>

      {state.status === 'loading' && (
        <p className="mt-2 px-1 text-[12px] text-[var(--color-ink-faint)] sm:px-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Reading the settlement ledger…
        </p>
      )}

      {state.status === 'error' && (
        <p
          role="alert"
          className="mt-2 px-1 text-[12px] text-[var(--color-breach)] sm:px-3"
        >
          Could not read the settlement ledger — {state.error}
        </p>
      )}

      {state.status === 'ready' && data && data.enabled === false && (
        <p className="mt-2 px-1 text-[12px] text-[var(--color-ink-muted)] sm:px-3">
          The paid rail is off — <span style={{ fontFamily: 'var(--font-mono)' }}>X402_ENABLED</span> is not set, so a
          premium signal cannot be bought. The free feed is unaffected.
        </p>
      )}

      {state.status === 'ready' && data && data.enabled !== false && receipts.length === 0 && (
        <div className="mt-2 px-1 sm:px-3">
          <p className="text-[12px] text-[var(--color-ink-muted)]">
            The paid rail is on. No premium signal has settled through it yet — the ledger is empty, not broken.
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-ink-faint)]">
            An agent buys one: <span style={{ fontFamily: 'var(--font-mono)' }}>POST /api/signals/premium</span> answers
            402 with the price and the payee; transfer USDC on Sui and resend the request with the{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>X-PAYMENT</span> header.
          </p>
        </div>
      )}

      {state.status === 'ready' && receipts.length > 0 && (
        <>
          <p className="mt-1 px-1 text-[12px] text-[var(--color-ink-muted)] sm:px-3">
            {data?.summary?.settled ?? 0} premium signal{(data?.summary?.settled ?? 0) === 1 ? '' : 's'} settled for{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>{data?.summary?.totalUsdcHuman ?? '0'}</span> USDC. Tap a
            row for the transaction.
          </p>
          <div style={{ borderTop: '1px solid var(--color-rule-strong)' }}>
            {receipts.map((receipt) => (
              <ReceiptRow key={receipt.txDigest} receipt={receipt} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
