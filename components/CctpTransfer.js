'use client';

import { useState } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN || '';
const ARC_CHAIN_ID = 5042002;
const POLYGON_CHAIN_ID = 137;

/**
 * CCTP / Gateway Cross-Chain USDC Transfer
 *
 * Allows users to move USDC between Arc (Circle L1) and Polygon
 * for Polymarket order placement. Uses Circle's CCTP (Cross-Chain
 * Transfer Protocol) via the Gateway API.
 *
 * Prerequisites:
 * - Circle API key with CCTP access
 * - Gateway API endpoint configured
 * - USDC deployed on both chains
 *
 * See: https://developers.circle.com/cctp
 */
export default function CctpTransfer({ isNight = false }) {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [amount, setAmount] = useState('10');
  const [direction, setDirection] = useState('arc-to-polygon'); // or 'polygon-to-arc'
  const [txState, setTxState] = useState({ status: 'idle', hash: null, error: null });

  const isOnArc = chainId === ARC_CHAIN_ID;
  const isOnPolygon = chainId === POLYGON_CHAIN_ID;
  const canTransfer = address && (isOnArc || isOnPolygon);

  const handleTransfer = async () => {
    if (!canTransfer || !walletClient || !publicClient) return;

    setTxState({ status: 'initiating', hash: null, error: null });

    try {
      const amountParsed = parseUnits(amount, 6);

      // Step 1: Approve USDC for CCTP contract
      setTxState({ status: 'approving', hash: null, error: null });
      const approveHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: [{
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          name: 'approve',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        }],
        functionName: 'approve',
        args: [
          direction === 'arc-to-polygon'
            ? '0x...' // Arc → Polygon CCTP contract address
            : '0x...', // Polygon → Arc CCTP contract address
          amountParsed,
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2: Initiate CCTP burn/mint via Gateway API
      setTxState({ status: 'transferring', hash: null, error: null });

      const response = await fetch('/api/cctp/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountParsed.toString(),
          fromChain: direction === 'arc-to-polygon' ? 'arc' : 'polygon',
          toChain: direction === 'arc-to-polygon' ? 'polygon' : 'arc',
          fromAddress: address,
          toAddress: address,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Transfer failed');
      }

      setTxState({ status: 'success', hash: result.txHash || result.messageId, error: null });
    } catch (err) {
      console.error('CCTP transfer failed:', err);
      setTxState({ status: 'error', hash: null, error: err?.message || 'Transfer failed' });
    }
  };

  const textColor = 'text-white';
  const mutedColor = 'text-white/50';
  const cardBg = 'bg-white/5 border-white/10';

  return (
    <div className={`rounded-2xl border ${cardBg} p-5 glass-subtle`}>
      <h3 className={`text-sm font-medium ${textColor} mb-1 flex items-center gap-2`}>
        <span>🌀</span> Cross-Chain USDC
      </h3>
      <p className={`text-xs ${mutedColor} mb-4`}>
        Move USDC between Arc and Polygon for Polymarket orders via Circle CCTP.
      </p>
      {/* Direction toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setDirection('arc-to-polygon')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            direction === 'arc-to-polygon'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'bg-white/5 text-white/50 border border-white/10'
          }`}
        >
          Arc → Polygon
        </button>
        <button
          onClick={() => setDirection('polygon-to-arc')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            direction === 'polygon-to-arc'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'bg-white/5 text-white/50 border border-white/10'
          }`}
        >
          Polygon → Arc
        </button>
      </div>
      {/* Amount input */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          step="1"
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-mono bg-transparent border border-white/10 text-white focus:outline-none focus:border-purple-500/50`}
          placeholder="Amount (USDC)"
        />
        <span className={`text-sm ${mutedColor}`}>USDC</span>
      </div>
      {/* Network indicator */}
      <div className={`flex items-center gap-2 mb-4 text-xs ${mutedColor}`}>
        <span className={`w-2 h-2 rounded-full ${canTransfer ? 'bg-green-400' : 'bg-gray-500'}`} />
        <span>
          {!address
            ? 'Connect wallet'
            : !isOnArc && !isOnPolygon
              ? 'Switch to Arc or Polygon'
              : `Ready on ${isOnArc ? 'Arc' : 'Polygon'}`}
        </span>
      </div>
      {/* Transfer button */}
      <button
        onClick={handleTransfer}
        disabled={!canTransfer || txState.status === 'approving' || txState.status === 'transferring'}
        className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
          txState.status === 'success'
            ? 'bg-green-500/20 text-green-400 cursor-default'
            : canTransfer
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
        }`}
      >
        {txState.status === 'success'
          ? '✅ Transfer initiated'
          : txState.status === 'approving'
            ? 'Approving USDC...'
            : txState.status === 'transferring'
              ? 'Transferring...'
              : txState.status === 'error'
                ? `❌ ${txState.error?.slice(0, 40) || 'Failed'}`
                : `Send ${amount || '0'} USDC ${direction === 'arc-to-polygon' ? '→ Polygon' : '→ Arc'}`}
      </button>
      {/* Setup note */}
      {!process.env.NEXT_PUBLIC_CCTP_ENABLED && (
        <p className={`text-xs ${mutedColor} mt-3 text-center`}>
          ⚙️ CCTP not configured — add Circle API key and contract addresses to .env.local
        </p>
      )}
      {/* Docs link */}
      <a
        href="https://developers.circle.com/cctp"
        target="_blank"
        rel="noopener noreferrer"
        className={`block text-center text-xs underline mt-2 ${mutedColor} hover:opacity-80`}
      >
        Circle CCTP Docs ↗
      </a>
    </div>
  );
}
