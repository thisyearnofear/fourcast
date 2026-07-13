'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import FollowButton from './FollowButton';

/**
 * SignalCTA — conversion call-to-action section for the /signal/[id] landing page.
 *
 * This is what stops the OG-card share loop from dead-ending.  Visitors who
 * arrive via a shared signal link see:
 *   1. "Analyze this market →" — routes to /markets with the query pre-filled
 *   2. "Share this signal"     — copies the page URL to clipboard
 *   3. FollowButton            — follow the analyst (requires wallet)
 *
 * @param {string} marketTitle   - Market question (used as search query).
 * @param {string|null} authorAddress - The analyst's wallet address.
 */
export default function SignalCTA({ marketTitle, authorAddress }) {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // give up silently
        }
        document.body.removeChild(textarea);
      }
    }
  }, []);

  const analyzeQuery = marketTitle
    ? encodeURIComponent(marketTitle.substring(0, 200))
    : '';

  return (
    <div className="space-y-4 mt-6">
      {/* Primary CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Analyze this market */}
        <Link
          href={analyzeQuery ? `/markets?q=${analyzeQuery}` : '/markets'}
          className="flex-1 text-center text-sm font-medium px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity no-underline"
        >
          🔍 Analyze this market →
        </Link>

        {/* Share this signal */}
        <button
          onClick={handleShare}
          className="flex-1 text-center text-sm font-medium px-5 py-3 rounded-xl bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
        >
          {copied ? '✓ Copied!' : '🔗 Share this signal'}
        </button>
      </div>

      {/* Follow analyst + secondary CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
        {/* Follow the analyst */}
        {authorAddress ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Want more signals from this analyst?</span>
            <FollowButton authorAddress={authorAddress} currentAddress={address} />
          </div>
        ) : (
          <span className="text-xs text-slate-600">Anonymous signal</span>
        )}

        {/* Try Fourcast */}
        <Link
          href="/markets"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors no-underline"
        >
          Try Fourcast on your own markets →
        </Link>
      </div>
    </div>
  );
}
