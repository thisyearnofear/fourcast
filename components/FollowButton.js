'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWalletAuth } from '@/hooks/useWalletAuth';

/**
 * FollowButton — toggle follow/unfollow for an analyst.
 *
 * If the user has no connected wallet, renders a "Connect wallet" link
 * to /markets (where WalletConnect lives) instead of a toggle.
 *
 * @param {string} authorAddress - The analyst to follow.
 * @param {string|null} currentAddress - The connected user's wallet address.
 */
export default function FollowButton({ authorAddress, currentAddress }) {
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const { getAuthHeaders } = useWalletAuth();

  const author = authorAddress?.toLowerCase();
  const me = currentAddress?.toLowerCase();
  const isSelf = author && me && author === me;

  // Check follow status + follower count on mount / when addresses change
  useEffect(() => {
    if (!author) return;

    let cancelled = false;

    async function fetchStatus() {
      try {
        // Fetch follower count
        const countRes = await fetch(
          `/api/follow?address=${encodeURIComponent(author)}&type=count`
        );
        const countData = await countRes.json();
        if (!cancelled && countData.success) {
          setFollowerCount(countData.count);
        }

        // Check if current user follows this author
        if (me && !isSelf) {
          const statusRes = await fetch(
            `/api/follow?follower=${encodeURIComponent(me)}&following=${encodeURIComponent(author)}`
          );
          const statusData = await statusRes.json();
          if (!cancelled && statusData.success) {
            setFollowing(statusData.isFollowing);
          }
        }
      } catch (err) {
        // Silently fail — the button still renders, just without state
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [author, me, isSelf]);

  const handleToggle = useCallback(async () => {
    if (!me || !author || isSelf || loading) return;
    setLoading(true);

    try {
      // First follow prompts a one-time wallet signature; cached afterwards
      const authHeaders = await getAuthHeaders(currentAddress);
      const method = following ? 'DELETE' : 'POST';
      const res = await fetch('/api/follow', {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          followerAddress: me,
          followingAddress: author,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setFollowing(!following);
        setFollowerCount(prev => following ? Math.max(0, prev - 1) : prev + 1);
      }
    } catch (err) {
      // Signature rejected or network error — user can retry
    } finally {
      setLoading(false);
    }
  }, [following, me, author, isSelf, loading, currentAddress, getAuthHeaders]);

  // Don't render a follow button for your own profile
  if (isSelf) {
    return (
      <span className="text-xs text-slate-500 px-3 py-1.5 rounded-full border border-white/[0.06]">
        This is you · {followerCount} follower{followerCount !== 1 ? 's' : ''}
      </span>
    );
  }

  // No connected wallet — prompt to connect
  if (!me) {
    return (
      <Link
        href="/markets"
        className="text-xs font-medium px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 no-underline"
      >
        🔗 Connect wallet to follow
      </Link>
    );
  }

  if (!checked) {
    return (
      <div className="h-8 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-xs font-medium px-4 py-2 rounded-lg border transition-all inline-flex items-center gap-1.5 ${
        following
          ? 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
          : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent hover:opacity-90'
      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {following ? '✓ Following' : '+ Follow'}
      <span className="text-slate-500 ml-1">
        {followerCount}
      </span>
    </button>
  );
}
