"use client";

import React from "react";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

/**
 * Aptos Wallet Provider
 *
 * Supports all standard-compliant wallets (Petra, Martian, Pontem, etc.)
 * automatically via the Wallet Standard.
 */
export function AptosProvider({ children }) {
  const envNet = (process.env.NEXT_PUBLIC_APTOS_NETWORK || "").toLowerCase();
  const network =
    envNet === "mainnet"
      ? Network.MAINNET
      : envNet === "testnet"
      ? Network.TESTNET
      : envNet === "localnet"
      ? Network.LOCAL
      : Network.DEVNET;

  const aptos = new Aptos(new AptosConfig({ network }));
  const dappUrl =
    process.env.NEXT_PUBLIC_DAPP_URL || "https://fourcastapp.vercel.app";

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{ network, aptosClient: aptos, dappUrl }}
      onError={(error) => {
        console.error("Aptos wallet error:", error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
