'use client';

import React from 'react';
import { useBuilder } from '@/hooks/useBuilder';

/**
 * BuilderBadge Component - Lightweight indicator for builder status
 * Shows in order confirmation and market cards
 * Compact design for header/card integration
 */
export function BuilderBadge({ variant = 'compact', isNight = false }) {
  const { isConfigured, stats } = useBuilder();

  if (!isConfigured) return null;

  const isAttributed = stats?.configured && !stats?.error;

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        isNight
          ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
          : 'bg-blue-100 text-blue-700 border border-blue-200'
      }`}>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        {isAttributed ? 'Builder Order' : 'Syncing...'}
      </div>
    );
  }

  // 'detailed' variant for order confirmation
  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg border ${
      isNight
        ? 'bg-blue-500/10 border-blue-400/30'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isNight ? 'bg-blue-500/30' : 'bg-blue-100'
        }`}>
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <div>
          <h4 className={`text-sm font-medium ${isNight ? 'text-blue-200' : 'text-blue-900'}`}>
            Builder Order
          </h4>
          <p className={`text-xs ${isNight ? 'text-blue-300/70' : 'text-blue-700/70'}`}>
            Counted toward leaderboard
          </p>
        </div>
      </div>
      <a
        href="https://builders.polymarket.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={`text-xs font-medium underline ${isNight ? 'text-blue-300 hover:text-blue-100' : 'text-blue-600 hover:text-blue-700'}`}
      >
        Track Performance →
      </a>
    </div>
  );
}
