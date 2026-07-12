'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import PageNav from '@/app/components/PageNav';

export default function NotificationsPage() {
  const { address } = useAccount();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    try {
      const [notifRes, unreadRes] = await Promise.all([
        fetch(`/api/notifications?address=${encodeURIComponent(address)}&limit=50`),
        fetch(`/api/notifications?address=${encodeURIComponent(address)}&type=unread`),
      ]);
      const notifData = await notifRes.json();
      const unreadData = await unreadRes.json();

      if (notifData.success) {
        setNotifications(notifData.notifications || []);
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

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!address) return;
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [address]);

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
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <PageNav />
        <main className="max-w-[640px] mx-auto px-5 py-20 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <h1 className="text-xl font-light text-slate-200 mb-3">Notifications</h1>
          <p className="text-sm text-slate-500 mb-8">
            Connect your wallet to see notifications when analysts you follow publish new signals.
          </p>
          <Link href="/markets" className="inline-block text-sm font-medium px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity no-underline">
            🔗 Connect wallet →
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <PageNav />
      <main className="max-w-[640px] mx-auto px-5 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-light text-slate-100">Notifications</h1>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Mark all read
            </button>
          )}
        </div>

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

        {!isLoading && !error && notifications.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4 opacity-40">🔔</div>
            <p className="text-sm text-slate-500 mb-2">No notifications yet</p>
            <p className="text-xs text-slate-600 mb-6">Follow analysts on the Signals page to get notified when they publish.</p>
            <Link href="/signals" className="text-sm text-blue-400 hover:text-blue-300 transition-colors no-underline">Browse signals →</Link>
          </div>
        )}

        {!isLoading && !error && notifications.length > 0 && (
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
      </main>
    </div>
  );
}

