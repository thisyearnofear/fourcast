#!/usr/bin/env node
/**
 * Solana match-escrow — end-to-end devnet round-trip (TxLINE v4 oracle).
 *
 * The judge-verifiable "do X, see Y" for the Solana settlement leg:
 *
 *   1. book_fixture        — one-time per fixture (free under subscription)
 *   2. create_policy       — lock SOL in a PDA against a TxLINE-verified fixture
 *   3. settle_policy_v4    — ONE transaction that CPIs into txoracle:
 *        validate_fixture_for_tree → validate_stat_v4 → close_worker_ticket
 *      The escrowed SOL pays the recipient (or refunds the locker)
 *      trustlessly — no oracle operator, no trusted party.
 *   4. verify              — policy account closed, balances moved, explorer links
 *
 * Usage:
 *   node scripts/solana-escrow-v4-roundtrip.mjs
 *   node scripts/solana-escrow-v4-roundtrip.mjs --fixture 18041541 --seq 1631 --stat-keys 1,2 --amount 0.05
 *
 * Env:
 *   ESCROW_LOCKER_KEYPAIR   path to a funded devnet keypair JSON
 *                           (default ~/.config/solana/id.json)
 *   TXLINE_DEVNET_API       API origin (default https://txline-dev.txodds.com)
 *   SOLANA_RPC_URL          RPC override (default devnet)
 *   ESCROW_RECIPIENT        override payout address (default: deterministic demo wallet)
 *
 * Auth: reads cache/txline/devnet-auth.json — run
 *   node scripts/txline-devnet-onboard.mjs
 * first if it is missing.
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SystemProgram,
  Ed25519Program,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  MATCH_ESCROW_PROGRAM_ID,
  TXORACLE_PROGRAM_ID,
  buildCreatePolicyIx,
  derivePolicyPda,
  readPolicy,
} from '../services/txline/settlementService.js';
import {
  BACKEND_ADMIN,
  STAT_DOMAIN,
  WORKER_ID,
  TXL_MINT,
  u8,
  u16,
  u32,
  encodeBookFixturePayload,
  encodeFixtureForTreeInput,
  encodeStatPayload,
  encodeStrategy,
  homeWinStrategy,
  sha256,
  fixtureTicketPda,
  workerTicketPda,
  dailyScoresPda,
  makeApi,
} from '../services/txline/v4Codec.js';

const SYSVAR_IX = new PublicKey('Sysvar1nstructions1111111111111111111111111');

const DISC_SETTLE_V4 = createHash('sha256').update('global:settle_policy_v4').digest().subarray(0, 8);
const DISC_BOOK = Buffer.from([48, 127, 234, 70, 187, 214, 206, 109]);

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};

const FIXTURE_ID = Number(arg('fixture', '18041541'));
const SEQ = Number(arg('seq', '1631'));
const STAT_KEYS = arg('stat-keys', '1,2');
const AMOUNT_SOL = Number(arg('amount', '0.05'));
const SIDE = arg('side', 'away'); // 'home' | 'away' — which outcome pays the recipient
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const API_ORIGIN = process.env.TXLINE_DEVNET_API || 'https://txline-dev.txodds.com';

function tokenTreasuryPda() {
  return PublicKey.findProgramAddressSync([Buffer.from('token_treasury_v2')], TXORACLE_PROGRAM_ID)[0];
}

async function sendTx(connection, wallet, ixs, label) {
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  tx.add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet], { commitment: 'confirmed' });
  console.log(`${label}: ${sig}`);
  console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

async function main() {
  const keypairPath =
    process.env.ESCROW_LOCKER_KEYPAIR || join(homedir(), '.config', 'solana', 'id.json');
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8')))
  );
  const auth = JSON.parse(
    readFileSync(join(process.cwd(), 'cache', 'txline', 'devnet-auth.json'), 'utf8')
  );
  const api = makeApi(auth, API_ORIGIN);
  const connection = new Connection(RPC_URL, 'confirmed');
  const user = wallet.publicKey;

  const recipient = process.env.ESCROW_RECIPIENT
    ? new PublicKey(process.env.ESCROW_RECIPIENT)
    : Keypair.fromSeed(
        new TextEncoder().encode('fourcast-escrow-demo-2026'.padEnd(32, '0').slice(0, 32))
      ).publicKey;

  const explorer = (kind, sig) =>
    `https://explorer.solana.com/${kind}/${sig}?cluster=devnet`;

  console.log('── Fourcast match-escrow round-trip v4 (Solana devnet) ──');
  console.log(`wallet    : ${user.toBase58()}`);
  console.log(`recipient : ${recipient.toBase58()}`);
  console.log(`program   : ${MATCH_ESCROW_PROGRAM_ID.toBase58()}`);
  console.log(`txoracle  : ${TXORACLE_PROGRAM_ID.toBase58()}`);
  console.log(`fixture   : ${FIXTURE_ID} seq:${SEQ} statKeys:${STAT_KEYS}`);

  let balance = await connection.getBalance(user);
  console.log(`\nwallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < 0.2 * LAMPORTS_PER_SOL) {
    console.log('→ requesting devnet airdrop (2 SOL)…');
    const sig = await connection.requestAirdrop(user, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, 'confirmed');
    console.log(`  airdrop: ${sig}`);
  }

  // ── 1. Ensure fixture is booked (fixture_ticket PDA exists) ───────────────
  const fixTicket = fixtureTicketPda(TXORACLE_PROGRAM_ID, user, FIXTURE_ID);
  const existing = await connection.getAccountInfo(fixTicket);
  if (!existing) {
    const quote = await api(`/quotes/book-fixture?fixtureId=${FIXTURE_ID}&pubkey=${user.toBase58()}`);
    const qp = quote.payload;
    console.log(`booking fixture (price=${qp.price})…`);
    const payloadEnc = encodeBookFixturePayload({
      user: qp.user, fixtureId: qp.fixtureId, price: qp.price, ts: qp.ts, validity: qp.validity,
    });
    const edIx = Ed25519Program.createInstructionWithPublicKey({
      publicKey: BACKEND_ADMIN.toBuffer(),
      message: sha256(payloadEnc),
      signature: Buffer.from(quote.signature, 'base64'),
    });
    const bookIx = new TransactionInstruction({
      programId: TXORACLE_PROGRAM_ID,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: fixTicket, isSigner: false, isWritable: true },
        { pubkey: TXL_MINT, isSigner: false, isWritable: false },
        { pubkey: getAssociatedTokenAddressSync(TXL_MINT, user, false, TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: true },
        { pubkey: getAssociatedTokenAddressSync(TXL_MINT, tokenTreasuryPda(), true, TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: true },
        { pubkey: tokenTreasuryPda(), isSigner: false, isWritable: false },
        { pubkey: SYSVAR_IX, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([DISC_BOOK, payloadEnc]),
    });
    await sendTx(connection, wallet, [edIx, bookIx], 'book_fixture');
  } else {
    console.log('fixture already booked, reusing fixture_ticket');
  }

  // ── 2. Fetch the signed v4 stat-validation payload ────────────────────────
  const v4 = await api(`/scores/stat-validation-v4?fixtureId=${FIXTURE_ID}&seq=${SEQ}&statKeys=${STAT_KEYS}`);
  const isV2 = v4.version === 'v2' || v4.version === 2;
  const payload = v4.payload;
  const payloadTs = Number(payload.ts);
  console.log(`proof version: ${v4.version}  payload.ts: ${payloadTs}`);

  const paysRecipientOnHomeWin = SIDE === 'home';
  const amountLamports = BigInt(Math.round(AMOUNT_SOL * LAMPORTS_PER_SOL));
  const strategy = homeWinStrategy();

  // The ed25519 message TxLINE verifies = sha256(borsh(StatValidationPayload)).
  const statPayloadEnc = encodeStatPayload(payload, isV2);
  const payloadHash = sha256(statPayloadEnc);
  const edIx = Ed25519Program.createInstructionWithPublicKey({
    publicKey: BACKEND_ADMIN.toBuffer(),
    message: payloadHash,
    signature: Buffer.from(v4.signature, 'base64'),
  });

  // ── 3. create_policy (min_ts = payload.ts — checked on-chain) ─────────────
  const [policyPda] = derivePolicyPda(user, FIXTURE_ID, payloadTs, paysRecipientOnHomeWin);
  console.log(`policy PDA: ${policyPda.toBase58()}`);

  const existingPolicy = await readPolicy(policyPda);
  if (existingPolicy) {
    console.log(`\n⚠ policy already exists on-chain (settled=${existingPolicy.settled}, amount=${existingPolicy.amount / LAMPORTS_PER_SOL} SOL).`);
    if (existingPolicy.settled) {
      console.log('  This fixture+side was already settled — pick --side the other way or a different fixture.');
      process.exit(1);
    }
    console.log('  Continuing to settle the existing policy…');
  } else {
    const { instruction: createIx } = buildCreatePolicyIx({
      locker: user,
      recipient,
      fixtureId: FIXTURE_ID,
      minTs: payloadTs,
      paysRecipientOnHomeWin,
      amountLamports: Number(amountLamports),
    });
    const createTx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      createIx
    );
    createTx.feePayer = user;
    createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    createTx.sign(wallet);
    console.log(`\n→ create_policy: locking ${AMOUNT_SOL} SOL…`);
    const createSig = await sendAndConfirmTransaction(connection, createTx, [wallet], { commitment: 'confirmed' });
    console.log(`  ${explorer('tx', createSig)}`);
    const created = await readPolicy(policyPda);
    console.log(`  policy on-chain: amount=${created.amount / LAMPORTS_PER_SOL} SOL settled=${created.settled}`);
  }

  // ── 4. settle_policy_v4 — ed25519 verify + 3 txoracle CPIs in ONE tx ──────
  const forTree = {
    ts: payloadTs,
    domain: STAT_DOMAIN,
    workerId: WORKER_ID,
    summary: payload.summary,
    mainTreeProof: payload.mainTreeProof,
  };
  const strategyEnc = encodeStrategy(strategy);

  // Anchor arg layout: disc | domain u8 | worker_id u16 | for_tree | payload | strategy
  const settleData = Buffer.concat([
    DISC_SETTLE_V4,
    u8(STAT_DOMAIN),
    u16(WORKER_ID),
    encodeFixtureForTreeInput(forTree),
    statPayloadEnc,
    strategyEnc,
  ]);

  const workerTicket = workerTicketPda(TXORACLE_PROGRAM_ID, user, STAT_DOMAIN, WORKER_ID);
  const dayPda = dailyScoresPda(TXORACLE_PROGRAM_ID, payloadTs);

  const settleIx = new TransactionInstruction({
    programId: MATCH_ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },                    // caller
      { pubkey: policyPda, isSigner: false, isWritable: true },               // policy
      { pubkey: recipient, isSigner: false, isWritable: true },               // recipient
      { pubkey: user, isSigner: false, isWritable: true },                    // locker
      { pubkey: dayPda, isSigner: false, isWritable: false },                 // daily_scores_roots
      { pubkey: workerTicket, isSigner: false, isWritable: true },            // worker_ticket
      { pubkey: fixTicket, isSigner: false, isWritable: false },              // fixture_ticket
      { pubkey: TXORACLE_PROGRAM_ID, isSigner: false, isWritable: false },    // txoracle_program
      { pubkey: SYSVAR_IX, isSigner: false, isWritable: false },              // instructions_sysvar
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },// system_program
    ],
    data: settleData,
  });

  // ed25519 MUST be a top-level instruction before settle_policy_v4 — the
  // txoracle program introspects the instructions sysvar for it.
  console.log('\n→ settle_policy_v4: ed25519 verify + CPI validate_fixture_for_tree → validate_stat_v4 → close_worker_ticket…');
  const settleSig = await sendTx(connection, wallet, [edIx, settleIx], 'settle_policy_v4');

  // ── 5. Verify outcome ─────────────────────────────────────────────────────
  const after = await readPolicy(policyPda);
  const recipientBalance = await connection.getBalance(recipient);
  const walletBalance = await connection.getBalance(user);

  console.log('\n── result ──');
  console.log(`policy account after settle: ${after ? 'STILL EXISTS (unexpected)' : 'closed ✓'}`);
  console.log(`recipient balance: ${recipientBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`wallet balance   : ${walletBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`\nexplorer:`);
  console.log(`  program : ${explorer('address', MATCH_ESCROW_PROGRAM_ID.toBase58())}`);
  console.log(`  policy  : ${explorer('address', policyPda.toBase58())}`);
  console.log(`  txoracle: ${explorer('address', TXORACLE_PROGRAM_ID.toBase58())}`);

  if (!after) {
    console.log('\n✓ escrow settled trustlessly via on-chain oracle proof — policy closed, funds released.');
  }
}

main().catch((err) => {
  console.error('\nround-trip failed:', err?.message || err);
  if (err?.logs) console.error(err.logs.join('\n'));
  process.exit(1);
});
