#!/usr/bin/env node
/**
 * TxLINE devnet onboarding: guest JWT → free-tier subscribe → API token.
 *
 * Uses service level 1 (free tier — no TxL purchase required) for 4 weeks.
 * Writes { jwt, apiToken, txSig, wallet } to cache/txline/devnet-auth.json
 * (gitignored) for the v4 validation scripts to reuse.
 *
 *   ESCROW_LOCKER_KEYPAIR=~/.config/solana/id.json node scripts/txline-devnet-onboard.mjs
 *
 * Env:
 *   ESCROW_LOCKER_KEYPAIR  path to a solana CLI keypair JSON (default ~/.config/solana/id.json)
 *   TXLINE_DEVNET_API      default https://txline-dev.txodds.com
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import nacl from 'tweetnacl';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const API_ORIGIN = process.env.TXLINE_DEVNET_API || 'https://txline-dev.txodds.com';
const PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
const TXL_MINT = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
const SERVICE_LEVEL_ID = 1; // free tier
const WEEKS = 4;

const SUBSCRIBE_DISC = Buffer.from([254, 28, 191, 138, 156, 179, 183, 53]);

function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

async function main() {
  const keypairPath =
    process.env.ESCROW_LOCKER_KEYPAIR || join(homedir(), '.config/solana/id.json');
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8')))
  );
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log('wallet:', wallet.publicKey.toBase58());

  // 1. Guest JWT
  const authRes = await fetch(`${API_ORIGIN}/auth/guest/start`, { method: 'POST' });
  if (!authRes.ok) throw new Error(`guest/start -> ${authRes.status}`);
  const { token: jwt } = await authRes.json();
  console.log('guest JWT acquired');

  // 2. Ensure the (frozen) TxL ATA exists — subscribe needs the account present
  //    even on the free tier.
  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const pricingMatrix = pda([Buffer.from('pricing_matrix')]);
  const tokenTreasuryPda = pda([Buffer.from('token_treasury_v2')]);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_MINT,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction();
  const existing = await connection.getAccountInfo(userTokenAccount);
  if (!existing) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenAccount,
        wallet.publicKey,
        TXL_MINT,
        TOKEN_2022_PROGRAM_ID
      )
    );
    console.log('creating TxL token account…');
  }

  let sig;
  const subCache = join(process.cwd(), 'cache', 'txline', 'devnet-subscribe.json');
  try {
    sig = JSON.parse(readFileSync(subCache, 'utf8')).txSig;
    console.log('reusing subscribe tx:', sig);
  } catch {
    const args = Buffer.concat([
    Buffer.from(new Uint16Array([SERVICE_LEVEL_ID]).buffer),
    Buffer.from([WEEKS]),
  ]);
  tx.add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: pricingMatrix, isSigner: false, isWritable: false },
        { pubkey: TXL_MINT, isSigner: false, isWritable: false },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
        { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([SUBSCRIBE_DISC, args]),
    }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })
  );
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(wallet);

  console.log('submitting subscribe tx (free tier, no TxL needed)…');
  sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('subscribe confirmed:', sig);
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  mkdirSync(join(process.cwd(), 'cache', 'txline'), { recursive: true });
  writeFileSync(subCache, JSON.stringify({ txSig: sig }));
  }

  // 3. Activate API token: sign `${txSig}::${jwt}` (empty league bundle)
  const message = `${sig}::${jwt}`;
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    wallet.secretKey // tweetnacl expects the full 64-byte secret key
  );
  const actRes = await fetch(`${API_ORIGIN}/api/token/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      txSig: sig,
      walletSignature: Buffer.from(signature).toString('base64'),
      leagues: [],
    }),
  });
  if (!actRes.ok) {
    throw new Error(`token/activate -> ${actRes.status}: ${(await actRes.text()).slice(0, 300)}`);
  }
  const actText = await actRes.text();
  let apiToken;
  try {
    const actData = JSON.parse(actText);
    apiToken = actData.token || actData;
  } catch {
    apiToken = actText.trim(); // endpoint may return the raw token as text
  }
  if (!apiToken || typeof apiToken !== 'string') {
    throw new Error(`token/activate returned unusable body: ${actText.slice(0, 200)}`);
  }
  console.log('API token activated');

  // 4. Persist (cache/ is gitignored)
  const out = {
    jwt,
    apiToken,
    subscribeTx: sig,
    wallet: wallet.publicKey.toBase58(),
    apiOrigin: API_ORIGIN,
    activatedAt: new Date().toISOString(),
  };
  const dir = join(process.cwd(), 'cache', 'txline');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'devnet-auth.json'), JSON.stringify(out, null, 2));
  console.log('wrote cache/txline/devnet-auth.json');
}

main().catch((e) => {
  console.error('onboard failed:', e.message || e);
  process.exit(1);
});
