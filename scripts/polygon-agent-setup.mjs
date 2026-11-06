#!/usr/bin/env node
/**
 * Derived-EOA setup for the chain-signature account — the ops leg of the
 * NEAR hackathon odds plan (docs/NEAR_HACKATHON_ODDS.md, Step 1).
 *
 * Default (read-only, no keys needed):
 *   node scripts/polygon-agent-setup.mjs
 *   → derived address, POL + USDC.e balances, CLOB approval state.
 *
 * Approve pass (needs the owner NEAR key in env):
 *   node scripts/polygon-agent-setup.mjs --approve
 *   → signs ERC-20 txs via the mandate contract (request_signature → MPC)
 *   and broadcasts. Waits out the on-chain cooldown between signatures —
 *   every request bumps last_trade_ns, so approvals are spaced by it.
 *
 * Envelope honesty: approvals are account setup, not trades — they declare
 * venue scope + the mandate floor (same convention as the creds bootstrap).
 */
import 'dotenv/config';
import { JsonRpcProvider, Contract, Transaction, keccak256, formatUnits, MaxUint256 } from 'ethers';
import { derivedEvmAddress, getMandate } from '../services/near/nearMandateClient.js';
import { requestTradeSignature } from '../services/near/nearMandateClient.js';

const RPC = process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';
const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';       // USDC.e (bridged)
const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';        // ConditionalTokens
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';
const NEG_RISK_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

const ERC20 = ['function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)', 'function balanceOf(address) view returns (uint256)'];
const ERC1155 = ['function setApprovalForAll(address,bool)', 'function isApprovedForAll(address,address) view returns (bool)'];

const doApprove = process.argv.includes('--approve');
const provider = new JsonRpcProvider(RPC, 137);

const usdc = new Contract(USDC, ERC20, provider);
const ctf = new Contract(CTF, ERC1155, provider);
const mandate = await getMandate();
const evm = await derivedEvmAddress();

const [pol, usdcBal, a1, a2, a3, c1, c2, c3] = await Promise.all([
  provider.getBalance(evm),
  usdc.balanceOf(evm),
  usdc.allowance(evm, CTF_EXCHANGE),
  usdc.allowance(evm, NEG_RISK_EXCHANGE),
  usdc.allowance(evm, NEG_RISK_ADAPTER),
  ctf.isApprovedForAll(evm, CTF_EXCHANGE),
  ctf.isApprovedForAll(evm, NEG_RISK_EXCHANGE),
  ctf.isApprovedForAll(evm, NEG_RISK_ADAPTER),
]);

console.log(`derived EOA   ${evm}`);
console.log(`POL           ${formatUnits(pol, 18)}   (gas)`);
console.log(`USDC.e        ${formatUnits(usdcBal, 6)}   (order notional)`);
console.log(`allow USDC→CTF exch / negRisk exch / adapter: ${a1 > 0n} / ${a2 > 0n} / ${a3 > 0n}`);
console.log(`appr CTF→CTF exch / negRisk exch / adapter:     ${c1} / ${c2} / ${c3}`);

if (!doApprove) {
  console.log('\nread-only. Fund USDC.e (+ dust POL), then rerun with --approve.');
  process.exit(0);
}

// ── approve pass ────────────────────────────────────────────────────────────

const { createChainSignatureSigner } = await import('../services/near/chainSigSigner.js');
const signer = await createChainSignatureSigner({
  venue: 'polymarket',
  marketId: 'account-setup',
  outcome: 'erc20-approve',
  notional: '0',
  liquidity: String(mandate.min_liquidity),
  slippageBps: 0,
});

async function waitCooldown() {
  const m = await getMandate();
  const lastMs = Number(m.last_trade_ns) / 1e6;
  const wait = lastMs + Number(m.cooldown_secs) * 1000 + 2000 - Date.now();
  if (wait > 0) {
    console.log(`  cooldown ${(wait / 1000).toFixed(0)}s…`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

const txs = [
  a1 === 0n && { label: 'USDC.approve → CTF exchange', to: USDC, data: usdc.interface.encodeFunctionData('approve', [CTF_EXCHANGE, MaxUint256]) },
  a2 === 0n && { label: 'USDC.approve → neg-risk exchange', to: USDC, data: usdc.interface.encodeFunctionData('approve', [NEG_RISK_EXCHANGE, MaxUint256]) },
  a3 === 0n && { label: 'USDC.approve → neg-risk adapter', to: USDC, data: usdc.interface.encodeFunctionData('approve', [NEG_RISK_ADAPTER, MaxUint256]) },
  !c1 && { label: 'CTF.setApprovalForAll → CTF exchange', to: CTF, data: ctf.interface.encodeFunctionData('setApprovalForAll', [CTF_EXCHANGE, true]) },
  !c2 && { label: 'CTF.setApprovalForAll → neg-risk exchange', to: CTF, data: ctf.interface.encodeFunctionData('setApprovalForAll', [NEG_RISK_EXCHANGE, true]) },
  !c3 && { label: 'CTF.setApprovalForAll → neg-risk adapter', to: CTF, data: ctf.interface.encodeFunctionData('setApprovalForAll', [NEG_RISK_ADAPTER, true]) },
].filter(Boolean);

if (!txs.length) {
  console.log('\nall approvals already set — nothing to do.');
  process.exit(0);
}

let nonce = await provider.getTransactionCount(evm);
const fee = await provider.getFeeData();

for (const t of txs) {
  await waitCooldown();
  console.log(`signing ${t.label} via mandate contract…`);
  const signed = await signer.signTransaction(Transaction.from({
    type: 2, chainId: 137, to: t.to, data: t.data, value: 0n,
    nonce, gasLimit: 100_000n,
    maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
  }));
  const res = await provider.broadcastTransaction(signed);
  console.log(`  tx ${res.hash} — waiting for confirmation…`);
  await res.wait(1);
  nonce += 1;
}
console.log('\nall approvals confirmed on-chain.');
