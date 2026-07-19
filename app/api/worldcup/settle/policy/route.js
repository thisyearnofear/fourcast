import { PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { buildSettlePolicyIx } from '@/services/txline/settlementService';
import txlineService from '@/services/txline/txlineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worldcup/settle/policy
 * Body: { caller, locker, recipient, fixtureId, paysRecipientOnHomeWin }
 *
 * Returns a partially-signed transaction that the client signs with the caller's
 * wallet and submits to Solana devnet. The transaction:
 *   1. CPI-calls txoracle::validate_stat with the TxLINE Merkle proof
 *   2. If the verified outcome matches the policy condition, releases SOL to recipient
 *   3. Otherwise refunds the locker
 *
 * The proof is loaded from the cached replay (cache/txline/replays/{fixtureId}.json).
 * Anyone can call settle — the proof is self-validating on-chain.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { caller, locker, recipient, fixtureId, paysRecipientOnHomeWin } = body;

    if (!caller || !locker || !recipient || !fixtureId) {
      return Response.json(
        { success: false, error: 'Missing required fields: caller, locker, recipient, fixtureId' },
        { status: 400 }
      );
    }

    // Load the cached proof for this fixture
    const replay = txlineService.readReplayFixture(String(fixtureId));
    if (!replay || !replay.proof || !replay.proof.statToProve) {
      return Response.json(
        { success: false, error: 'No cached proof for fixture. Run txline-snapshot-fixture.mjs first.' },
        { status: 404 }
      );
    }

    const proof = replay.proof;
    const minTs = proof.summary.updateStats.minTimestamp;

    const callerPk = new PublicKey(caller);
    const lockerPk = new PublicKey(locker);
    const recipientPk = new PublicKey(recipient);

    const { instruction, policyPda, dailyScoresPda } = buildSettlePolicyIx({
      caller: callerPk,
      locker: lockerPk,
      recipient: recipientPk,
      fixtureId: Number(fixtureId),
      minTs,
      paysRecipientOnHomeWin: paysRecipientOnHomeWin !== undefined ? Boolean(paysRecipientOnHomeWin) : true,
      proof,
    });

    // High compute budget — validate_stat uses ~200k CU
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

    const tx = new Transaction().add(computeBudgetIx, instruction);
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

    return Response.json({
      success: true,
      policyPda: policyPda.toBase58(),
      dailyScoresPda: dailyScoresPda.toBase58(),
      transactionBase64: serialized.toString('base64'),
      fixture: replay.fixture,
      finalScore: replay.finalScore,
      proofSummary: {
        ts: proof.summary.updateStats.minTimestamp,
        statToProve: proof.statToProve,
        statToProve2: proof.statToProve2,
        eventStatRoot: Buffer.from(proof.eventStatRoot).toString('hex').slice(0, 16) + '...',
        subTreeProofLen: proof.subTreeProof?.length || 0,
        mainTreeProofLen: proof.mainTreeProof?.length || 0,
        statProofLen: proof.statProof?.length || 0,
      },
      message: 'Sign and submit this transaction to settle the policy via TxLINE CPI.',
    });
  } catch (err) {
    console.error('[POST /api/worldcup/settle/policy]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
