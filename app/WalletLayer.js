'use client';



import { config } from '../onchain/config';

export default function WalletLayer({ children }) {
  return (
    <WagmiProvider config={config}>
      <ConnectKitProvider
        mode="dark"
        customTheme={{
          "--ck-accent-color": "#2563eb",
          "--ck-accent-text": "#ffffff",
          "--ck-primary-button-background": "#1f2937",
          "--ck-primary-button-hover-background": "#374151",
          "--ck-secondary-button-background": "#6b7280",
        }}
      >
        {children}
      </ConnectKitProvider>
    </WagmiProvider>
  );
}
