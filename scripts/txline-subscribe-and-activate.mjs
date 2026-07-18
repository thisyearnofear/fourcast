/**
 * TxLINE free-tier onboarding - devnet or mainnet.
 *
 * Default: devnet (free SOL via airdrop, service level 1 with real-time data).
 * Set TXLINE_SOLANA_NETWORK=mainnet in .env.local to use mainnet instead.
 *
 * Flow (per https://txline.txodds.com/documentation/worldcup):
 *   1. Load keypair from .env.local (TXLINE_SOLANA_SECRET_KEY)
 *   2. On devnet, auto-request SOL airdrop if balance is 0
 *   3. Send on-chain `subscribe` tx (service level from env, 4 weeks)
 *   4. Wait for confirmation
 *   5. Get guest JWT from ${API_ORIGIN}/auth/guest/start
 *   6. Sign `${txSig}::${jwt}` with nacl detached, base64-encode
 *   7. POST {txSig, walletSignature, leagues:[]} to /api/token/activate
 *   8. Save apiToken + jwt to .env.local
 *   9. Smoke-test with /api/fixtures
 *
 * Usage:
 *   node scripts/txline-subscribe-and-activate.mjs
 *   node scripts/txline-subscribe-and-activate.mjs --dry-run   # skip on-chain tx
 *   node scripts/txline-subscribe-and-activate.mjs --reactivate-only  # skip subscribe, just re-activate
 *   node scripts/txline-subscribe-and-activate.mjs --airdrop-only  # just request devnet SOL
 *
 * Env (read from .env.local):
 *   TXLINE_SOLANA_SECRET_KEY  - base58 secret key (required)
 *   TXLINE_SOLANA_NETWORK     - 'devnet' (default) or 'mainnet'
 *   TXLINE_SERVICE_LEVEL      - default 1 (devnet) or 12 (mainnet realtime)
 *   TXLINE_SUBSCRIBE_WEEKS    - default 4
 *   SOLANA_RPC_URL            - optional override RPC
 *
 * Env (written):
 *   TXLINE_API_TOKEN          - activated API token
 *   TXLINE_GUEST_JWT          - guest JWT (renewable via --reactivate-only)
 *   TXLINE_LAST_TX_SIG        - last subscribe tx sig
 *   TXLINE_API_ORIGIN         - api host (devnet or mainnet)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry-run');
const REACTIVATE_ONLY = argv.has('--reactivate-only');
const AIRDROP_ONLY = argv.has('--airdrop-only');

const NETWORK_CONFIG = {
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    apiOrigin: 'https://txline-dev.txodds.com',
    programId: new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'),
    txlMint: new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG'),
    defaultServiceLevel: 1,
    supportsAirdrop: true,
    airdropLamports: 0.5 * LAMPORTS_PER_SOL,
  },
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    apiOrigin: 'https://txline.txodds.com',
    programId: new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA'),
    txlMint: new PublicKey('Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL'),
    defaultServiceLevel: 12,
    supportsAirdrop: false,
    airdropLamports: 0,
  },
};

const ENV_PATH = path.join(process.cwd(), '.env.local');

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return new Map();
  const map = new Map();
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function writeEnv(updates) {
  const env = readEnv();
  for (const [k, v] of Object.entries(updates)) env.set(k, v);
  fs.writeFileSync(
    ENV_PATH,
    `${Array.from(env.entries()).map(([k, v]) => `${k}=${v}`).join('\n')}\n`
  );
  try { fs.chmodSync(ENV_PATH, 0o600); } catch { /* best effort */ }
}

function loadKeypair(env) {
  const raw = env.get('TXLINE_SOLANA_SECRET_KEY');
  if (!raw) {
    console.error('TXLINE_SOLANA_SECRET_KEY not set in .env.local.');
    console.error('Run: node scripts/txline-generate-wallet.mjs');
    process.exit(1);
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    console.error('Could not decode TXLINE_SOLANA_SECRET_KEY as base58.');
    process.exit(1);
  }
}

function deriveAccounts(programId, txlMint, userPubkey) {
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_treasury_v2')],
    programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pricing_matrix')],
    programId
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    txlMint,
    userPubkey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return { tokenTreasuryPda, tokenTreasuryVault, pricingMatrixPda, userTokenAccount };
}

/**
 * Build the raw subscribe instruction.
 *   discriminator: [254, 28, 191, 138, 156, 179, 183, 53]
 *   args: u16 service_level_id (LE) + u8 weeks
 *   accounts (IDL order): user, pricing_matrix, token_mint, user_token_account,
 *     token_treasury_vault, token_treasury_pda, token_program, system_program,
 *     associated_token_program
 */
function buildSubscribeIx({
  programId,
  user,
  pricingMatrix,
  tokenMint,
  userTokenAccount,
  tokenTreasuryVault,
  tokenTreasuryPda,
  serviceLevel,
  weeks,
}) {
  const discriminator = Buffer.from([254, 28, 191, 138, 156, 179, 183, 53]);
  const args = Buffer.alloc(3);
  args.writeUInt16LE(serviceLevel, 0);
  args.writeUInt8(weeks, 2);
  const data = Buffer.concat([discriminator, args]);

  const accounts = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: pricingMatrix, isSigner: false, isWritable: false },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, data, keys: accounts });
}

