/**
 * EVM contract ABIs & Arc addresses — shared by subscriptions and signal publishing.
 */

export const ARC_CHAIN_ID = 5042002;
export const USDC_DECIMALS = 6;

export const USDC_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export const PREDICTION_RECEIPT_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'marketId', type: 'uint256' },
      { internalType: 'string', name: 'side', type: 'string' },
      { internalType: 'uint256', name: 'stakeUnits', type: 'uint256' },
      { internalType: 'uint16', name: 'oddsBps', type: 'uint16' },
      { internalType: 'string', name: 'uri', type: 'string' },
    ],
    name: 'placePredictionToken',
    outputs: [{ internalType: 'bytes32', name: 'id', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeBps',
    outputs: [{ internalType: 'uint16', name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export function getArcContractEnv() {
  return {
    usdc: process.env.NEXT_PUBLIC_USDC_TOKEN || '',
    predictionReceipt: process.env.NEXT_PUBLIC_PREDICTION_RECEIPT_CONTRACT || '',
    host: process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app',
  };
}

export function isArcPublishConfigured() {
  const { usdc, predictionReceipt } = getArcContractEnv();
  return Boolean(usdc && predictionReceipt);
}
