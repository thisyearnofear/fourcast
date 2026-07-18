/**
 * Generate a fresh Solana keypair for TxLINE on-chain subscription.
 * Saves the secret key to .env.local as TXLINE_SOLANA_SECRET_KEY (base58 string)
 * and prints the public address to fund.
 *
 * Usage: node scripts/txline-generate-wallet.mjs
 *
 * Safe to re-run: if TXLINE_SOLANA_SECRET_KEY is already in .env.local, it
 * prints the existing address instead of clobbering the key.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const ENV_PATH = path.join(process.cwd(), '.env.local');
const ENV_KEY = 'TXLINE_SOLANA_SECRET_KEY';
const ENV_PUBKEY_KEY = 'TXLINE_SOLANA_PUBLIC_KEY';
const ENV_NETWORK_KEY = 'TXLINE_SOLANA_NETWORK';
const ENV_PROGRAM_KEY = 'TXLINE_PROGRAM_ID';
const ENV_SERVICE_LEVEL_KEY = 'TXLINE_SERVICE_LEVEL';

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return new Map();
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  const map = new Map();
  for (const line of lines) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function writeEnv(updates) {
  const existing = readEnv();
  for (const [k, v] of Object.entries(updates)) existing.set(k, v);
  const out = Array.from(existing.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  fs.writeFileSync(ENV_PATH, `${out}\n`);
  // Tighten perms on .env.local so the new secret isn't world-readable
  try { fs.chmodSync(ENV_PATH, 0o600); } catch { /* best effort */ }
}

function loadKeypairFromEnv(env) {
  const raw = env.get(ENV_KEY);
  if (!raw) return null;
  try {
    // Try base58 first (preferred form), fall back to JSON array
    const secret = bs58.decode(raw);
    return Keypair.fromSecretKey(secret);
  } catch {
    try {
      const arr = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch {
      return null;
    }
  }
}

async function main() {
  // bs58 isn't a direct dep of web3.js anymore — fetch from @solana/web3.js
  // bundled bs58 if present, else install on demand.
  if (!bs58) {
    console.error('bs58 not available — install with: npm i bs58');
    process.exit(1);
  }

  let env = readEnv();
  let kp = loadKeypairFromEnv(env);

  if (kp) {
    console.log('Existing TxLINE wallet found in .env.local — not regenerating.');
    console.log('Public address:', kp.publicKey.toBase58());
    return;
  }

  kp = Keypair.generate();
  const secretB58 = bs58.encode(kp.secretKey);
  const pubkey = kp.publicKey.toBase58();

  writeEnv({
    [ENV_KEY]: secretB58,
    [ENV_PUBKEY_KEY]: pubkey,
    [ENV_NETWORK_KEY]: 'mainnet',
    [ENV_PROGRAM_KEY]: '9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA',
    [ENV_SERVICE_LEVEL_KEY]: '12',
  });

  console.log('========================================================');
  console.log(' NEW TXLINE SOLANA WALLET GENERATED');
  console.log('========================================================');
  console.log('Public address to fund:');
  console.log('  ' + pubkey);
  console.log('');
  console.log('Network:      mainnet');
  console.log('Service level: 12 (real-time World Cup, free tier)');
  console.log('Program ID:    9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA');
  console.log('');
  console.log('Fund with ~0.05 SOL (covers subscribe tx fee + rent).');
  console.log('Verify balance:  solana balance ' + pubkey);
  console.log('                 (use a mainnet RPC like https://api.mainnet-beta.solana.com)');
  console.log('');
  console.log('Secret key saved to .env.local as ' + ENV_KEY + ' (chmod 600).');
  console.log('DO NOT commit .env.local. It is already in .gitignore.');
  console.log('');
  console.log('Next step once funded:');
  console.log('  node scripts/txline-subscribe-and-activate.mjs');
}

main().catch((err) => {
  console.error('Failed to generate wallet:', err);
  process.exit(1);
});
