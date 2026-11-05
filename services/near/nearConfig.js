/**
 * NEAR chain configuration — single source of truth for the hackathon rail.
 *
 * Networks: testnet (default for the build window) and mainnet.
 * Anchoring target: NEAR Social's `set` contract — arbitrary key/value JSON
 * published under the agent account, queryable by anyone via RPC `get`.
 *   testnet: v1.social08.testnet   mainnet: social.near
 *
 * Intents: the 1-Click API (NEAR Intents / defuse settlement) is plain REST —
 * no SDK. A JWT is required by the API; it is read from NEAR_ONECLICK_JWT and
 * never logged.
 */

const NETWORK_DEFAULTS = {
  testnet: {
    rpcUrl: 'https://test.rpc.fastnear.com',
    socialContract: 'v1.social08.testnet',
    explorerTx: 'https://testnet.nearblocks.io/txns/',
    explorerAccount: 'https://testnet.nearblocks.io/address/',
    networkId: 'testnet',
  },
  mainnet: {
    rpcUrl: 'https://rpc.fastnear.com',
    socialContract: 'social.near',
    explorerTx: 'https://nearblocks.io/txns/',
    explorerAccount: 'https://nearblocks.io/address/',
    networkId: 'mainnet',
  },
};

const ONECLICK_BASE_URL = 'https://1click.chaindefuser.com';

export function getNearConfig() {
  const network = (process.env.NEAR_NETWORK || 'testnet').toLowerCase();
  const defaults = NETWORK_DEFAULTS[network];
  if (!defaults) {
    throw new Error(`getNearConfig: unsupported NEAR_NETWORK "${network}" (expected testnet|mainnet)`);
  }

  return {
    network,
    networkId: defaults.networkId,
    rpcUrl: process.env.NEAR_RPC_URL || defaults.rpcUrl,
    accountId: process.env.NEAR_ACCOUNT_ID || '',
    privateKey: process.env.NEAR_PRIVATE_KEY || '',
    socialContract: process.env.NEAR_SOCIAL_CONTRACT || defaults.socialContract,
    anchorDepositNear: process.env.NEAR_ANCHOR_DEPOSIT_NEAR || '0.1',
    anchorGasTgas: process.env.NEAR_ANCHOR_GAS_TGAS || '30',
    oneClickBaseUrl: process.env.NEAR_ONECLICK_BASE_URL || ONECLICK_BASE_URL,
    oneClickJwt: process.env.NEAR_ONECLICK_JWT || '',
    explorerTx: defaults.explorerTx,
    explorerAccount: defaults.explorerAccount,
  };
}

export function isNearConfigured() {
  const config = getNearConfig();
  return Boolean(config.accountId && config.privateKey);
}

export function explorerTxUrl(txHash, network) {
  const n = network || (process.env.NEAR_NETWORK || 'testnet').toLowerCase();
  return `${NETWORK_DEFAULTS[n].explorerTx}${txHash}`;
}
