/**
 * Deploy PredictionReceiptERC20 to Arc testnet.
 *
 *   node --import dotenv/config scripts/deploy-prediction-receipt.js
 *
 * Requires: ARC_RPC_URL, DEPLOYER_PRIVATE_KEY, NEXT_PUBLIC_USDC_TOKEN, TREASURY_ADDRESS
 * Compile first: cd contracts && forge build --contracts PredictionReceiptERC20.sol
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network/'] },
  },
};

async function main() {
  const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network/';
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN || process.env.USDC_TOKEN_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const feeBps = parseInt(process.env.PREDICTION_FEE_BPS_ARC || '0', 10);

  if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  if (!usdcAddress) throw new Error('NEXT_PUBLIC_USDC_TOKEN not set');
  if (!treasuryAddress) throw new Error('TREASURY_ADDRESS not set');

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });

  const artifactPath = resolve(
    __dirname,
    '../contracts/out/PredictionReceiptERC20.sol/PredictionReceiptERC20.json'
  );

  let bytecode, abi;
  try {
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    bytecode = artifact.bytecode?.object || artifact.bytecode;
    abi = artifact.abi;
  } catch {
    console.error('Compile first: cd contracts && forge build');
    process.exit(1);
  }

  console.log('\n🚀 Deploying PredictionReceiptERC20...');
  const hash = await walletClient.deployContract({
    abi,
    bytecode: bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
    args: [treasuryAddress, feeBps, usdcAddress],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;
  if (!contractAddress) throw new Error('No contract address in receipt');

  console.log(`\n✅ PredictionReceiptERC20 deployed: ${contractAddress}`);
  writeFileSync(resolve(__dirname, '../.prediction-receipt-address'), contractAddress);
  console.log('\n📋 Add to .env.local:');
  console.log(`   NEXT_PUBLIC_PREDICTION_RECEIPT_CONTRACT=${contractAddress}`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
