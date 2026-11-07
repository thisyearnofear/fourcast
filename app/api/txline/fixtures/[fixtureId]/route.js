/**
 * Canonical TxLINE API path. Alias for /api/worldcup/fixtures/[fixtureId] —
 * the provider-named namespace replaces the retired event branding;
 * worldcup paths keep working for existing links and demo docs.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export * from '@/app/api/worldcup/fixtures/[fixtureId]/route';
