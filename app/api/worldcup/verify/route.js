import txlineService from '@/services/txline/txlineService';
import { verifyFixtureProof } from '@/services/txline/solanaVerify';
import { accept } from '@/services/txline/receiptAdapter';
import { reconcile } from '@/services/txline/reconciliationService';
import { verifyCommitmentTx } from '@/services/txline/receiptCommitment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/worldcup/verify?fixtureId=...
 *   The flagship judge endpoint. Walks the full proof-of-decision chain for a
 *   fixture in one call:
 *
 *     pre-event receipt (hash + integrity)
 *       → optional on-chain receipt commitment (if commitmentTx is provided)
 *       → TxLINE Merkle proof
 *       → on-chain Solana daily-root verification
 *       → reconciliation (decision vs verified outcome + adherence)
 *
 *   No state is mutated. When Solana RPC is unreachable the reconciliation
 *   still completes on the proof alone — the on-chain anchor is a strengthening
 *   signal, not a hard dependency for the demo.
 *
 * Query params:
 *   fixtureId     — required, the TxLINE fixture id
 *   variant       — optional, 'allocate' (default) or 'pass'. Selects which
 *                   bound receipt to load when a fixture has multiple receipts
 *                   (e.g. the ALLOCATE flagship and the PASS-gate refusal).
 *   commitmentTx  — optional, a Solana tx signature that committed the receipt
 *                   contentHash on-chain via the Memo program. When provided,
 *                   the endpoint verifies the memo matches the receipt hash
 *                   and surfaces slot + block time so a judge can confirm the
 *                   commitment happened before kickoff.
 *
 * GET /api/worldcup/verify
 *   Returns TxLINE status only.
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

    // Select the receipt variant. 'allocate' (default) reads {fixtureId}.receipt.json;
    // 'pass' reads {fixtureId}.pass.receipt.json. This lets the judge walkthrough
    // show both the ALLOCATE flagship and the PASS-gate refusal on the same fixture.
    const variant = searchParams.get('variant') || 'allocate';
    const receiptFile = variant === 'pass' ? `${fixtureId}.pass.receipt.json` : `${fixtureId}.receipt.json`;
    const rawReceipt = txlineService.readReceiptFile(receiptFile);
    const receipt = rawReceipt ? accept(rawReceipt) : null;

    // On-chain verification is best-effort: a devnet/mainnet RPC failure must
    // not break the judge walkthrough. The reconciliation layer falls back to
    // proof-only verification when the verdict is null.
    let verification = null;
    try {
      verification = await verifyFixtureProof(replay.proof, replay.fixture);
    } catch (err) {
      console.error('[GET /api/worldcup/verify] on-chain check failed:', err.message);
      verification = { verdict: 'onchain-error', checks: [], nextStep: err.message };
    }

    // Optional on-chain receipt commitment verification. Only attempted when
    // the caller passes a commitmentTx signature — the create-commitment route
    // returns this signature after the client signs and submits.
    let commitment = null;
    const commitmentTx = searchParams.get('commitmentTx');
    if (commitmentTx && rawReceipt?.proof?.integrity?.contentHash) {
      try {
        commitment = await verifyCommitmentTx(commitmentTx, rawReceipt.proof.integrity.contentHash);
      } catch (err) {
        commitment = { ok: false, reason: err.message, signature: commitmentTx };
      }
    }

    // reconcile() accepts the raw (canonical) receipt and normalizes internally
    // so Person 1's verifyDecisionReceipt hashes the original proof payload.
    const reconciliation = reconcile({
      receipt: rawReceipt,
      proof: replay.proof,
      verification,
      fixtureId,
    });

    return Response.json({
      success: true,
      provider: 'txline',
      fixtureId,
      variant,
      receipt,
      proof: replay.proof,
      verification,
      commitment,
      reconciliation,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/verify]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
