'use client';

/**
 * Skeleton — Standardized loading placeholder using design tokens.
 * 
 * Uses the design system's motion tokens for consistent animation timing
 * and color tokens for proper visual hierarchy.
 */
export function Skeleton({ 
  className = '', 
  width, 
  height, 
  variant = 'rectangular', // 'rectangular' | 'circular' | 'text'
  ...props 
}) {
  const baseClasses = 'bg-[var(--color-paper-raised)] border border-[var(--color-rule)] animate-pulse';
  
  const variantClasses = {
    rectangular: '',
    circular: 'rounded-full',
    text: 'rounded',
  };

  const style = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1em' : '2rem'),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      {...props}
    />
  );
}

/**
 * SkeletonGroup — Renders multiple skeleton placeholders with consistent spacing.
 */
export function SkeletonGroup({ count = 3, gap = '0.75rem', children }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{children || <Skeleton />}</div>
      ))}
    </div>
  );
}

/**
 * CardSkeleton — Pre-built skeleton for card layouts.
 */
export function CardSkeleton({ showImage = false }) {
  return (
    <div className="p-4 border border-[var(--color-rule)] bg-[var(--color-paper)] space-y-3">
      {showImage && <Skeleton height="120px" />}
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="40%" />
    </div>
  );
}

export default Skeleton;
