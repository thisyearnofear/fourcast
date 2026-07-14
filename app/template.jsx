'use client';

/**
 * Lightweight route fade — no framer-motion dependency on every navigation.
 */
export default function Template({ children }) {
  return <div className="animate-page-enter">{children}</div>;
}
