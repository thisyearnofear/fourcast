import txlineService from '@/services/txline/txlineService';
import { buildCommitmentTransaction } from '@/services/txline/receiptCommitment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worldcup/verify/commit
 *
 * Builds a partially-signed Solana transaction that commits a pre-event
 * DecisionReceipt's contentHash on-chain via the canonical Memo program
 * (MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr).
 *
 * The client signs and submits the returned transaction with the committer
 * wallet. The resulting signature is then passed back to
 * /api/worldcup/verify?commitmentTx=... which verifies the memo matches the
 * receipt hash and surfaces the slot + block time so a judge can confirm the
 * commitment happened before kickoff.
 *
 * Body: { committer, fixtureId, variant? }
 *   committer — the wallet pubkey that will sign and pay for the memo tx
 *   fixtureId — the TxLINE fixture id
 *   variant   — optional, 'allocate' (default) or 'pass'
 *
 * No state is mutated on the Fourcast side. The on-chain commitment is the
 * only record; the receipt file itself is the canonical pre-event artifact.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { committer, fixtureId, variant = 'allocate' } = body;

    if (!committer || !fixtureId) {
      return Response.json(
        { success: false, error: 'Missing required fields: committer, fixtureId' },
        { status: 400 }
      );
    }

    const receiptFile =
      variant === 'pass' ? `${fixtureId}.pass.receipt.json` : `${fixtureId}.receipt.json`;
    const receipt = txlineService.readReceiptFile(receiptFile);
    if (!receipt?.proof?.integrity?.contentHash) {
      return Response.json(
        {
          success: false,
          error: `No ${variant} receipt bound to fixture ${fixtureId}. Run scripts/build-receipt-fixture.mjs first.`,
          fixtureId,
          variant,
        },
        { status: 404 }
      );
    }

    const contentHash = receipt.proof.integrity.contentHash;
    const built = await buildCommitmentTransaction({ committer, fixtureId, contentHash });

    return Response.json({
      success: true,
      fixtureId,
      variant,
      contentHash,
      ...built,
      message:
        'Sign and submit this transaction with the committer wallet to commit the receipt hash on-chain. ' +
        'Pass the resulting signature to /api/worldcup/verify?commitmentTx=... to verify.',
    });
  } catch (err) {
    console.error('[POST /api/worldcup/verify/commit]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
