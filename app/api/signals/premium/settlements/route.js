import { recentSettlements } from '@/services/payments/x402Sui/spendLedger.js';
import {
  PAYMENT_REASONS,
  fromBaseUnits,
  isEnabled,
  premiumPrice,
  sellerAddress,
  settlementNetwork,
} from '@/services/payments/x402Sui/types.js';
import * as solana from '@/services/payments/x402Solana/types.js';

export const runtime = 'nodejs';

/**
 * GET /api/signals/premium/settlements — the paid rail's receipts.
 *
 * The read side of WP5. A settlement that happened is a receipt: the digest,
 * the amount, the network, and the signal it bought. This endpoint is what
 * lets the product SHOW the payment instead of only performing it.
 *
 * It also reports whether the rail is on and why it is off, because "the paid
 * rail is disabled" and "nothing has gone through the paid rail yet" are
 * different facts and only one of them is a bug.
 */
export async function GET(request) {
  const net = settlementNetwork(process.env);
  const enabled = isEnabled(process.env);
  const price = premiumPrice(process.env).baseUnits;
  const seller = sellerAddress(process.env);

  // The Solana rail shares the x402_payments ledger, so `settlements` below
  // already contains both chains' receipts — but "is the rail on" must be
  // answered per rail, not just for Sui.
  const solNet = solana.settlementNetwork(process.env);
  const solEnabled = solana.isEnabled(process.env);
  const solPrice = solana.premiumPrice(process.env).baseUnits;
  const solSeller = solana.sellerAddress(process.env);
  const solAsset = solana.assetMint(process.env);

  let settlements = [];
  let error = null;
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit')) || 5;
    settlements = await recentSettlements({ limit });
  } catch (err) {
    error = err?.message || 'The settlement ledger could not be read.';
  }

  const delivered = settlements.filter((row) => row.status === 'delivered');
  const totalUsdc = delivered.reduce((sum, row) => sum + row.usdc, 0);

  return Response.json(
    {
      success: !error,
      // Top-level `enabled` means "at least one rail can take a payment" —
      // the strip's off-copy must not fire while Solana is live.
      enabled: enabled || solEnabled,
      reason: enabled || solEnabled ? null : PAYMENT_REASONS.X402_DISABLED,
      settlementNetwork: net.network,
      price: { baseUnits: price, usdc: fromBaseUnits(price) },
      seller,
      rails: {
        sui: {
          enabled,
          reason: enabled ? null : PAYMENT_REASONS.X402_DISABLED,
          settlementNetwork: net.network,
          seller,
          price: { baseUnits: price, usdc: fromBaseUnits(price) },
        },
        solana: {
          enabled: solEnabled,
          reason: solEnabled ? null : solana.PAYMENT_REASONS.X402_DISABLED,
          settlementNetwork: solNet.network,
          seller: solSeller,
          assetMint: solAsset.mint,
          price: { baseUnits: solPrice, usdc: solana.fromBaseUnits(solPrice, solAsset.decimals || 6) },
        },
      },
      settlements,
      summary: {
        settled: delivered.length,
        listed: settlements.length,
        totalUsdc,
        totalUsdcHuman: fromBaseUnits(totalUsdc),
      },
      error,
    },
    { status: error ? 500 : 200 }
  );
}
