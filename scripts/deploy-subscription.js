/**
 * Deploy SubscriptionManager contract to Arc testnet.
 *
 * Usage:
 *   node scripts/deploy-subscription.js
 *
 * Requires env vars:
 *   ARC_RPC_URL — Arc testnet RPC endpoint
 *   DEPLOYER_PRIVATE_KEY — deployer wallet private key (with testnet USDC for gas)
 *   USDC_TOKEN_ADDRESS — USDC token address on Arc testnet
 *   TREASURY_ADDRESS — where subscription USDC payments are collected
 *
 * Outputs:
 *   Contract address to stdout and saves to .contract-address
 */

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Arc testnet chain definition (Circle L1)
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL || 'https://arc-node.thecanteenapp.com/'],
    },
  },
};

async function main() {
  const rpcUrl = process.env.ARC_RPC_URL || 'https://arc-node.thecanteenapp.com/';
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const usdcAddress = process.env.USDC_TOKEN_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY not set in .env.local');
  if (!usdcAddress) throw new Error('USDC_TOKEN_ADDRESS not set in .env.local');
  if (!treasuryAddress) throw new Error('TREASURY_ADDRESS not set in .env.local');

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  console.log(`\n🔑 Deployer: ${account.address}`);
  console.log(`📄 USDC: ${usdcAddress}`);
  console.log(`🏦 Treasury: ${treasuryAddress}`);
  console.log(`⛓️  RPC: ${rpcUrl}\n`);

  // Read compiled bytecode — for production use Hardhat/Foundry compilation
  // For now, the contract must be compiled separately (see README)
  const artifactPath = resolve(__dirname, '../contracts/out/SubscriptionManager.sol/SubscriptionManager.json');
  let bytecode, abi;

  try {
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    bytecode = artifact.bytecode;
    abi = artifact.abi;
  } catch {
    console.error('⚠️  Contract artifact not found. Compile first:');
    console.error('   cd contracts && npx hardhat compile');
    console.error('   Or use Foundry: cd contracts && forge build');
    process.exit(1);
  }

  // Check deployer balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${balance} wei`);

  if (balance < 100000n) {
    console.warn('⚠️  Low balance — deployment may fail. Get testnet USDC from faucet.');
  }

  // Deploy contract
  console.log('\n🚀 Deploying SubscriptionManager...');

  const hash = await walletClient.deployContract({
    abi,
    bytecode: `0x${bytecode}`,
    args: [usdcAddress, treasuryAddress],
  });

  console.log(`📝 Tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;

  if (!contractAddress) {
    throw new Error('Deployment failed — no contract address in receipt');
  }

  console.log(`\n✅ SubscriptionManager deployed!`);
  console.log(`   Address: ${contractAddress}`);
  console.log(`   Block:   ${receipt.blockNumber}`);

  // Save address for frontend
  writeFileSync(
    resolve(__dirname, '../.contract-address'),
    contractAddress,
    'utf-8'
  );
  console.log(`\n📁 Address saved to .contract-address`);

  // Output for .env.local
  console.log(`\n📋 Add to .env.local:`);
  console.log(`   NEXT_PUBLIC_SUBSCRIPTION_CONTRACT=${contractAddress}`);
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
