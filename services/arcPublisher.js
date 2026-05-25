/**
 * Arc (EVM) signal publishing via PredictionReceiptERC20 + USDC.
 * Client-side only — wallet signs transactions.
 */

import { parseUnits } from 'viem';
import {
  USDC_ABI,
  PREDICTION_RECEIPT_ABI,
  USDC_DECIMALS,
  getArcContractEnv,
  isArcPublishConfigured,
} from '@/constants/evmContracts';

export { isArcPublishConfigured };

const CONFIDENCE_BPS = { HIGH: 7000, MEDIUM: 5000, LOW: 3000, UNKNOWN: 5000 };

export function mapSignalToArcArgs(signalData, signalDbId) {
  const { host } = getArcContractEnv();
  const rawId = String(signalData.event_id || signalData.market_title || '0');
  const digits = rawId.replace(/\D/g, '');
  const marketId = BigInt(digits ? digits.slice(0, 15) : '0');

  const side = String(
    signalData.recommended_action ||
      signalData.confidence ||
      'UNKNOWN'
  ).slice(0, 64);

  const oddsBps = CONFIDENCE_BPS[signalData.confidence] ?? CONFIDENCE_BPS.UNKNOWN;
  const uri = signalDbId
    ? `${host}/signal/${signalDbId}`
    : String(signalData.market_snapshot_hash || host).slice(0, 200);

  return { marketId, side, stakeUnits: 0n, oddsBps, uri };
}

/**
 * Publish a prediction receipt on Arc. stakeUnits=0 → zero fee when feeBps applies to stake.
 */
export async function publishSignalOnArc({ walletClient, publicClient, account, signalData, signalDbId }) {
  if (!walletClient || !publicClient || !account) {
    throw new Error('Connect an EVM wallet on Arc testnet');
  }
  if (!isArcPublishConfigured()) {
    throw new Error('Arc prediction contract not configured');
  }

  const { usdc, predictionReceipt } = getArcContractEnv();
  const args = mapSignalToArcArgs(signalData, signalDbId);

  const feeBps = await publicClient.readContract({
    address: predictionReceipt,
    abi: PREDICTION_RECEIPT_ABI,
    functionName: 'feeBps',
  });

  const feeAmount =
    args.stakeUnits > 0n
      ? (args.stakeUnits * BigInt(feeBps)) / 10000n
      : 0n;

  if (feeAmount > 0n) {
    const allowance = await publicClient.readContract({
      address: usdc,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [account, predictionReceipt],
    });
    if (allowance < feeAmount) {
      const approveHash = await walletClient.writeContract({
        address: usdc,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [predictionReceipt, parseUnits('1', USDC_DECIMALS)],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }
  }

  const hash = await walletClient.writeContract({
    address: predictionReceipt,
    abi: PREDICTION_RECEIPT_ABI,
    functionName: 'placePredictionToken',
    args: [args.marketId, args.side, args.stakeUnits, args.oddsBps, args.uri],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error('Arc publish transaction failed');
  }
  return hash;
}
