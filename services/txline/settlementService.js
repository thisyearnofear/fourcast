/**
 * On-chain settlement service for TxLINE-verified parametric sports insurance.
 *
 * This service builds and sends transactions to the match-escrow Solana program
 * (devnet: AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ). The program CPI-calls
 * TxLINE's txoracle::validate_stat to trustlessly verify match outcomes and
 * release escrowed SOL to the winner.
 *
 * Flow:
 *   1. createPolicy(fixtureId, minTs, paysRecipientOnHomeWin, amount Lamports)
 *      → locks SOL in a PDA, records the condition
 *   2. settlePolicy(fixtureId, proof)
 *      → CPI-calls validate_stat with the TxLINE Merkle proof
 *      → if the condition is met, SOL transfers to the recipient; else refunds locker
 */

import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';

export const MATCH_ESCROW_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_MATCH_ESCROW_PROGRAM_ID || 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ'
);
export const TXORACLE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TXORACLE_PROGRAM_ID || '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'
);

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// Instruction discriminators (first 8 bytes of sha256("global:<method_name>"))
const CREATE_DISC = Buffer.from([27, 81, 33, 27, 196, 103, 246, 53]);
const SETTLE_DISC = Buffer.from([180, 234, 21, 174, 50, 214, 91, 113]);

function getConnection() {
  return new Connection(RPC_URL, 'confirmed');
}

/**
 * Derive the policy PDA. Seeds must match the Rust program:
 *   [b"policy", locker, fixture_id(8 LE), min_ts(8 LE), [pays_recipient_on_home_win as u8]]
 */
export function derivePolicyPda(locker, fixtureId, minTs, paysRecipientOnHomeWin) {
  const seeds = [
    Buffer.from('policy'),
    locker.toBuffer(),
    new BN(fixtureId).toArrayLike(Buffer, 'le', 8),
    new BN(minTs).toArrayLike(Buffer, 'le', 8),
    Buffer.from([paysRecipientOnHomeWin ? 1 : 0]),
  ];
  return PublicKey.findProgramAddressSync(seeds, MATCH_ESCROW_PROGRAM_ID);
}

/**
 * Derive the TxLINE daily_scores_roots PDA for a given timestamp.
 * Seeds: [b"daily_scores_roots", epoch_day as u16 LE]
 */
export function deriveDailyScoresPda(minTs) {
  const epochDay = Math.floor(minTs / (24 * 60 * 60 * 1000));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('daily_scores_roots'), Buffer.from(new BN(epochDay).toArrayLike(Buffer, 'le', 2))],
    TXORACLE_PROGRAM_ID
  );
}

/**
 * Build the create_policy instruction.
 * Caller (locker) signs and funds the policy PDA with `amount` lamports.
 */
export function buildCreatePolicyIx({ locker, recipient, fixtureId, minTs, paysRecipientOnHomeWin, amountLamports }) {
  const [policyPda] = derivePolicyPda(locker, fixtureId, minTs, paysRecipientOnHomeWin);

  const data = Buffer.concat([
    CREATE_DISC,
    new BN(fixtureId).toArrayLike(Buffer, 'le', 8),
    new BN(minTs).toArrayLike(Buffer, 'le', 8),
    Buffer.from([paysRecipientOnHomeWin ? 1 : 0]),
    new BN(amountLamports).toArrayLike(Buffer, 'le', 8),
  ]);

  return {
    instruction: new TransactionInstruction({
      programId: MATCH_ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: locker, isSigner: true, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: false },
        { pubkey: policyPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    }),
    policyPda,
  };
}

/**
 * Build the settle_policy instruction with the full TxLINE Merkle proof.
 * This CPI-calls txoracle::validate_stat to verify the match outcome on-chain.
 */
