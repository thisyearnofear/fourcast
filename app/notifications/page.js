'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { AppShell } from '@/app/components/PageNav';
import TelegramLinkButton from '@/components/TelegramLinkButton';
import { useWalletAuth } from '@/hooks/useWalletAuth';

export default function NotificationsPage() {
  const { address } = useAccount();
  const { getAuthHeaders, getCachedAuthHeaders } = useWalletAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async (authHeaders) => {
    if (!address || !authHeaders) {
      setIsLoading(false);
      return;
    }

    try {
      const [notifRes, unreadRes] = await Promise.all([
        fetch(`/api/notifications?address=${encodeURIComponent(address)}&limit=50`, { headers: authHeaders }),
        fetch(`/api/notifications?address=${encodeURIComponent(address)}&type=unread`, { headers: authHeaders }),
      ]);
      const notifData = await notifRes.json();
      const unreadData = await unreadRes.json();

      if (notifRes.status === 401 || unreadRes.status === 401) {
        // Stale/invalid token — ask the user to re-verify
        setNeedsAuth(true);
        return;
      }

      if (notifData.success) {
        setNotifications(notifData.notifications || []);
        setNeedsAuth(false);
      } else {
        setError(notifData.error || 'Failed to load notifications');
      }
      if (unreadData.success) {
        setUnreadCount(unreadData.count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Unable to connect to notifications service');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // On mount: fetch with the cached auth token if one exists; otherwise show
  // the one-time "verify wallet" button instead of auto-prompting a signature.
  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }
    const cached = getCachedAuthHeaders(address);
    if (cached) {
      fetchNotifications(cached);
    } else {
      setNeedsAuth(true);
      setIsLoading(false);
    }
  }, [address, getCachedAuthHeaders, fetchNotifications]);

  const handleVerify = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders(address);
      setNeedsAuth(false);
      await fetchNotifications(headers);
    } catch {
      // Signature rejected
      setIsLoading(false);
    }
  }, [address, getAuthHeaders, fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!address) return;
    try {
      const authHeaders = await getAuthHeaders(address);
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ address, all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [address, getAuthHeaders]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMin = Math.floor((now - date) / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const parseData = (dataJson) => {
    try {
      return typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
    } catch {
      return {};
    }
  };

  const typeIcons = { new_signal: '📊' };

  // No wallet connected
  if (!address) {
    return (
      <AppShell title="Notifications" maxWidth="max-w-[720px]">
        <div className="py-16 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-sm text-white/[0.55] mb-8">
            Connect your wallet to see notifications when analysts you follow publish new signals.
          </p>
          <Link href="/markets" className="inline-block rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20 no-underline">
            🔗 Connect wallet →
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Notifications"
      subtitle="New signals from analysts you follow"
      maxWidth="max-w-[720px]"
      actions={
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs font-medium text-emerald-100">
                {unreadCount} new
              </span>
              <button onClick={handleMarkAllRead} className="text-xs text-white/[0.45] transition hover:text-white/80">
                Mark all read
              </button>
            </>
          )}
          {!needsAuth && <TelegramLinkButton address={address} />}
        </div>
      }
    >

        {needsAuth && !isLoading && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔐</div>
            <p className="text-sm text-slate-400 mb-2">Notifications are private to your wallet.</p>
            <p className="text-xs text-slate-600 mb-6">Sign a one-time message to prove ownership — no transaction, no gas.</p>
            <button
              onClick={handleVerify}
              className="text-sm font-medium px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity"
            >
              ✍️ Verify wallet to view
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                <div className="h-4 w-3/4 bg-white/[0.06] rounded mb-2" />
                <div className="h-3 w-1/2 bg-white/[0.04] rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">{error}</div>
        )}

        {!isLoading && !needsAuth && !error && notifications.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4 opacity-40">🔔</div>
            <p className="text-sm text-slate-500 mb-2">No notifications yet</p>
            <p className="text-xs text-slate-600 mb-6">Follow analysts on the Signals page to get notified when they publish.</p>
            <Link href="/signals" className="text-sm text-blue-400 hover:text-blue-300 transition-colors no-underline">Browse signals →</Link>
          </div>
        )}

        {!isLoading && !needsAuth && !error && notifications.length > 0 && (
          <div className="space-y-2">
            {notifications.map(notif => {
              const data = parseData(notif.data_json);
              const signalUrl = data.signalId ? `/signal/${data.signalId}` : null;
              const icon = typeIcons[notif.type] || '🔔';
              const isUnread = !notif.read;
              return (
                <div key={notif.id} className={`rounded-xl p-4 border transition-all ${isUnread ? 'bg-blue-500/[0.06] border-blue-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0 mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                        <p className={`text-sm ${isUnread ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>{notif.title}</p>
                      </div>
                      {notif.body && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{notif.body}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-600">{formatTimestamp(notif.created_at)}</span>
                        {signalUrl && (
                          <Link href={signalUrl} className="text-xs text-blue-400 hover:text-blue-300 transition-colors no-underline">View signal →</Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </AppShell>
  );
}

