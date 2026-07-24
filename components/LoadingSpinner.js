'use client';

import { motion } from 'framer-motion';

/**
 * LoadingSpinner — Standardized loading indicator using design tokens.
 * 
 * Provides consistent loading states across the app with proper accessibility.
 */
export function LoadingSpinner({ 
  size = 'md', // 'sm' | 'md' | 'lg'
  label = 'Loading...',
  className = '',
  ...props 
}) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} {...props}>
      <motion.div
        className={`${sizes[size]} border-2 border-[var(--color-rule)] border-t-[var(--color-accent)] rounded-full`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
        role="status"
        aria-label={label}
      />
      {label && (
        <span className="text-sm text-[var(--color-ink-muted)]">{label}</span>
      )}
    </div>
  );
}

/**
 * LoadingOverlay — Full-page loading overlay with backdrop.
 */
export function LoadingOverlay({ label = 'Loading...' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-paper)]/80 backdrop-blur-sm">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

/**
 * InlineLoader — Compact inline loading indicator for use within content.
 */
export function InlineLoader({ label = 'Loading...' }) {
  return (
    <div className="inline-flex items-center gap-2">
      <LoadingSpinner size="sm" label="" />
      <span className="text-sm text-[var(--color-ink-muted)]">{label}</span>
    </div>
  );
}

export default LoadingSpinner;
