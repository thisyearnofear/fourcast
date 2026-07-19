import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { derivePolicyPda, readPolicy, getProgramInfo } from '@/services/txline/settlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/worldcup/settle/status?locker=...&fixtureId=...&minTs=...&paysRecipient=...
 *   Returns the on-chain policy state (if it exists) + program info.
 *
 * GET /api/worldcup/settle/status
 *   Returns just the program info (program ID, network, explorer URL).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const info = getProgramInfo();

    const lockerStr = searchParams.get('locker');
    const fixtureId = searchParams.get('fixtureId');
    const minTs = searchParams.get('minTs');
    const paysRecipient = searchParams.get('paysRecipient') === 'true';

    if (!lockerStr || !fixtureId || !minTs) {
      return Response.json({ success: true, program: info });
    }

    const locker = new PublicKey(lockerStr);
    const [policyPda] = derivePolicyPda(locker, Number(fixtureId), Number(minTs), paysRecipient);
    const policy = await readPolicy(policyPda);

    return Response.json({
      success: true,
      program: info,
      policyPda: policyPda.toBase58(),
      policy: policy ? {
        ...policy,
        locker: policy.locker.toBase58(),
        recipient: policy.recipient.toBase58(),
        amountSol: policy.amount / LAMPORTS_PER_SOL,
      } : null,
    });
  } catch (err) {
    console.error('[GET /api/worldcup/settle/status]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
