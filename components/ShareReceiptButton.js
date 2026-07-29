'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

/* --------------------------------------------------------------------------
   ShareReceiptButton — the viral surface for the flagship proof chain.

   Composes a pre-written post for X / Warpcast (or copies the link) pointing
   at the /world-cup?fixture=<id> deep link. That URL carries per-fixture OG
   metadata (see app/world-cup/page.js → /api/og?type=receipt), so the posted
   card renders the sealed receipt itself: teams, verdict, score, hash.

   Success is shown in place ("Copied"); no toast, per design.md.
   -------------------------------------------------------------------------- */

const HOST = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

export function receiptShareUrl(fixtureId) {
  return `${HOST}/world-cup?fixture=${encodeURIComponent(fixtureId)}`;
}

function composeShareText({ home, away, fixtureId, verdict, score, receiptHash }) {
  const fixture = home && away ? `${home} v ${away}` : `Fixture ${fixtureId}`;
  const verdictBit = verdict ? ` Verdict: ${verdict}.` : '';
  const scoreBit = score ? ` Final ${score}.` : '';
  const hashBit = receiptHash ? ` Receipt ${receiptHash.slice(0, 12)}…` : '';
  return (
    `${fixture} — decided by an agent from pre-match evidence, sealed into a SHA-256 receipt before the outcome was known.${verdictBit}${scoreBit}${hashBit} anchored on Solana.\n\n` +
    `Audit the full proof chain, no trust required:`
  );
}

export default function ShareReceiptButton({
  fixtureId,
  home,
  away,
  verdict,
  score,
  receiptHash,
  label = 'Share receipt',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return undefined;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!fixtureId) return null;

  const url = receiptShareUrl(fixtureId);
  const text = composeShareText({ home, away, fixtureId, verdict, score, receiptHash });

  const openComposer = (platform) => {
    const body = `${text}\n${url}`;
    const intent =
      platform === 'farcaster'
        ? `https://warpcast.com/compose?text=${encodeURIComponent(body)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(body)}`;
    window.open(intent, '_blank', 'width=550,height=460');
    setOpen(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
  };

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="mc-action"
      >
        <Share2 className="h-3.5 w-3.5" />
        {label}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Share receipt"
          className="absolute right-0 top-full z-[70] mt-1.5 w-52 border border-[var(--color-rule)] bg-[var(--color-paper-glass)] p-1 shadow-xl backdrop-blur-[18px]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => openComposer('x')}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)] transition hover:bg-white/[0.04]"
          >
            <span aria-hidden="true">𝕏</span>
            Share on X
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openComposer('farcaster')}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)] transition hover:bg-white/[0.04]"
          >
            <span aria-hidden="true">⛵</span>
            Share on Warpcast
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)] transition hover:bg-white/[0.04]"
          >
            {copied ? (
              <Check className="h-3 w-3 text-[var(--color-accent)]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  );
}
