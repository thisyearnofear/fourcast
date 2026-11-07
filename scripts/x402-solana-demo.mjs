#!/usr/bin/env node
/**
 * x402 on Solana — buyer-side demo client.
 *
 * Walks the canonical x402 payment flow against Fourcast's paid resource:
 *
 *   1. GET the resource → 402 + `Payment-Required` header (price, payee, mint,
 *      network)
 *   2. build a transaction that pays the quoted SPL asset to the payee
 *      (create-idempotent ATAs as needed + `transferChecked`)
 *   3. sign it with the buyer keypair, POST it back in `PAYMENT-SIGNATURE`
 *   4. the server verifies → simulates → broadcasts → confirms → re-reads the
 *      balance delta → delivers the resource
 *
 * Usage:
 *   node scripts/x402-solana-demo.mjs --dry-run
 *   node scripts/x402-solana-demo.mjs --keypair /path/to/keypair.json
 *   X402_BUYER_KEYPAIR=<base58-secret> node scripts/x402-solana-demo.mjs
 *
 * Env:
 *   X402_DEMO_URL       resource URL (default http://localhost:3000/api/signals/premium-solana)
 *   X402_BUYER_KEYPAIR  base58 secret key, or path to a JSON keypair array file
 *   SOLANA_RPC_URL      RPC override (default: devnet)
 */

import { readFileSync } from 'fs';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getMint,
} from '@solana/spl-token';

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58decode(str) {
  const bytes = [0];
  for (const ch of str) {
    const val = B58_ALPHABET.indexOf(ch);
    if (val < 0) throw new Error(`bad base58 char "${ch}"`);
    let carry = val;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of str) {
    if (ch === '1') bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

function loadKeypair() {
  const raw = process.env.X402_BUYER_KEYPAIR;
  if (!raw) throw new Error('Set X402_BUYER_KEYPAIR (base58 secret or path to JSON keypair file).');
  if (raw.trim().startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  try {
    const parsed = JSON.parse(readFileSync(raw, 'utf8'));
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch {
    /* not a file path — treat as base58 secret */
  }
  return Keypair.fromSecretKey(bs58decode(raw.trim()));
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const RESOURCE_URL = arg('--url', process.env.X402_DEMO_URL || 'http://localhost:3000/api/signals/premium-solana');
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log(`→ GET ${RESOURCE_URL}`);
  const quote = await fetch(RESOURCE_URL, { method: 'GET' });
  const quoteBody = await quote.json().catch(() => null);

  if (quote.status !== 402) {
    console.log(`  unexpected status ${quote.status}`);
    console.log(JSON.stringify(quoteBody, null, 2).slice(0, 800));
    if (quote.status === 503) {
      console.log('\n  (server has x402 disabled or unconfigured — set X402_SOLANA_ENABLED=true, X402_USDC_CEILING, X402_SOLANA_PAY_TO)');
    }
    process.exit(quote.status === 402 ? 0 : 1);
  }

  const requirementHeader = quote.headers.get('payment-required');
  if (!requirementHeader) {
    console.log('  402 without a Payment-Required header — cannot continue');
    process.exit(1);
  }
  const requirement = JSON.parse(Buffer.from(requirementHeader, 'base64').toString('utf8'));
  const accept = requirement.accepts?.[0];
  if (!accept) {
    console.log('  requirement carried no accepts[] — cannot continue');
    process.exit(1);
  }

  const amount = BigInt(accept.maxAmountRequired);
  const payTo = new PublicKey(accept.payTo);
  const mint = new PublicKey(accept.asset);
  const network = accept.network;

  console.log(`  network : ${network}`);
  console.log(`  payTo   : ${payTo.toBase58()}`);
  console.log(`  mint    : ${mint.toBase58()}`);
  console.log(`  amount  : ${amount} base units`);

  if (DRY_RUN) {
    console.log('\n(dry run — no payment attempted)');
    return;
  }

  const buyer = loadKeypair();
  console.log(`  buyer   : ${buyer.publicKey.toBase58()}`);

  const [buyerAta, sellerAta] = await Promise.all([
    getAssociatedTokenAddress(mint, buyer.publicKey),
    getAssociatedTokenAddress(mint, payTo),
  ]);
  const mintInfo = await getMint(connection, mint);

  const buyerBalance = await getAccount(connection, buyerAta).then((a) => a.amount).catch(() => 0n);
  if (buyerBalance < amount) {
    console.error(`\n  buyer ATA ${buyerAta.toBase58()} holds ${buyerBalance} base units — need ${amount}.`);
    console.error(`  Fund it with devnet ${accept.extra?.name || 'SPL'} first (faucet / seller transfer).`);
    process.exit(1);
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: buyer.publicKey, blockhash });

  // Create the payee's ATA if needed (idempotent — safe to include always).
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      buyer.publicKey,
      sellerAta,
      payTo,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  // Create the buyer's ATA if needed.
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      buyer.publicKey,
      buyerAta,
      buyer.publicKey,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  // The payment itself: transferChecked (mint + decimals are in-band).
  tx.add(
    createTransferCheckedInstruction(
      buyerAta,
      mint,
      sellerAta,
      buyer.publicKey,
      amount,
      mintInfo.decimals,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  tx.sign(buyer);
  const txBase64 = tx.serialize().toString('base64');

  const paymentSignature = Buffer.from(
    JSON.stringify({
      x402Version: 1,
      resource: RESOURCE_URL,
      accepted: accept,
      payload: { transaction: txBase64 },
    })
  ).toString('base64');

  console.log(`\n→ POST ${RESOURCE_URL} (PAYMENT-SIGNATURE)`);
  console.log(`  paying ${amount} base units of ${mint.toBase58()} → ${sellerAta.toBase58()}`);

  const res = await fetch(RESOURCE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'payment-signature': paymentSignature,
    },
    body: JSON.stringify({ runId: `demo-${Date.now()}` }),
  });
  const body = await res.json().catch(() => null);

  console.log(`  status: ${res.status}`);
  if (body?.settlement) {
    console.log(`  settled: ${body.settlement.txSignature}`);
    console.log(`  explorer: ${body.settlement.explorer}`);
  }
  if (body?.signalCount !== undefined) {
    console.log(`  delivered: ${body.signalCount} signal(s)`);
  }
  if (!body?.success) {
    console.log(JSON.stringify(body, null, 2).slice(0, 1200));
  } else {
    console.log('\n✓ payment verified on-chain and resource delivered');
  }
  process.exit(body?.success ? 0 : 1);
}

main().catch((err) => {
  console.error('demo failed:', err?.message || err);
  process.exit(1);
});
