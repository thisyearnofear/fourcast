'use client';

import { useState, useEffect } from 'react';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { useChainConnections } from '@/hooks/useChainConnections';
import { BRAND } from '@/constants/brand';

const CHAIN_META = {
  arc: { label: 'Arc (USDC)', icon: '🌀', color: '#6366f1' },
  evm: { label: 'EVM (Trading)', icon: '📊', color: '#2563eb' },
};

export default function UnifiedConnect({ isNight = false, variant = 'header' }) {
  const [mounted, setMounted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { chains, canPublish, switchToArc } = useChainConnections();
  const { isConnected: evmConnected, address: evmAddress } = useAccount();
  const { connect: evmConnect, connectors } = useConnect();
  const { disconnect: evmDisconnect } = useDisconnect();

  useEffect(() => { setMounted(true); }, []);

  // Cache the last-known connected state so the next page load can render a
  // smaller skeleton variant matching the connected chip (no brief shrink on
  // hydration). No-op on the server (window undefined) and when localStorage
  // is disabled (Safari private mode etc.).
  useEffect(() => {
    if (!mounted || !chains) return;
    if (typeof window === 'undefined') return;
    try {
      const isConnected = Boolean(chains.evm?.connected || chains.arc?.connected);
      window.localStorage.setItem('fourcast_last_wallet_connected', isConnected ? '1' : '0');
    } catch {
      // localStorage may be disabled — fall through; next load will use default skeleton.
    }
    // Primitive boolean deps so the effect only re-runs when the actual
    // connection state changes, not when chains is a new object reference.
  }, [mounted, Boolean(chains?.evm?.connected), Boolean(chains?.arc?.connected)]);

  if (!mounted) {
    // Read the cache synchronously to pick the right skeleton size. Server has
    // no localStorage so always renders the larger (not-connected) variant;
    // `suppressHydrationWarning` lets the client correct on first render.
    const wasConnected = typeof window !== 'undefined'
      && window.localStorage?.getItem('fourcast_last_wallet_connected') === '1';
    // Skeleton wrapper matches the not-connected render wrapper
    // (`flex items-center gap-2`) so the header alignment stays pixel-stable
    // through hydration. The connected-state wrapper adds `relative` for the
    // absolute-positioned dropdown, which the skeleton doesn't need.
    return (
      <div className="flex items-center gap-2" suppressHydrationWarning>
        <div
          className={`${wasConnected ? 'w-[80px] h-[30px]' : 'w-[120px] h-[36px]'} rounded-xl bg-white/5`}
          aria-hidden="true"
        />
      </div>
    );
  }
  if (!chains) return null;

  // Gather connected chains
  const connected = Object.entries(chains)
    .filter(([_, c]) => c.connected)
    .map(([id, c]) => ({
      id,
      label: CHAIN_META[id]?.label || id,
      icon: CHAIN_META[id]?.icon || '⛓',
      color: CHAIN_META[id]?.color || '#888',
      address: c.address,
    }));

  const isAnyConnected = connected.length > 0;

  // --- Not connected state ---
  if (!isAnyConnected) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            // Try EVM connect first (covers EVM + Arc)
            const injected = connectors.find(c => c.id === 'injected');
            if (injected) evmConnect({ connector: injected });
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
            bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20`}
        >
          <span className="flex items-center gap-2">
            <span>Connect Wallet</span>
            <span className={`text-xs text-white/40`}>↗</span>
          </span>
        </button>
        {variant !== 'compact' && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`text-xs text-white/40 hover:text-white/60 transition-colors`}
          >
            ?
          </button>
        )}
        {showDetails && (
          <div className={`absolute top-full right-0 mt-2 p-3 rounded-xl text-xs leading-relaxed z-50
            bg-slate-900 border border-white/10
            shadow-xl min-w-[240px]`}
            style={{ maxWidth: 280 }}
          >
            <p className={`font-medium mb-1 text-white/80`}>
              {BRAND.walletExplainer.headline}
            </p>
            <ul className={`space-y-1.5 text-white/50`}>
              {BRAND.walletExplainer.layers.map((layer) => (
                <li key={layer.name}>
                  {layer.icon} <strong>{layer.name}</strong> — {layer.detail}
                </li>
              ))}
            </ul>
            <p className={`mt-2 text-white/40`}>
              {BRAND.walletExplainer.cta}
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- Connected state ---
  const primaryChain = connected.find(c => c.id === 'arc') || connected[0];
  const primaryAddr = primaryChain?.address;

  return (
    <div className="relative flex items-center gap-2">
      {/* Connected chip */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
          bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/15`}
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span>Connected</span>
        <span className={`text-white/40 font-mono`}>
          {primaryAddr ? `${String(primaryAddr).slice(0, 4)}..` : ''}
        </span>
      </button>
      {/* Detail popover */}
      {showDetails && (
        <div className={`absolute top-full right-0 mt-2 p-3 rounded-xl text-xs leading-relaxed z-50
          bg-slate-900 border border-white/10
          shadow-xl min-w-[200px]`}
        >
          {connected.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1">
              <span className='text-white/70'>
                {c.icon} {c.label}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            </div>
          ))}
          {chains?.evm?.connected && !chains?.arc?.connected && (
            <button
              type="button"
              onClick={() => switchToArc()}
              className={`mt-2 w-full text-left text-[10px] py-1.5 px-2 rounded-lg bg-indigo-500/15 text-indigo-300`}
            >
              🌀 Switch to Arc for USDC signals
            </button>
          )}
          <div className={`mt-2 pt-2 border-t border-white/10`}>
            <button
              onClick={() => {
                evmDisconnect();
                setShowDetails(false);
              }}
              className={`text-xs text-red-400/70 hover:text-red-400`}
            >
              Disconnect all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
