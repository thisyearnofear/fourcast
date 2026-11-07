import { describe, it, expect } from 'vitest';
import { Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

import {
  buildPaymentRequirement,
  decodePaymentTransaction,
  encodePaymentRequirement,
  normalizeInstructions,
  parsePaymentSignature,
  verifyPaymentInstruction,
} from '@/services/payments/x402Solana/verify.js';
import {
  PAYMENT_REASONS,
  assetMint,
  isEnabled,
  normalizeNetwork,
  sellerAddress,
  settlementNetwork,
} from '@/services/payments/x402Solana/types.js';

/**
 * The x402-on-Solana verification path, proven locally.
 *
 * Transactions are real, signed web3.js transactions — what is mocked is only
 * the owner lookup (no RPC). A live settlement needs devnet funds and is
 * exercised by scripts/x402-solana-demo.mjs.
 */

const BUYER = Keypair.generate();
const SELLER = Keypair.generate().publicKey;
const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZLdAwwG'); // devnet USDC
const DECIMALS = 6;
const AMOUNT = 10_000n; // 0.01 USDC

function paymentHeader(transactionBase64, overrides = {}) {
  const payload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'solana-devnet',
    accepted: { scheme: 'exact', network: 'solana-devnet' },
    payload: { transaction: transactionBase64 },
    ...overrides,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

async function buildPaymentTx({ amount = AMOUNT, payTo = SELLER, mint = MINT, decimals = DECIMALS, wrongMint = null } = {}) {
  const buyerAta = await getAssociatedTokenAddress(mint, BUYER.publicKey);
  const sellerAta = await getAssociatedTokenAddress(mint, payTo);
  const useMint = wrongMint ? new PublicKey(wrongMint) : mint;

  const tx = new Transaction();
  tx.feePayer = BUYER.publicKey;
  tx.recentBlockhash = Keypair.generate().publicKey.toBase58(); // any 32-byte-ish value; not submitted
  tx.add(
    createTransferCheckedInstruction(
      buyerAta,
      useMint,
      sellerAta,
      BUYER.publicKey,
      amount,
      decimals,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  tx.sign(BUYER);
  return tx;
}

describe('x402Solana types', () => {
  it('defaults to solana-devnet and is dark without the flag', () => {
    expect(settlementNetwork({}).network).toBe('solana-devnet');
    expect(isEnabled({})).toBe(false);
    expect(isEnabled({ X402_SOLANA_ENABLED: 'true' })).toBe(true);
  });

  it('resolves network aliases', () => {
    expect(normalizeNetwork('solana')).toBe('solana');
    expect(normalizeNetwork('solana-devnet')).toBe('solana-devnet');
    expect(normalizeNetwork('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1')).toBe('solana-devnet');
    expect(normalizeNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe('solana');
    expect(normalizeNetwork('eip155:1')).toBe(null);
    expect(settlementNetwork({ X402_SOLANA_NETWORK: 'mainnet' }).network).toBe('solana');
    expect(settlementNetwork({ X402_SOLANA_NETWORK: 'bogus' }).error).toBeTruthy();
  });

  it('resolves the devnet USDC mint by default', () => {
    const asset = assetMint({ X402_SOLANA_NETWORK: 'devnet' });
    expect(asset.mint).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZLdAwwG');
    expect(asset.decimals).toBe(6);
    expect(asset.symbol).toBe('USDC');
  });

  it('seller falls back to TXLINE_SOLANA_PUBLIC_KEY', () => {
    expect(sellerAddress({ X402_SOLANA_PAY_TO: 'abc' })).toBe('abc');
    expect(sellerAddress({ TXLINE_SOLANA_PUBLIC_KEY: 'def' })).toBe('def');
    expect(sellerAddress({})).toBe(null);
  });
});

describe('x402Solana requirement + header parsing', () => {
  it('builds and round-trips a requirement', () => {
    const req = buildPaymentRequirement({
      seller: SELLER.toBase58(),
      amount: 10000,
      network: 'solana-devnet',
      asset: MINT.toBase58(),
      decimals: 6,
      symbol: 'USDC',
      resource: '/api/signals/premium-solana',
    });
    const encoded = encodePaymentRequirement(req);
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    expect(decoded.accepts[0].scheme).toBe('exact');
    expect(decoded.accepts[0].network).toBe('solana-devnet');
    expect(decoded.accepts[0].maxAmountRequired).toBe('10000');
    expect(decoded.accepts[0].payTo).toBe(SELLER.toBase58());
    expect(decoded.accepts[0].asset).toBe(MINT.toBase58());
  });

  it('parses a PAYMENT-SIGNATURE header carrying a transaction', async () => {
    const tx = await buildPaymentTx();
    const b64 = tx.serialize().toString('base64');
    const parsed = parsePaymentSignature(paymentHeader(b64), { PAYMENT_REASONS });
    expect(parsed.ok).toBe(true);
    expect(parsed.payment.transaction).toBe(b64);
    expect(parsed.payment.network).toBe('solana-devnet');
  });

  it('rejects a header with no transaction', () => {
    const parsed = parsePaymentSignature(
      Buffer.from(JSON.stringify({ x402Version: 1, payload: {} })).toString('base64'),
      { PAYMENT_REASONS }
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.reasonCode).toBe('PAYMENT_TX_MISSING');
  });
});

describe('x402Solana transaction decode + instruction verification', () => {
  it('decodes a signed legacy transaction and extracts the signature', async () => {
    const tx = await buildPaymentTx();
    const decoded = decodePaymentTransaction(tx.serialize().toString('base64'), { PAYMENT_REASONS });
    expect(decoded.ok).toBe(true);
    expect(decoded.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
    // And it must equal the fee-payer signature on the wire tx.
    const { default: bs58 } = await import('bs58').catch(() => ({ default: null }));
    if (bs58) {
      expect(decoded.signature).toBe(bs58.encode(tx.signatures[0].signature));
    }
  });

  it('verifies a correct transferChecked payment', async () => {
    const tx = await buildPaymentTx();
    const decoded = decodePaymentTransaction(tx.serialize().toString('base64'), { PAYMENT_REASONS });
    const instructions = normalizeInstructions(decoded.tx, null);
    const sellerAta = await getAssociatedTokenAddress(MINT, SELLER);

    const result = await verifyPaymentInstruction({
      instructions,
      payTo: SELLER.toBase58(),
      assetMint: MINT.toBase58(),
      expectedAmount: AMOUNT,
      expectedDecimals: DECIMALS,
      feePayer: BUYER.publicKey.toBase58(),
      ownerCheck: async (destination) =>
        destination.toBase58() === sellerAta.toBase58() ? SELLER : null,
      PAYMENT_REASONS,
    });
    expect(result.ok).toBe(true);
    expect(result.payment.amount).toBe(AMOUNT.toString());
    expect(result.payment.destination).toBe(sellerAta.toBase58());
  });

  it('rejects a wrong amount', async () => {
    const tx = await buildPaymentTx({ amount: 5_000n });
    const decoded = decodePaymentTransaction(tx.serialize().toString('base64'), { PAYMENT_REASONS });
    const instructions = normalizeInstructions(decoded.tx, null);
    const result = await verifyPaymentInstruction({
      instructions,
      payTo: SELLER.toBase58(),
      assetMint: MINT.toBase58(),
      expectedAmount: AMOUNT,
      expectedDecimals: DECIMALS,
      feePayer: BUYER.publicKey.toBase58(),
      ownerCheck: async () => SELLER,
      PAYMENT_REASONS,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_AMOUNT_MISMATCH');
  });

  it('rejects a wrong mint', async () => {
    const otherMint = Keypair.generate().publicKey.toBase58();
    const tx = await buildPaymentTx({ wrongMint: otherMint });
    const decoded = decodePaymentTransaction(tx.serialize().toString('base64'), { PAYMENT_REASONS });
    const instructions = normalizeInstructions(decoded.tx, null);
    const result = await verifyPaymentInstruction({
      instructions,
      payTo: SELLER.toBase58(),
      assetMint: MINT.toBase58(),
      expectedAmount: AMOUNT,
      expectedDecimals: DECIMALS,
      feePayer: BUYER.publicKey.toBase58(),
      ownerCheck: async () => SELLER,
      PAYMENT_REASONS,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_INSTRUCTION_MISSING');
  });

  it('rejects a destination not owned by the payee', async () => {
    const tx = await buildPaymentTx();
    const decoded = decodePaymentTransaction(tx.serialize().toString('base64'), { PAYMENT_REASONS });
    const instructions = normalizeInstructions(decoded.tx, null);
    const result = await verifyPaymentInstruction({
      instructions,
      payTo: SELLER.toBase58(),
      assetMint: MINT.toBase58(),
      expectedAmount: AMOUNT,
      expectedDecimals: DECIMALS,
      feePayer: BUYER.publicKey.toBase58(),
      ownerCheck: async () => Keypair.generate().publicKey, // someone else owns it
      PAYMENT_REASONS,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_RECIPIENT_MISMATCH');
  });

  it('rejects an authority that is not the fee payer', async () => {
    const tx = await buildPaymentTx();
    const decoded = decodePaymentTransaction(tx.serialize().toString('base64'), { PAYMENT_REASONS });
    const instructions = normalizeInstructions(decoded.tx, null);
    const result = await verifyPaymentInstruction({
      instructions,
      payTo: SELLER.toBase58(),
      assetMint: MINT.toBase58(),
      expectedAmount: AMOUNT,
      expectedDecimals: DECIMALS,
      feePayer: Keypair.generate().publicKey.toBase58(), // wrong fee payer
      ownerCheck: async () => SELLER,
      PAYMENT_REASONS,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_AUTHORITY_MISMATCH');
  });

  it('rejects a transaction with no token payment at all', async () => {
    const tx = new Transaction();
    tx.feePayer = BUYER.publicKey;
    tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
    tx.add(SystemProgram.transfer({ fromPubkey: BUYER.publicKey, toPubkey: SELLER, lamports: 1000 }));
    tx.sign(BUYER);
    const decoded = decodePaymentTransaction(tx.serialize().toString('base64'), { PAYMENT_REASONS });
    const instructions = normalizeInstructions(decoded.tx, null);
    const result = await verifyPaymentInstruction({
      instructions,
      payTo: SELLER.toBase58(),
      assetMint: MINT.toBase58(),
      expectedAmount: AMOUNT,
      expectedDecimals: DECIMALS,
      feePayer: BUYER.publicKey.toBase58(),
      PAYMENT_REASONS,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_INSTRUCTION_MISSING');
  });
});
