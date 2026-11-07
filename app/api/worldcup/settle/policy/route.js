import { PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { buildSettlePolicyV4Ix, buildEd25519VerifyIx } from '@/services/txline/settlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_ADMIN = 'Ah5xwzHxRYBBV3BWHDCHdfzQJfBehzGQcc7A9QX1DLUB';

/**
 * POST /api/worldcup/settle/policy
 * Body: {
 *   caller, locker, recipient, fixtureId, paysRecipientOnHomeWin,
 *   v4: {
 *     signature,            // base64 backend signature over sha256(payload)
 *     version,              // 'v1' | 'v2'
 *     domain, workerId,     // optional (default 1, 1)
 *     forTree,              // FixtureForTreeInput payload (ts, summary, mainTreeProof)
 *     payload,              // StatValidationPayload fields (ts, eventStatRoot, proofs, leaves…)
 *     strategy              // NDimensionalStrategy (optional — defaults to home-win)
 *   }
 * }
 *
 * Returns a transaction the client signs with the caller's wallet and submits
 * to Solana devnet. Instruction order matters: the Ed25519 verification must
 * precede settle_policy_v4 because txoracle::validate_stat_v4 introspects the
 * instructions sysvar.
 *
 * The v4 payload is produced by TxLINE's /scores/stat-validation-v4 endpoint —
 * the caller supplies it (the API credentials stay client/keeper-side).
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { caller, locker, recipient, fixtureId, paysRecipientOnHomeWin, v4 } = body;

    if (!caller || !locker || !recipient || !fixtureId) {
      return Response.json(
        { success: false, error: 'Missing required fields: caller, locker, recipient, fixtureId' },
        { status: 400 }
      );
    }
    if (!v4 || !v4.signature || !v4.forTree || !v4.payload) {
      return Response.json(
        { success: false, error: 'Missing v4 proof payload. Fetch /scores/stat-validation-v4 and pass { signature, forTree, payload, strategy }.' },
        { status: 400 }
      );
    }

    const payloadTs = Number(v4.payload.ts);
    const isV2 = v4.version === 'v2' || v4.version === 2;
    const domain = v4.domain ?? 1;
    const workerId = v4.workerId ?? 1;
    // forTree mirrors the standalone v4 flow: ts/domain/workerId + the
    // summary & mainTreeProof carried inside the stat-validation payload.
    const forTree = v4.forTree ?? {
      ts: payloadTs,
      domain,
      workerId,
      summary: v4.payload.summary,
      mainTreeProof: v4.payload.mainTreeProof,
    };

    const { instruction, policyPda, dailyScoresPda, payloadHash } = buildSettlePolicyV4Ix({
      caller: new PublicKey(caller),
      locker: new PublicKey(locker),
      recipient: new PublicKey(recipient),
      fixtureId: Number(fixtureId),
      payloadTs,
      paysRecipientOnHomeWin: paysRecipientOnHomeWin !== undefined ? Boolean(paysRecipientOnHomeWin) : true,
      domain,
      workerId,
      forTree,
      payload: v4.payload,
      strategy: v4.strategy,
      isV2,
    });

    const ed25519Ix = buildEd25519VerifyIx({
      messageHash: payloadHash,
      signature: v4.signature,
      publicKey: BACKEND_ADMIN,
    });

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
    const tx = new Transaction().add(computeBudgetIx, ed25519Ix, instruction);
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

    return Response.json({
      success: true,
      policyPda: policyPda.toBase58(),
      dailyScoresPda: dailyScoresPda.toBase58(),
      transactionBase64: serialized.toString('base64'),
      payloadTs,
      message: 'Sign and submit this transaction to settle the policy via TxLINE v4 CPI.',
    });
  } catch (err) {
    console.error('[POST /api/worldcup/settle/policy]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
