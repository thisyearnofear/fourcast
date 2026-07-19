import { PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { buildCreatePolicyIx } from '@/services/txline/settlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worldcup/settle/create
 * Body: { locker, recipient, fixtureId, minTs, paysRecipientOnHomeWin, amountLamports }
 *
 * Returns a partially-signed transaction (base64) that the client must sign
 * with the locker's wallet and submit to Solana devnet.
 *
 * The transaction creates a parametric sports insurance policy:
 *   - locker locks `amountLamports` SOL in a PDA
 *   - if paysRecipientOnHomeWin is true and the home team wins, recipient gets the SOL
 *   - otherwise the locker is refunded
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { locker, recipient, fixtureId, minTs, paysRecipientOnHomeWin, amountLamports } = body;

    if (!locker || !recipient || !fixtureId || !minTs || !amountLamports) {
      return Response.json(
        { success: false, error: 'Missing required fields: locker, recipient, fixtureId, minTs, amountLamports' },
        { status: 400 }
      );
    }

    const lockerPk = new PublicKey(locker);
    const recipientPk = new PublicKey(recipient);

    const { instruction, policyPda } = buildCreatePolicyIx({
      locker: lockerPk,
      recipient: recipientPk,
      fixtureId: Number(fixtureId),
      minTs: Number(minTs),
      paysRecipientOnHomeWin: Boolean(paysRecipientOnHomeWin),
      amountLamports: Number(amountLamports),
    });

    // Build a partial transaction — the client signs with the locker's wallet
    const tx = new Transaction().add(instruction);
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

    return Response.json({
      success: true,
      policyPda: policyPda.toBase58(),
      transactionBase64: serialized.toString('base64'),
      message: 'Sign and submit this transaction with the locker wallet to create the policy.',
    });
  } catch (err) {
    console.error('[POST /api/worldcup/settle/create]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
