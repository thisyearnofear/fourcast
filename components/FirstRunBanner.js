'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'fourcast_first_run_dismissed';

/**
 * Lightweight first-session guide for Markets (esp. landing → ?q=&first=1).
 */
export default function FirstRunBanner({ searchQuery }) {
 const [visible, setVisible] = useState(false);

 useEffect(() => {
 try {
 if (localStorage.getItem(STORAGE_KEY) === '1') return;
 } catch {
 /* ignore */
 }
 const params = new URLSearchParams(window.location.search);
 if (params.get('first') === '1' || searchQuery) {
 setVisible(true);
 }
 }, [searchQuery]);

 const dismiss = () => {
 setVisible(false);
 try {
 localStorage.setItem(STORAGE_KEY, '1');
 } catch {
 /* ignore */
 }
 };

 if (!visible) return null;

 return (
 <div className="mb-6 overflow-hidden border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/[0.07] px-4 py-4 sm:px-5">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0 max-w-2xl">
 <p className="font-display text-sm font-semibold text-[var(--color-accent)]">
 Your first edge — three steps
 </p>
 <ol className="mt-2 space-y-1 text-sm text-[var(--color-ink-muted)]">
 <li>
 <span className="font-mono text-[var(--color-accent)]/80">1</span> Pick a market
 {searchQuery ? (
 <span className="text-[var(--color-ink-faint)]"> — filtered for “{searchQuery}”</span>
 ) : null}
 </li>
 <li>
 <span className="font-mono text-[var(--color-accent)]/80">2</span> Tap Analyze — AI fair odds vs market
 </li>
 <li>
 <span className="font-mono text-[var(--color-accent)]/80">3</span> Share or publish when you like the call
 </li>
 </ol>
 <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
 Wallet is optional until you publish or trade.{' '}
 <Link href="/signals" className="text-[var(--color-accent)]/80 underline-offset-2 hover:underline">
 See live signals
 </Link>
 </p>
 </div>
 <button
 type="button"
 onClick={dismiss}
 className=" border border-[var(--color-rule)] bg-[var(--color-paper-deep)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
 >
 Got it
 </button>
 </div>
 </div>
 );
}
