'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletAuth } from '@/hooks/useWalletAuth';

/**
 * TelegramLinkButton — connect a Telegram chat for push notifications.
 *
 * Generates a one-time deep-link code (wallet-auth gated) and opens t.me;
 * the bot binds the chat on /start <code>. Shows linked state + unlink.
 */
export default function TelegramLinkButton({ address }) {
  const { getAuthHeaders, getCachedAuthHeaders } = useWalletAuth();
  const [linked, setLinked] = useState(null); // null = unknown
  const [busy, setBusy] = useState(false);
  const [deepLink, setDeepLink] = useState(null);

  // Check link status with the cached token only — never prompt on mount
  useEffect(() => {
    if (!address) return;
    const cached = getCachedAuthHeaders(address);
    if (!cached) return;
    let cancelled = false;
    fetch(`/api/notifications/telegram?address=${encodeURIComponent(address)}`, { headers: cached })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.success) setLinked(d.linked); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [address, getCachedAuthHeaders]);

  const handleLink = useCallback(async () => {
    if (!address || busy) return;
    setBusy(true);
    try {
      const headers = await getAuthHeaders(address);
      const res = await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (data.success && data.deepLink) {
        window.open(data.deepLink, '_blank', 'noopener');
        setDeepLink(data.deepLink);
      } else if (data.success && data.code) {
        // Bot username not configured — show the manual code path
        setDeepLink(`Send /start ${data.code} to the Fourcast bot`);
      }
    } catch {
      // Signature rejected or network error
    } finally {
      setBusy(false);
    }
  }, [address, busy, getAuthHeaders]);

  const handleUnlink = useCallback(async () => {
    if (!address || busy) return;
    setBusy(true);
    try {
      const headers = await getAuthHeaders(address);
      await fetch('/api/notifications/telegram', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ address }),
      });
      setLinked(false);
      setDeepLink(null);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [address, busy, getAuthHeaders]);

  if (!address) return null;

  if (linked) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-emerald-400">✓ Telegram linked</span>
        <button
          onClick={handleUnlink}
          disabled={busy}
          className="text-slate-600 hover:text-slate-400 transition-colors"
        >
          unlink
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleLink}
        disabled={busy}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors ${busy ? 'opacity-50' : ''}`}
      >
        {busy ? 'Linking…' : '📲 Get these on Telegram'}
      </button>
      {deepLink && (
        <span className="text-[10px] text-slate-500 max-w-[220px] text-right">
          {deepLink.startsWith('http')
            ? 'Opened Telegram — tap Start to finish linking, then refresh here.'
            : deepLink}
        </span>
      )}
    </div>
  );
}