async function requestAirdrop(connection, pubkey, lamports) {
  console.log(`Requesting devnet airdrop of ${lamports / LAMPORTS_PER_SOL} SOL...`);
  // Devnet public RPC is flaky and rate-limited; retry with backoff.
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, lamports);
      await connection.confirmTransaction(sig, 'confirmed');
      console.log('Airdrop confirmed:', sig);
      console.log('Explorer: https://explorer.solana.com/tx/' + sig + '?cluster=devnet');
      return sig;
    } catch (err) {
      console.warn(`Airdrop attempt ${attempt} failed: ${err.message}`);
      if (attempt < 4) {
        const wait = attempt * 3000;
        console.warn(`Retrying in ${wait / 1000}s with smaller amount...`);
        await new Promise((r) => setTimeout(r, wait));
        // Try smaller next time
        lamports = Math.max(Math.floor(lamports / 2), 0.05 * LAMPORTS_PER_SOL);
      }
    }
  }
  throw new Error(
    'Devnet airdrop failed after 4 attempts. The public devnet RPC is rate-limited.\n' +
    'Options:\n' +
    '  1. Get a free Helius API key (https://www.helius.dev), set SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY and rerun.\n' +
    '  2. Visit https://faucet.solana.com, paste the wallet address, and rerun this script.'
  );
}

async function subscribeOnChain(connection, payer, accounts, cfg, serviceLevel, weeks) {
  const ix = buildSubscribeIx({
    programId: cfg.programId,
    user: payer.publicKey,
    pricingMatrix: accounts.pricingMatrixPda,
    tokenMint: cfg.txlMint,
    userTokenAccount: accounts.userTokenAccount,
    tokenTreasuryVault: accounts.tokenTreasuryVault,
    tokenTreasuryPda: accounts.tokenTreasuryPda,
    serviceLevel,
    weeks,
  });

  // Fresh wallets don't yet have a TxL associated token account; the subscribe
  // instruction expects it to exist. Prepend an idempotent ATA-creator so this
  // works on first run and is a no-op on subsequent runs.
  // TxL uses Token-2022, so pass TOKEN_2022_PROGRAM_ID explicitly.
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    accounts.userTokenAccount,
    payer.publicKey,
    cfg.txlMint,
    TOKEN_2022_PROGRAM_ID,
  );

  const tx = new Transaction().add(createAtaIx, ix);
  tx.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  console.log(`Submitting subscribe tx (service level ${serviceLevel}, ${weeks} weeks)...`);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
    skipPreflight: false,
  });
  const cluster = cfg === NETWORK_CONFIG.devnet ? '?cluster=devnet' : '';
  console.log('Subscribe tx confirmed:', sig);
  console.log('Explorer: https://explorer.solana.com/tx/' + sig + cluster);
  return sig;
}

