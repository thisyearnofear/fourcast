/**
 * GET /api/near/quote — the Intents leg, read-only.
 *
 *   ?amount=<smallest units>  quote amount (default NEAR_INTENTS_AMOUNT / 1 NEAR)
 *   ?origin=<assetId>         origin asset id (default NEAR_INTENTS_ORIGIN_ASSET / wrap.near)
 *   ?dest=<assetId>           destination asset id (default USDC on NEAR)
 *   ?status=<depositAddress>  execution status for a real deposit instead of a quote
 *
 * Quotes are ALWAYS dry — this surface never mints a deposit address. A live
 * (non-dry) quote is a deliberate POST-side decision, not something a page
 * load can trigger. Recipient/refund resolve to NEAR_INTENTS_RECIPIENT or
 * the agent treasury account.
 */
import { getQuote, getExecutionStatus } from '@/services/near/nearIntents';
import { getNearConfig } from '@/services/near/nearConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verified pair (2026-11-05): Solana USDC → USDC on NEAR — the demo's
// "deposit from any chain" leg. wrap.near origins return "pair not available".
const USDC_NEAR = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const USDC_SOL = 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near';
const TEN_USDC = '10000000'; // 6dp

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const config = getNearConfig();

  const statusAddr = searchParams.get('status');
  if (statusAddr) {
    try {
      const status = await getExecutionStatus({ depositAddress: statusAddr });
      return Response.json({ success: true, kind: 'status', status });
    } catch (err) {
      return Response.json({ success: false, error: err.message }, { status: 502 });
    }
  }

  const recipient =
    process.env.NEAR_INTENTS_RECIPIENT || config.accountId || 'fourcast-agent.near';

  try {
    const res = await getQuote({
      originAsset: searchParams.get('origin') || process.env.NEAR_INTENTS_ORIGIN_ASSET || USDC_SOL,
      destinationAsset: searchParams.get('dest') || process.env.NEAR_INTENTS_DEST_ASSET || USDC_NEAR,
      amount: searchParams.get('amount') || process.env.NEAR_INTENTS_AMOUNT || TEN_USDC,
      recipient,
      refundTo: recipient,
      dry: true,
    });
    const q = res?.quote || res;
    return Response.json({
      success: true,
      kind: 'quote',
      dry: true,
      recipient,
      quote: {
        originAsset: q?.originAsset || null,
        destinationAsset: q?.destinationAsset || null,
        amountIn: q?.amountIn || null,
        amountInFormatted: q?.amountInFormatted || null,
        amountOut: q?.amountOut || null,
        amountOutFormatted: q?.amountOutFormatted || null,
        minAmountOut: q?.minAmountOut || null,
        depositAddress: q?.depositAddress || null,
        deadline: q?.deadline || null,
        timeEstimate: q?.timeEstimate ?? null,
      },
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 502 });
  }
}
