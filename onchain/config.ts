import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { bsc, arbitrum, polygon } from 'wagmi/chains';
import { ARC_CHAIN_ID } from '@/constants/evmContracts';

const arcRpc =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ||
  process.env.ARC_RPC_URL ||
  'https://rpc.testnet.arc.network/';

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [arcRpc] },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.testnet.arc.network',
    },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [arcTestnet, polygon, arbitrum, bsc],
  transports: {
    [arcTestnet.id]: http(arcRpc),
    [arbitrum.id]: http(process.env.ARB_RPC_URL),
    [bsc.id]: http(process.env.NEXT_PUBLIC_BNB_RPC_URL),
    [polygon.id]: http(process.env.POLYGON_RPC_URL),
  },
});

export const metadata = {
  name: 'Fourcast',
  description: 'Arc-native prediction market intelligence',
  url: process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app',
  icons: ['https://fourcastapp.vercel.app/logo.png'],
};

export const bnbChainId = 56;
export const arbitrumChainId = 42161;
export const polygonChainId = 137;
export const arcChainId = ARC_CHAIN_ID;
