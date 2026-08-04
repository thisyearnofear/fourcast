'use client';

import { useState } from 'react';

/**
 * TalkToUs — compact operator capture under the privacy check.
 * Interview pipeline for the privacy wedge, not a vanity waitlist.
 */
export default function TalkToUs({ source = 'privacy' }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sizes, setSizes] = useState(true);
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sizes, note, source, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setStatus('error');
        setError(data.error || 'Could not send — try again');
        return;
      }
      setStatus('done');
    } catch {
      setStatus('error');
      setError('Could not send — try again');
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-4 border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[0.06] px-4 py-3">
        <p className="text-sm font-medium text-[var(--color-ink)]">Got it — we&rsquo;ll reach out.</p>
        <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">
          Looking for operators who size into public books and care about leakage.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--mc-rule)] pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-md">
          <p className="mc-kicker">Operator access</p>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Trade size and care about leakage? Talk to us — short call, not a newsletter.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="fc-action shrink-0 px-3 py-2 text-xs"
          >
            Talk to us
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={onSubmit} className="mt-3 space-y-3" noValidate>
          {/* Honeypot — hidden from humans */}
          <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full flex-1 border border-[var(--color-rule)] bg-[var(--color-paper-deep)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)]/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending' || !email.trim()}
              className="fc-action shrink-0 px-4 py-2 text-sm disabled:opacity-40"
            >
              {status === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>

          <label className="flex items-start gap-2 text-xs text-[var(--color-ink-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={sizes}
              onChange={(e) => setSizes(e.target.checked)}
              className="mt-0.5 accent-[var(--color-accent)]"
            />
            <span>I size into Polymarket / Kalshi (or similar)</span>
          </label>

          <input
            type="text"
            name="note"
            maxLength={500}
            placeholder="Optional — what breaks for you on public books?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-[var(--color-rule)] bg-[var(--color-paper-deep)] px-3 py-2 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)]/50 focus:outline-none"
          />

          {error && (
            <p className="text-xs text-[var(--color-breach)]" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
