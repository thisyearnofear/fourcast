'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Lock, Unlock, Zap, ExternalLink, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * OnChainSettlementPanel — UI for the TxLINE-verified parametric sports insurance.
 *
 * Flow:
 *   1. User connects their Solana wallet (or uses the demo wallet)
 *   2. User locks SOL on a match outcome (home win / away win)
 *   3. Anyone clicks "Settle on-chain" → CPI-calls txoracle::validate_stat
 *   4. Funds auto-release to the winner based on the verified result
 *
 * The Solana program (match-escrow) is deployed on devnet.
 */

const PROGRAM_ID = 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ';
const TXORACLE_ID = '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J';

export default function OnChainSettlementPanel({ fixture, proof }) {
  const [programInfo, setProgramInfo] = useState(null);
  const [policyState, setPolicyState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txSig, setTxSig] = useState(null);
  const [amountSol, setAmountSol] = useState('0.1');
  const [side, setSide] = useState('home'); // 'home' or 'away'
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletPubkey, setWalletPubkey] = useState(null);

  // Check for Solana wallet
  useEffect(() => {
    if (typeof window !== 'undefined' && window.solana) {
      if (window.solana.publicKey) {
        setWalletConnected(true);
        setWalletPubkey(window.solana.publicKey.toBase58());
      }
      window.solana.on?.('connect', () => {
        setWalletConnected(true);
        setWalletPubkey(window.solana.publicKey?.toBase58());
      });
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window !== 'undefined' && window.solana) {
      try {
        await window.solana.connect();
        setWalletConnected(true);
        setWalletPubkey(window.solana.publicKey?.toBase58());
      } catch (e) {
        setError('Wallet connection failed: ' + e.message);
      }
    } else {
      setError('No Solana wallet found. Install Phantom or Solflare.');
    }
  }, []);

  // Fetch program info
  useEffect(() => {
    fetch('/api/worldcup/settle/status')
      .then(r => r.json())
      .then(d => setProgramInfo(d.program))
      .catch(() => {});
  }, []);

  const fixtureId = fixture?.id;
  const minTs = proof?.summary?.updateStats?.minTimestamp;
  const homeTeam = fixture?.home?.name || 'Home';
  const awayTeam = fixture?.away?.name || 'Away';
  const homeGoals = proof?.statToProve?.value;
  const awayGoals = proof?.statToProve2?.value;
  const homeWon = homeGoals != null && awayGoals != null && homeGoals > awayGoals;

  const paysRecipientOnHomeWin = side === 'home';

  const checkPolicy = useCallback(async () => {
    if (!walletPubkey || !fixtureId || !minTs) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/worldcup/settle/status?locker=${walletPubkey}&fixtureId=${fixtureId}&minTs=${minTs}&paysRecipient=${paysRecipientOnHomeWin}`
      ).then(r => r.json());
      setPolicyState(res.policy);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [walletPubkey, fixtureId, minTs, paysRecipientOnHomeWin]);

  const createPolicy = useCallback(async () => {
    if (!walletConnected || !window.solana?.publicKey) {
      setError('Connect your Solana wallet first');
      return;
    }
    setLoading(true);
    setError(null);
    setTxSig(null);
    try {
      const lamports = Math.floor(parseFloat(amountSol) * 1e9);
      if (lamports <= 0) throw new Error('Amount must be > 0');

      const locker = window.solana.publicKey.toBase58();
      // Recipient = same wallet (for demo; in production this would be a different party)
      const recipient = locker;

      const res = await fetch('/api/worldcup/settle/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locker, recipient, fixtureId, minTs,
          paysRecipientOnHomeWin,
          amountLamports: lamports,
        }),
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error);

      // Sign and submit the transaction
      const { Transaction } = await import('@solana/web3.js');
      const txBuf = Buffer.from(res.transactionBase64, 'base64');
      const tx = Transaction.from(txBuf);
      tx.feePayer = window.solana.publicKey;
      const { Connection } = await import('@solana/web3.js');
      const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
      const blockhash = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash.blockhash;
      const signed = await window.solana.signTransaction(tx);
      const sig = await conn.sendRawTransaction(signed.serialize());
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);
      await checkPolicy();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [walletConnected, amountSol, fixtureId, minTs, paysRecipientOnHomeWin, checkPolicy]);

  const settlePolicy = useCallback(async () => {
    if (!walletConnected || !window.solana?.publicKey) {
      setError('Connect your Solana wallet first');
      return;
    }
    setLoading(true);
    setError(null);
    setTxSig(null);
    try {
      const caller = window.solana.publicKey.toBase58();
      const locker = policyState?.locker || caller;
      const recipient = policyState?.recipient || caller;

      const res = await fetch('/api/worldcup/settle/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller, locker, recipient, fixtureId,
          paysRecipientOnHomeWin,
        }),
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error);

      // Sign and submit
      const { Transaction, Connection } = await import('@solana/web3.js');
      const txBuf = Buffer.from(res.transactionBase64, 'base64');
      const tx = Transaction.from(txBuf);
      tx.feePayer = window.solana.publicKey;
      const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
      const blockhash = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash.blockhash;
      const signed = await window.solana.signTransaction(tx);
      const sig = await conn.sendRawTransaction(signed.serialize());
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);
      await checkPolicy();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [walletConnected, policyState, fixtureId, paysRecipientOnHomeWin, checkPolicy]);

  if (!proof?.statToProve) return null;

  return (
    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.06] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-emerald-200">
          <Shield size={14} />
          On-Chain Settlement Engine
        </div>
        <a
          href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-emerald-300/70 hover:text-emerald-200 inline-flex items-center gap-1"
        >
          Program <ExternalLink size={10} />
        </a>
      </div>

      <div className="text-[11px] text-white/60 leading-relaxed">
        Lock SOL in a Solana program that CPI-calls <code className="text-emerald-300">txoracle::validate_stat</code> to
        trustlessly verify the match outcome. Funds auto-release to the winner — no oracle, no trusted party.
      </div>

      {/* Match result from the proof */}
      <div className="rounded-lg bg-black/30 border border-white/10 p-2.5 text-[11px] space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-white/50">Verified result:</span>
          <span className="font-mono text-emerald-300">
            {homeTeam} {homeGoals} - {awayGoals} {awayTeam}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">Merkle proof:</span>
          <span className="font-mono text-white/70">
            {proof.subTreeProof?.length || 0} + {proof.mainTreeProof?.length || 0} + {proof.statProof?.length || 0} nodes
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">On-chain PDA:</span>
          <a
            href={`https://explorer.solana.com/address/${TXORACLE_ID}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-emerald-300/70 hover:text-emerald-200"
          >
            txoracle devnet
          </a>
        </div>
      </div>

      {/* Wallet connection */}
      {!walletConnected ? (
        <button
          onClick={connectWallet}
          className="w-full rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium py-2 hover:bg-emerald-500/30 transition-colors"
        >
          Connect Solana Wallet
        </button>
      ) : (
        <div className="text-[10px] text-white/50 font-mono truncate">
          Wallet: {walletPubkey?.slice(0, 8)}...{walletPubkey?.slice(-6)}
        </div>
      )}

      {/* Policy creation form */}
      {walletConnected && !policyState && (
        <div className="space-y-2">
          <div className="text-[11px] text-white/70 font-medium">Create a parametric insurance policy:</div>
          <div className="flex gap-2">
            <button
              onClick={() => setSide('home')}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                side === 'home'
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/15 bg-white/[0.04] text-white/60'
              }`}
            >
              {homeTeam} wins
            </button>
            <button
              onClick={() => setSide('away')}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                side === 'away'
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/15 bg-white/[0.04] text-white/60'
              }`}
            >
              {awayTeam} wins
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amountSol}
              onChange={e => setAmountSol(e.target.value)}
              className="flex-1 rounded-lg bg-black/30 border border-white/15 px-2 py-1.5 text-[11px] text-white/80 font-mono"
              placeholder="SOL amount"
            />
            <span className="text-[11px] text-white/50">SOL</span>
          </div>
          <button
            onClick={createPolicy}
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-semibold py-2 hover:bg-emerald-500/40 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
            Lock {amountSol} SOL on {side === 'home' ? homeTeam : awayTeam}
          </button>
        </div>
      )}

      {/* Policy state + settle */}
      {policyState && (
        <div className="space-y-2">
          <div className="rounded-lg bg-black/30 border border-white/10 p-2.5 text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50">Policy PDA:</span>
              <span className="font-mono text-white/70 text-[10px]">{policyState.locker?.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Escrowed:</span>
              <span className="font-mono text-emerald-300">{policyState.amountSol?.toFixed(4)} SOL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Condition:</span>
              <span className="font-mono text-white/70">
                {policyState.paysRecipientOnHomeWin ? homeTeam : awayTeam} wins
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Status:</span>
              <span className={`font-mono ${policyState.settled ? 'text-emerald-300' : 'text-yellow-300'}`}>
                {policyState.settled ? 'SETTLED' : 'OPEN'}
              </span>
            </div>
          </div>

          {!policyState.settled && (
            <button
              onClick={settlePolicy}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-semibold py-2 hover:bg-emerald-500/40 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Settle on-chain (CPI validate_stat)
            </button>
          )}

          {policyState.settled && (
            <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 p-2.5 text-[11px] text-emerald-200 inline-flex items-center gap-1.5 w-full">
              <CheckCircle2 size={14} />
              Settled trustlessly via TxLINE Merkle proof
            </div>
          )}
        </div>
      )}

      {/* Transaction result */}
      {txSig && (
        <a
          href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg bg-black/30 border border-emerald-400/20 p-2 text-[10px] text-emerald-300/80 hover:text-emerald-200 font-mono truncate inline-flex items-center gap-1"
        >
          <ExternalLink size={10} /> {txSig.slice(0, 20)}...
        </a>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-400/20 p-2 text-[10px] text-red-300 inline-flex items-center gap-1.5 w-full">
          <AlertTriangle size={12} /> {error.slice(0, 120)}
        </div>
      )}
    </div>
  );
}
