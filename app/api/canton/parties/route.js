/**
 * GET /api/canton/parties
 *   Returns list of configured party IDs for role switching.
 *   Parties must be allocated on the Canton participant node first.
 *   For demo purposes, reads from env vars.
 */
export const runtime = 'nodejs';

import { OPERATOR_PARTY_ID } from '@/services/cantonLedgerClient';

// Demo parties - must be allocated on the participant node first
// In production, these would come from connected wallets
const getDemoParties = () => {
  const parties = [
    {
      id: OPERATOR_PARTY_ID,
      name: 'Fourcast Operator',
      role: 'operator',
      description: 'Market maker and settlement processor'
    }
  ];

  // Add demo holder parties if configured
  if (process.env.CANTON_ALICE_PARTY_ID) {
    parties.push({
      id: process.env.CANTON_ALICE_PARTY_ID,
      name: 'Alice',
      role: 'holder',
      description: 'Trader with positions'
    });
  }

  if (process.env.CANTON_BOB_PARTY_ID) {
    parties.push({
      id: process.env.CANTON_BOB_PARTY_ID,
      name: 'Bob',
      role: 'holder',
      description: 'Trader with positions'
    });
  }

  // Observer party (reads but doesn't hold positions)
  if (process.env.CANTON_OBSERVER_PARTY_ID) {
    parties.push({
      id: process.env.CANTON_OBSERVER_PARTY_ID,
      name: 'Public Observer',
      role: 'observer',
      description: 'Can only see public markets, not private positions'
    });
  }

  return parties;
};

export async function GET() {
  const parties = getDemoParties();
  
  return Response.json({
    success: true,
    parties,
    count: parties.length,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
