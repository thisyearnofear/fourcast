/**
 * Canonical intelligence/predictions namespace.
 * Re-exports the original /api/predictions handlers so both paths work.
 *
 * Old path:  /api/predictions
 * New path:  /api/intelligence/predictions
 */

// Must be declared before the re-export for Next.js to pick it up
export const runtime = 'nodejs';

export {
  POST,
  GET,
  OPTIONS,
} from '@/app/api/predictions/route';
