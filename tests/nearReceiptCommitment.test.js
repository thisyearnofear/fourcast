import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildCommitmentMemo,
  parseCommitmentMemo,
  buildCommitmentSetArgs,
  extractCommitmentMemos,
  COMMITMENT_PREFIX,
} from '../services/near/nearReceiptCommitment.js';
import { getNearConfig, isNearConfigured, explorerTxUrl } from '../services/near/nearConfig.js';

const HASH = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const ACCOUNT = 'fourcast-agent.testnet';

const ENV_KEYS = ['NEAR_NETWORK', 'NEAR_ACCOUNT_ID', 'NEAR_PRIVATE_KEY', 'NEAR_RPC_URL', 'NEAR_SOCIAL_CONTRACT'];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('buildCommitmentMemo', () => {
  it('produces the same format as the Solana commitment', () => {
    expect(buildCommitmentMemo({ fixtureId: 'fx-1', contentHash: HASH })).toBe(
      `${COMMITMENT_PREFIX}:fx-1:${HASH}`
    );
  });

  it('rejects missing fixtureId and malformed hashes', () => {
    expect(() => buildCommitmentMemo({ contentHash: HASH })).toThrow(/fixtureId/);
    expect(() => buildCommitmentMemo({ fixtureId: 'x', contentHash: '0xabc' })).toThrow(/64-char hex/);
    expect(() => buildCommitmentMemo({ fixtureId: 'x', contentHash: HASH.toUpperCase() })).toThrow(/64-char hex/);
  });
});

describe('parseCommitmentMemo', () => {
  it('round-trips a built memo', () => {
    const memo = buildCommitmentMemo({ fixtureId: 'fx-2', contentHash: HASH });
    expect(parseCommitmentMemo(memo)).toEqual({
      prefix: 'fourcast',
      version: 'receipt-v1',
      fixtureId: 'fx-2',
      contentHash: HASH,
    });
  });

  it('returns null for non-commitment strings', () => {
    expect(parseCommitmentMemo(null)).toBeNull();
    expect(parseCommitmentMemo('hello')).toBeNull();
    expect(parseCommitmentMemo(`other:receipt-v1:x:${HASH}`)).toBeNull();
    expect(parseCommitmentMemo(`fourcast:receipt-v1:x:nothex`)).toBeNull();
    expect(parseCommitmentMemo(`fourcast:receipt-v1:x:${HASH}:extra`)).toBeNull();
  });
});

describe('buildCommitmentSetArgs', () => {
  it('nests the memo under <account>/fourcast/receipts/<fixtureId>', () => {
    const { args, memo, socialKey } = buildCommitmentSetArgs({
      accountId: ACCOUNT,
      fixtureId: 'fx-3',
      contentHash: HASH,
    });
    expect(memo).toBe(`fourcast:receipt-v1:fx-3:${HASH}`);
    expect(socialKey).toBe(`${ACCOUNT}/fourcast/receipts/fx-3`);
    expect(args.data[ACCOUNT].fourcast.receipts['fx-3']).toBe(memo);
  });
});

describe('extractCommitmentMemos', () => {
  it('finds memos inside a tx-status FunctionCall payload', () => {
    const argsJson = {
      data: { [ACCOUNT]: { fourcast: { receipts: { 'fx-4': `fourcast:receipt-v1:fx-4:${HASH}` } } } },
    };
    const tx = {
      transaction: {
        actions: [
          { Transfer: {} },
          { FunctionCall: { method_name: 'set', args: Buffer.from(JSON.stringify(argsJson)).toString('base64') } },
        ],
      },
    };
    expect(extractCommitmentMemos(tx)).toEqual([`fourcast:receipt-v1:fx-4:${HASH}`]);
  });

  it('ignores foreign payloads and bad args', () => {
    const tx = {
      transaction: {
        actions: [
          { FunctionCall: { args: 'not-base64-json' } },
          { FunctionCall: { args: Buffer.from(JSON.stringify({ data: {} })).toString('base64') } },
          { FunctionCall: { args: Buffer.from(JSON.stringify({ data: { a: { fourcast: { receipts: { x: `fourcast:receipt-v1:x:${HASH_B}` } } } } })).toString('base64') } },
        ],
      },
    };
    expect(extractCommitmentMemos(tx)).toEqual([`fourcast:receipt-v1:x:${HASH_B}`]);
  });
});

describe('nearConfig', () => {
  it('defaults to testnet with the social08 contract', () => {
    const config = getNearConfig();
    expect(config.network).toBe('testnet');
    expect(config.socialContract).toBe('v1.social08.testnet');
    expect(config.rpcUrl).toContain('test');
  });

  it('switches to mainnet defaults', () => {
    process.env.NEAR_NETWORK = 'mainnet';
    const config = getNearConfig();
    expect(config.socialContract).toBe('social.near');
    expect(config.explorerTx).toBe('https://nearblocks.io/txns/');
  });

  it('rejects unknown networks', () => {
    process.env.NEAR_NETWORK = 'devnet';
    expect(() => getNearConfig()).toThrow(/unsupported/);
  });

  it('isNearConfigured requires both account and key', () => {
    expect(isNearConfigured()).toBe(false);
    process.env.NEAR_ACCOUNT_ID = ACCOUNT;
    expect(isNearConfigured()).toBe(false);
    process.env.NEAR_PRIVATE_KEY = 'ed25519:test';
    expect(isNearConfigured()).toBe(true);
  });

  it('builds network-aware explorer URLs', () => {
    expect(explorerTxUrl('abc', 'testnet')).toBe('https://testnet.nearblocks.io/txns/abc');
    expect(explorerTxUrl('abc', 'mainnet')).toBe('https://nearblocks.io/txns/abc');
  });
});
