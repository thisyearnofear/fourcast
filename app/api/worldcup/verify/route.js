import txlineService from '@/services/txline/txlineService';
import { verifyFixtureProof } from '@/services/txline/solanaVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/worldcup/verify?fixtureId=...
 *   Pulls the cached Merkle proof for a finalised fixture and verifies it
 *   against the on-chain TxLINE daily-root PDA via a read-only Solana RPC
 *   simulation (Helius). No state is mutated.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');

    if (!fixtureId) {
      return Response.json({
        success: true,
        status: txlineService.getTxlineStatus(),
        timestamp: new Date().toISOString(),
      });
    }

    const replay = txlineService.readReplayFixture(fixtureId);
    if (!replay || !replay.proof) {
      return Response.json(
        {
          success: false,
          error: 'No proof cached for fixture - finish TxLINE snapshot first',
          fixtureId,
        },
        { status: 404 }
      );
    }

    const verification = await verifyFixtureProof(replay.proof, replay.fixture);

    return Response.json({
      success: true,
      provider: 'txline',
      fixtureId,
      proof: replay.proof,
      verification,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/verify]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