export function buildSettlePolicyIx({ caller, locker, recipient, fixtureId, minTs, paysRecipientOnHomeWin, proof }) {
  const [policyPda] = derivePolicyPda(locker, fixtureId, minTs, paysRecipientOnHomeWin);
  const [dailyScoresPda] = deriveDailyScoresPda(minTs);

  const ts = proof.summary.updateStats.minTimestamp;
  const toBytes32 = (arr) => Buffer.from(arr);

  // Build Borsh-serialised settle_policy data (must match the Rust layout)
  const parts = [];
  parts.push(SETTLE_DISC);
  parts.push(new BN(ts).toArrayLike(Buffer, 'le', 8)); // ts: i64
  // fixture_summary: ScoresBatchSummary
  parts.push(new BN(proof.summary.fixtureId).toArrayLike(Buffer, 'le', 8)); // fixture_id: i64
  parts.push(Buffer.from(new Int32Array([proof.summary.updateStats.updateCount]).buffer)); // update_count: i32
  parts.push(new BN(proof.summary.updateStats.minTimestamp).toArrayLike(Buffer, 'le', 8)); // min_timestamp: i64
  parts.push(new BN(proof.summary.updateStats.maxTimestamp).toArrayLike(Buffer, 'le', 8)); // max_timestamp: i64
  parts.push(toBytes32(proof.summary.eventStatsSubTreeRoot)); // events_sub_tree_root: [u8;32]
  // fixture_proof: Vec<ProofNode>
  parts.push(Buffer.from(new Uint32Array([proof.subTreeProof.length]).buffer));
  for (const node of proof.subTreeProof) {
    parts.push(toBytes32(node.hash));
    parts.push(Buffer.from([node.isRightSibling ? 1 : 0]));
  }
  // main_tree_proof: Vec<ProofNode>
  parts.push(Buffer.from(new Uint32Array([proof.mainTreeProof.length]).buffer));
  for (const node of proof.mainTreeProof) {
    parts.push(toBytes32(node.hash));
    parts.push(Buffer.from([node.isRightSibling ? 1 : 0]));
  }
  // predicate: { threshold: i32, comparison: enum }
  parts.push(Buffer.from(new Int32Array([0]).buffer)); // threshold = 0
  parts.push(Buffer.from([0])); // GreaterThan = 0
  // stat_a: home goals (key=1)
  parts.push(Buffer.from(new Uint32Array([proof.statToProve.key]).buffer));
  parts.push(Buffer.from(new Int32Array([proof.statToProve.value]).buffer));
  parts.push(Buffer.from(new Int32Array([proof.statToProve.period]).buffer));
  parts.push(toBytes32(proof.eventStatRoot));
  parts.push(Buffer.from(new Uint32Array([proof.statProof.length]).buffer));
  for (const node of proof.statProof) {
    parts.push(toBytes32(node.hash));
    parts.push(Buffer.from([node.isRightSibling ? 1 : 0]));
  }
  // stat_b: away goals (key=2) — Option<StatTerm> = Some
  parts.push(Buffer.from([1]));
  parts.push(Buffer.from(new Uint32Array([proof.statToProve2.key]).buffer));
  parts.push(Buffer.from(new Int32Array([proof.statToProve2.value]).buffer));
  parts.push(Buffer.from(new Int32Array([proof.statToProve2.period]).buffer));
  parts.push(toBytes32(proof.eventStatRoot));
  parts.push(Buffer.from(new Uint32Array([proof.statProof2.length]).buffer));
  for (const node of proof.statProof2) {
    parts.push(toBytes32(node.hash));
    parts.push(Buffer.from([node.isRightSibling ? 1 : 0]));
  }
  // op: Option<BinaryExpression> = Some(Subtract)
  parts.push(Buffer.from([1])); // Some
  parts.push(Buffer.from([1])); // Subtract = 1

  const data = Buffer.concat(parts);

  return {
    instruction: new TransactionInstruction({
      programId: MATCH_ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: caller, isSigner: true, isWritable: true },
        { pubkey: policyPda, isSigner: false, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: true },
        { pubkey: locker, isSigner: false, isWritable: true },
        { pubkey: dailyScoresPda, isSigner: false, isWritable: false },
        { pubkey: TXORACLE_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    }),
    policyPda,
    dailyScoresPda,
  };
}

/**
 * Read a policy account and decode its fields.
 * Layout: 8(disc) + 32(locker) + 32(recipient) + 8(fixture_id) + 8(min_ts) + 1(pays) + 8(amount) + 1(settled) + 1(bump)
 */
export async function readPolicy(policyPda) {
  const conn = getConnection();
  const acc = await conn.getAccountInfo(policyPda);
  if (!acc || !acc.owner.equals(MATCH_ESCROW_PROGRAM_ID)) return null;
  const d = acc.data;
  return {
    locker: new PublicKey(d.slice(8, 40)),
    recipient: new PublicKey(d.slice(40, 72)),
    fixtureId: new BN(d.slice(72, 80), 'le').toNumber(),
    minTs: new BN(d.slice(80, 88), 'le').toNumber(),
    paysRecipientOnHomeWin: d[88] === 1,
    amount: new BN(d.slice(89, 97), 'le').toNumber(),
    settled: d[97] === 1,
    bump: d[98],
    lamports: acc.lamports,
    rentExempt: acc.lamports > 0,
  };
}

/**
 * Get the deployed program info for the UI.
 */
export function getProgramInfo() {
  return {
    programId: MATCH_ESCROW_PROGRAM_ID.toBase58(),
    txoracleProgramId: TXORACLE_PROGRAM_ID.toBase58(),
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
    explorer: 'https://explorer.solana.com',
    rpcUrl: RPC_URL.replace(/\?api-key=.*/, ''),
  };
}

const settlementService = {
  derivePolicyPda,
  deriveDailyScoresPda,
  buildCreatePolicyIx,
  buildSettlePolicyIx,
  readPolicy,
  getProgramInfo,
  MATCH_ESCROW_PROGRAM_ID,
  TXORACLE_PROGRAM_ID,
};

export default settlementService;
