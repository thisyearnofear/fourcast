'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

/**
 * Aptos Wallet Connect Button
 * 
 * Simple, clean button matching our design system
 * Shows wallet address when connected
 */
export default function AptosConnectButton({ isNight = false }) {
    const { connect, disconnect, account, connected, wallets } = useWallet();
    const [showWallets, setShowWallets] = useState(false);

    console.log('AptosConnectButton State:', { connected, account, wallets });


    const textColor = isNight ? 'text-white' : 'text-black';
    const bgColor = isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20';
    const borderColor = isNight ? 'border-white/20' : 'border-black/20';

    if (connected) {
        const address = account?.address?.toString();

        if (address) {
            const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
            return (
                <button
                    onClick={disconnect}
                    className={`px-4 py-2 rounded-xl text-sm font-light border ${bgColor} ${textColor} ${borderColor} transition-all`}
                >
                    {shortAddress}
                </button>
            );
        } else {
            return (
                <button
                    onClick={disconnect}
                    className={`px-4 py-2 rounded-xl text-sm font-light border ${bgColor} ${textColor} ${borderColor} transition-all`}
                >
                    Connected (No Address)
                </button>
            );
        }
    }

    return (
        <div className="relative">
            <button
                onClick={() => setShowWallets(!showWallets)}
                className={`px-4 py-2 rounded-xl text-sm font-light border ${bgColor} ${textColor} ${borderColor} transition-all`}
            >
                Connect Aptos Wallet
            </button>

            {showWallets && (
                <div className={`absolute right-0 mt-2 w-48 rounded-xl border ${bgColor} ${borderColor} backdrop-blur-xl p-2 z-50`}>
                    {wallets.map((wallet) => (
                        <button
                            key={wallet.name}
                            onClick={async () => {
                                try {
                                    console.log('Connecting to', wallet.name);
                                    await connect(wallet.name);
                                    console.log('Connected to', wallet.name);
                                } catch (e) {
                                    console.error('Connection failed', e);
                                }
                                setShowWallets(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${textColor} hover:bg-white/10 transition-all`}
                        >
                            {wallet.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