async function getGuestJwt(cfg) {
  const res = await fetch(`${cfg.apiOrigin}/auth/guest/start`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`guest/start -> ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  if (!data.token) {
    throw new Error(`guest/start response had no token: ${JSON.stringify(data)}`);
  }
  return data.token;
}

function signActivationMessage(payer, txSig, jwt, leagues = []) {
  const messageString = `${txSig}:${leagues.join(',')}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const sig = nacl.sign.detached(message, payer.secretKey);
  return Buffer.from(sig).toString('base64');
}

async function activateToken(cfg, txSig, walletSignature, leagues, jwt) {
  const res = await fetch(`${cfg.apiOrigin}/api/token/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`token/activate -> ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    const data = JSON.parse(text);
    return data.token || data.apiToken || data;
  } catch {
    return text.trim();
  }
}

async function smokeTestFixtures(cfg, jwt, apiToken) {
  const res = await fetch(`${cfg.apiOrigin}/api/fixtures`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': apiToken,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 400) };
  }
  try {
    const data = JSON.parse(text);
    const count = Array.isArray(data)
      ? data.length
      : data?.fixtures?.length || data?.data?.length || 0;
    return { ok: true, status: 200, count, sample: text.slice(0, 400) };
  } catch {
    return { ok: true, status: 200, count: 0, sample: text.slice(0, 400) };
  }
}

async function main() {
  const env = readEnv();
  const payer = loadKeypair(env);

  const networkKey = (env.get('TXLINE_SOLANA_NETWORK') || 'devnet').toLowerCase();
  const cfg = NETWORK_CONFIG[networkKey];
  if (!cfg) {
    console.error(`Unknown TXLINE_SOLANA_NETWORK: ${networkKey}. Use 'devnet' or 'mainnet'.`);
    process.exit(1);
  }

  const rpcUrl = env.get('SOLANA_RPC_URL') || cfg.rpcUrl;
  const connection = new Connection(rpcUrl, 'confirmed');

  const serviceLevel = Number(env.get('TXLINE_SERVICE_LEVEL') || cfg.defaultServiceLevel);
  const weeks = Number(env.get('TXLINE_SUBSCRIBE_WEEKS') || 4);

  console.log('========================================================');
  console.log(` TxLINE on-chain subscription + API activation (${networkKey})`);
  console.log('========================================================');
  console.log('Wallet:        ', payer.publicKey.toBase58());
  console.log('Network:       ', networkKey);
  console.log('RPC:           ', rpcUrl);
  console.log('Program:       ', cfg.programId.toBase58());
  console.log('TxL mint:      ', cfg.txlMint.toBase58());
  console.log('API host:      ', cfg.apiOrigin);
  console.log('Service level: ', serviceLevel);
  console.log('Weeks:         ', weeks);
  console.log('');

  // Balance check + optional airdrop
  let lamports = await connection.getBalance(payer.publicKey);
  let sol = lamports / LAMPORTS_PER_SOL;
  console.log(`Balance:       ${sol.toFixed(5)} SOL`);

  if (AIRDROP_ONLY) {
    if (!cfg.supportsAirdrop) {
      console.error('--airdrop-only requires devnet.');
      process.exit(1);
    }
    if (lamports === 0) {
      await requestAirdrop(connection, payer.publicKey, cfg.airdropLamports);
    } else {
      console.log('Wallet already funded, skipping airdrop.');
    }
    const newLamports = await connection.getBalance(payer.publicKey);
    console.log(`New balance: ${(newLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL`);
    return;
  }

  if (lamports === 0) {
    if (cfg.supportsAirdrop) {
      console.log('Wallet has 0 SOL, requesting devnet airdrop...');
      await requestAirdrop(connection, payer.publicKey, cfg.airdropLamports);
      lamports = await connection.getBalance(payer.publicKey);
      sol = lamports / LAMPORTS_PER_SOL;
      console.log(`Balance after airdrop: ${sol.toFixed(5)} SOL`);
    } else {
      console.error('Wallet has 0 SOL. Fund the address above and re-run.');
      process.exit(1);
    }
  }
  if (sol < 0.001 && cfg.supportsAirdrop) {
    console.log('Balance low, topping up via devnet airdrop...');
    await requestAirdrop(connection, payer.publicKey, cfg.airdropLamports);
  }
  console.log('');

  const accounts = deriveAccounts(cfg.programId, cfg.txlMint, payer.publicKey);
  console.log('Derived accounts:');
  console.log('  pricing_matrix:     ', accounts.pricingMatrixPda.toBase58());
  console.log('  token_treasury_pda: ', accounts.tokenTreasuryPda.toBase58());
  console.log('  token_treasury_vault:', accounts.tokenTreasuryVault.toBase58());
  console.log('  user_token_account: ', accounts.userTokenAccount.toBase58());
  console.log('');

  let txSig = env.get('TXLINE_LAST_TX_SIG') || null;
  if (REACTIVATE_ONLY) {
    if (!txSig) {
      console.error('--reactivate-only set but no TXLINE_LAST_TX_SIG in .env.local.');
      process.exit(1);
    }
    console.log('Re-activating only, reusing txSig:', txSig);
  } else if (DRY_RUN) {
    console.log('--dry-run set, skipping on-chain subscribe.');
    txSig = 'DRY_RUN_PLACEHOLDER';
  } else {
    txSig = await subscribeOnChain(connection, payer, accounts, cfg, serviceLevel, weeks);
  }
  console.log('');

  // Activate
  console.log('Requesting guest JWT...');
  const jwt = await getGuestJwt(cfg);
  console.log('Got JWT (len ' + jwt.length + ').');
  console.log('');

  console.log('Signing activation message...');
  const walletSignature = signActivationMessage(payer, txSig, jwt, []);
  console.log('Signature (b64 len ' + walletSignature.length + ').');
  console.log('');

  console.log('Activating API token...');
  const apiToken = await activateToken(cfg, txSig, walletSignature, [], jwt);
  if (typeof apiToken !== 'string' || apiToken.length < 10) {
    console.error('Unexpected apiToken response:', apiToken);
    process.exit(1);
  }
  console.log('API token activated (len ' + apiToken.length + ').');
  console.log('');

  // Persist
  writeEnv({
    TXLINE_API_TOKEN: apiToken,
    TXLINE_GUEST_JWT: jwt,
    TXLINE_LAST_TX_SIG: txSig,
    TXLINE_API_ORIGIN: cfg.apiOrigin,
    TXLINE_MODE: 'live',
  });
  console.log('Saved TXLINE_API_TOKEN, TXLINE_GUEST_JWT, TXLINE_LAST_TX_SIG, TXLINE_API_ORIGIN to .env.local');
  console.log('');

  // Smoke test
  console.log('Smoke-testing /api/fixtures...');
  const smoke = await smokeTestFixtures(cfg, jwt, apiToken);
  console.log(JSON.stringify(smoke, null, 2));
  console.log('');

  console.log('========================================================');
  console.log(' ONBOARDING COMPLETE');
  console.log('========================================================');
  console.log('TxLINE is now the primary source for /world-cup.');
  console.log('Restart the dev server (or redeploy) to pick up the new env vars.');
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
