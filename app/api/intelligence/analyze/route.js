/**
 * Canonical intelligence/analyze namespace.
 * Re-exports the original /api/analyze handlers so both paths work.
 *
 * Old path:  /api/analyze
 * New path:  /api/intelligence/analyze
 */

// Must be declared before the re-export for Next.js to pick it up
export const runtime = 'nodejs';
export const maxDuration = 60;

export {
  POST,
  GET,
  OPTIONS,
} from '@/app/api/analyze/route';
