import txlineService from '@/services/txline/txlineService';
import { accept } from '@/services/txline/receiptAdapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/worldcup/replay
 *   Returns the list of fixture ids that have a cached deterministic replay.
 *   Also lists which fixtures carry a bound pre-event decision receipt.
 *
 * GET /api/worldcup/replay?fixtureId=18241006
 *   Returns the cached event stream for one fixture so the UI can step through
 *   score/odds updates without a live TxLINE connection. When a pre-event
 *   decision receipt is bound to this fixture, it is included verbatim (with
 *   its integrity block) so a judge can inspect what the agent knew pre-match.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');

    if (!fixtureId) {
      const replays = txlineService.listReplayFixtureIds();
      const receipts = txlineService.listReceiptFixtureIds();
      return Response.json({
        success: true,
        provider: 'txline',
        mode: 'replay',
        available: replays,
        withReceipt: receipts,
        timestamp: new Date().toISOString(),
      });
    }

    const replay = txlineService.readReplayFixture(fixtureId);
    if (!replay) {
      return Response.json(
        { success: false, error: 'No cached replay for fixture', fixtureId },
        { status: 404 }
      );
    }

    const rawReceipt = txlineService.readReceiptFixture(fixtureId);
    const receipt = rawReceipt ? accept(rawReceipt) : null;

    return Response.json({
      success: true,
      provider: 'txline',
      mode: 'replay',
      fixtureId,
      fixture: txlineService.normalizeFixture(replay.fixture || replay),
      events: replay.events || [],
      proof: replay.proof || null,
      receipt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/replay]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
