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

  if (!mounted || !chains) return null;

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
            ${isNight
              ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20'
              : 'bg-black/10 hover:bg-black/20 text-black border border-black/10 hover:border-black/20'
            }`}
        >
          <span className="flex items-center gap-2">
            <span>Connect Wallet</span>
            <span className={`text-xs ${isNight ? 'text-white/40' : 'text-black/40'}`}>↗</span>
          </span>
        </button>
        {variant !== 'compact' && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`text-xs ${isNight ? 'text-white/40 hover:text-white/60' : 'text-black/40 hover:text-black/60'} transition-colors`}
          >
            ?
          </button>
        )}
        {showDetails && (
          <div className={`absolute top-full right-0 mt-2 p-3 rounded-xl text-xs leading-relaxed z-50
            ${isNight ? 'bg-slate-900 border border-white/10' : 'bg-white border border-black/10'}
            shadow-xl min-w-[240px]`}
            style={{ maxWidth: 280 }}
          >
            <p className={`font-medium mb-1 ${isNight ? 'text-white/80' : 'text-black/80'}`}>
              {BRAND.walletExplainer.headline}
            </p>
            <ul className={`space-y-1.5 ${isNight ? 'text-white/50' : 'text-black/50'}`}>
              {BRAND.walletExplainer.layers.map((layer) => (
                <li key={layer.name}>
                  {layer.icon} <strong>{layer.name}</strong> — {layer.detail}
                </li>
              ))}
            </ul>
            <p className={`mt-2 ${isNight ? 'text-white/40' : 'text-black/40'}`}>
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
          ${isNight
            ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/15'
            : 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-50'
          }`}
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span>Connected</span>
        <span className={`${isNight ? 'text-white/40' : 'text-black/40'} font-mono`}>
          {primaryAddr ? `${String(primaryAddr).slice(0, 4)}..` : ''}
        </span>
      </button>

      {/* Detail popover */}
      {showDetails && (
        <div className={`absolute top-full right-0 mt-2 p-3 rounded-xl text-xs leading-relaxed z-50
          ${isNight ? 'bg-slate-900 border border-white/10' : 'bg-white border border-black/10'}
          shadow-xl min-w-[200px]`}
        >
          {connected.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1">
              <span className={isNight ? 'text-white/70' : 'text-black/70'}>
                {c.icon} {c.label}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            </div>
          ))}
          {chains?.evm?.connected && !chains?.arc?.connected && (
            <button
              type="button"
              onClick={() => switchToArc()}
              className={`mt-2 w-full text-left text-[10px] py-1.5 px-2 rounded-lg ${
                isNight ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              🌀 Switch to Arc for USDC signals
            </button>
          )}
          <div className={`mt-2 pt-2 border-t ${isNight ? 'border-white/10' : 'border-black/10'}`}>
            <button
              onClick={() => {
                evmDisconnect();
                setShowDetails(false);
              }}
              className={`text-xs ${isNight ? 'text-red-400/70 hover:text-red-400' : 'text-red-600/70 hover:text-red-600'}`}
            >
              Disconnect all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
