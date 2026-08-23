'use client';

/**
 * GlassPanel — frosted card with backdrop-blur.
 *
 * Use as a surface replacement for flat `border border-[var(--color-rule)] bg-[var(--color-paper-raised)]`
 * containers. Inherits the operator-fintech aesthetic from the landing hero.
 *
 * Usage:
 *   <GlassPanel className="p-5">content</GlassPanel>
 */
export default function GlassPanel({ children, className, ...props }) {
  return (
    <div
      className={`border border-[var(--color-rule)] backdrop-blur-[16px] backdrop-saturate-[1.2] bg-[var(--color-paper-glass)] ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}