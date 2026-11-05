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
 *   nearTx        — optional, a NEAR tx hash committing the same contentHash
 *                   via NEAR Social `set`. The receipt's own
 *                   integrity.onchainCommitments.near (written by the anchor
 *                   queue) is verified automatically when present; with an
 *                   account id known the contract state itself is checked, so
 *                   anchoring verifies even with no tx hash at all.
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

    // NEAR receipt anchor — same commitment role as the Solana memo, verified
    // server-side (the agent treasury signs, no client wallet step). Sources,
    // in precedence order:
    //   a) ?nearTx= param for ad-hoc verification
    //   b) the receipt's integrity.onchainCommitments.near — written by the
    //      anchor queue (services/near/nearAnchorQueue.js) after a drain
    //   c) the social contract's current state, when an account id is known —
    //      the judge-facing "no tx hash needed" check
    // A NEAR RPC failure degrades to a reason, never a route failure.
    let nearCommitment = null;
    const nearTxParam = searchParams.get('nearTx');
    const nearRecorded = rawReceipt?.proof?.integrity?.onchainCommitments?.near;
    const nearTxHash = nearTxParam || nearRecorded?.txHash || null;
    if (nearTxHash && rawReceipt?.proof?.integrity?.contentHash) {
      try {
        const { verifyCommitmentTx } = await import('@/services/near/nearReceiptCommitment');
        nearCommitment = {
          state: 'anchored',
          ...(await verifyCommitmentTx(nearTxHash, rawReceipt.proof.integrity.contentHash, {
            senderId: nearRecorded?.accountId || undefined,
          })),
        };
      } catch (err) {
        nearCommitment = { state: 'anchored', ok: false, reason: err.message, txHash: nearTxHash };
      }
    } else if (rawReceipt?.proof?.integrity?.contentHash) {
      nearCommitment = { state: 'not-anchored' };
      try {
        const { readAnchoredCommitment } = await import('@/services/near/nearReceiptCommitment');
        const { getNearConfig } = await import('@/services/near/nearConfig');
        const accountId = nearRecorded?.accountId || getNearConfig().accountId;
        if (accountId) {
          const found = await readAnchoredCommitment({ accountId, fixtureId });
          if (found.found && found.parsed?.contentHash === rawReceipt.proof.integrity.contentHash) {
            nearCommitment = {
              state: 'anchored',
              ok: true,
              match: true,
              via: 'contract-state',
              memo: found.memo,
              socialKey: found.socialKey,
            };
          }
        }
      } catch {
        // contract-state check is a bonus — 'not-anchored' already tells the truth
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
      nearCommitment,
      reconciliation,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/worldcup/verify]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
