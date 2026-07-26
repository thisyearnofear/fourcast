'use client';

import React, { useState } from 'react';
import Link from 'next/link';

/**
 * CantonMarkets — showcases Canton prediction market capabilities.
 * 
 * NOTE: This is a PREVIEW/SHOWCASE component with example markets to demonstrate
 * the UX. For live Canton markets with real ledger integration, visit /canton.
 * 
 * CBTC (cBTC): LIVE on Canton Devnet — fully integrated, transactions verified
 * cETH: Code-complete, coming soon — awaiting testnet tokens from onRails faucet
 */
export function CantonMarkets({ isNight = false }) {
  const [selectedAsset, setSelectedAsset] = useState('CBTC');

  // Example markets for demonstration purposes
  // In production, these would come from /api/canton/markets with live ledger data
  const exampleMarkets = [
    {
      id: 'example-btc-150k',
      question: 'Will Bitcoin exceed $150,000 by December 31, 2026?',
      settlementAsset: 'CBTC',
      yesOdds: 0.62,
      noOdds: 0.38,
      status: 'live',
    },
    {
      id: 'example-eth-5k',
      question: 'Will Ethereum hit $5,000 before Q3 2026?',
      settlementAsset: 'CETH',
      yesOdds: 0.45,
      noOdds: 0.55,
      status: 'coming-soon',
    },
    {
      id: 'example-fed-rate',
      question: 'Will the Fed cut rates in September 2026?',
      settlementAsset: 'CBTC',
      yesOdds: 0.71,
      noOdds: 0.29,
      status: 'live',
    },
  ];

  const filteredMarkets = exampleMarkets.filter(m => 
    selectedAsset === 'ALL' || m.settlementAsset === selectedAsset
  );

  return (
    <div className="platform-open-section">
      {/* Header with clear status */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">◈</span>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">Canton Prediction Markets</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--color-review)]/20 text-[var(--color-review)] border border-[var(--color-review)]/30">
              Preview
            </span>
          </div>
          <p className="text-sm text-[var(--color-ink-muted)] max-w-2xl">
            Private prediction markets with hidden position sizes. Settlement in cBTC/cETH via Daml smart contracts.
          </p>
        </div>

        {/* Asset filter */}
        <div className="flex gap-1">
          {['ALL', 'CBTC', 'CETH'].map(asset => (
            <button
              key={asset}
              onClick={() => setSelectedAsset(asset)}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                selectedAsset === asset
                  ? asset === 'CETH'
                    ? 'bg-[var(--color-evidence)]/20 text-[var(--color-evidence)] border border-[var(--color-evidence)]/40'
                    : 'bg-[var(--color-sealed)]/20 text-[var(--color-sealed)] border border-[var(--color-sealed)]/40'
                  : 'bg-[var(--color-paper-raised)] text-[var(--color-ink-faint)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-soft)]'
              }`}
            >
              {asset === 'ALL' ? 'All' : asset === 'CBTC' ? 'cBTC' : 'cETH'}
            </button>
          ))}
        </div>
      </div>

      {/* Clear status indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="p-3 bg-[var(--color-paper-raised)] border border-[var(--color-accent)]/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 bg-[var(--color-accent)] animate-pulse" />
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-accent)] font-semibold">Live on Devnet</div>
          </div>
          <div className="text-base font-semibold text-[var(--color-ink)]">cBTC (BitSafe)</div>
          <div className="text-[10px] text-[var(--color-ink-muted)] mt-1">
            Real ledger transactions verified. Privacy tested with Alice/Bob parties.
          </div>
        </div>
        <div className="p-3 bg-[var(--color-paper-raised)] border border-[var(--color-evidence)]/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">⏳</span>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-evidence)] font-semibold">Coming Soon</div>
          </div>
          <div className="text-base font-semibold text-[var(--color-ink)]">cETH (onRails)</div>
          <div className="text-[10px] text-[var(--color-ink-muted)] mt-1">
            Code-complete. Awaiting testnet tokens from onRails faucet.
          </div>
        </div>
        <div className="p-3 bg-[var(--color-paper-raised)] border border-[var(--color-review)]/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">🔒</span>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-review)] font-semibold">Privacy Model</div>
          </div>
          <div className="text-base font-semibold text-[var(--color-ink)]">Daml Contracts</div>
          <div className="text-[10px] text-[var(--color-ink-muted)] mt-1">
            Position sizes hidden from all third parties. Only operator + holder see details.
          </div>
        </div>
      </div>

      {/* Why Canton callout */}
      <div className="p-4 bg-gradient-to-r from-[var(--color-review)]/10 to-[var(--color-evidence)]/10 border border-[var(--color-review)]/30 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Why Canton for Prediction Markets?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[var(--color-ink-muted)]">
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-accent)]">✓</span>
                <span><strong className="font-semibold">Whale-friendly privacy</strong> — take large positions without being front-run or copied</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-accent)]">✓</span>
                <span><strong className="font-semibold">Atomic settlement</strong> — cBTC/cETH compose with USDCx in one operation</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-accent)]">✓</span>
                <span><strong className="font-semibold">Daml smart contracts</strong> — complex multi-leg strategies impossible on EVM</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--color-accent)]">✓</span>
                <span><strong className="font-semibold">Institutional custody</strong> — BitSafe (cBTC) and onRails (cETH) infrastructure</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Example Markets List */}
      <div className="mb-4 p-3 bg-[var(--color-sealed)]/10 border border-[var(--color-sealed)]/30">
        <div className="flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div className="text-xs text-[var(--color-sealed)]">
            <strong>Demo Showcase:</strong> These are example markets to demonstrate the UX. 
            Visit <Link href="/canton" className="underline hover:text-[var(--color-sealed)]">the live Canton settlement hub</Link> to create real markets and take positions on Canton Devnet.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredMarkets.map(market => (
          <CantonMarketCard
            key={market.id}
            market={market}
            isNight={isNight}
          />
        ))}
      </div>

      {/* CTA to /canton page */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/canton"
          className="px-6 py-3 bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent)]/30 transition-all text-center"
        >
          Create Live Market on Canton Devnet →
        </Link>
        <a
          href="https://docs.bitsafe.finance/developers"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-[var(--color-paper-raised)] border border-[var(--color-rule)] text-[var(--color-ink-muted)] text-sm hover:bg-[var(--color-paper-soft)] transition-all text-center"
        >
          BitSafe Docs (cBTC)
        </a>
        <a
          href="https://forms.gle/qY1Eq4AxuTFrxf49A"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-[var(--color-paper-raised)] border border-[var(--color-rule)] text-[var(--color-ink-muted)] text-sm hover:bg-[var(--color-paper-soft)] transition-all text-center"
        >
          Request cETH Testnet Tokens
        </a>
      </div>
    </div>
  );
}

function CantonMarketCard({ market, isNight }) {
  const assetColor = market.settlementAsset === 'CETH' ? 'text-[var(--color-evidence)]' : 'text-[var(--color-sealed)]';
  const assetSymbol = market.settlementAsset === 'CETH' ? 'cETH' : 'cBTC';
  const isComingSoon = market.status === 'coming-soon';

  return (
    <div className={`p-4 border transition-colors ${
      isComingSoon 
        ? 'bg-[var(--color-evidence)]/5 border-[var(--color-evidence)]/20' 
        : 'bg-[var(--color-paper-raised)] border-[var(--color-rule)] hover:bg-white/[0.07]'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Asset badge + status */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter bg-[var(--color-review)]/20 ${assetColor}`}>
              {assetSymbol}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent)]">
              <span className="text-xs">🔒</span>
              Private
            </span>
            {isComingSoon ? (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-evidence)]/20 text-[var(--color-evidence)] border border-[var(--color-evidence)]/30">
                Coming Soon
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent)]">
                <span className="flex h-1.5 w-1.5 bg-[var(--color-accent)] animate-pulse" />
                Live on Devnet
              </span>
            )}
          </div>

          {/* Question */}
          <h3 className="text-base font-medium text-[var(--color-ink)] mb-3 leading-snug">
            {market.question}
          </h3>

          {/* Odds */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--color-ink-faint)]">YES</span>
              <span className="text-lg font-light text-[var(--color-accent)]">
                {(market.yesOdds * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--color-ink-faint)]">NO</span>
              <span className="text-lg font-light text-[var(--color-breach)]">
                {(market.noOdds * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Action button */}
        {isComingSoon ? (
          <div className="text-right">
            <button 
              disabled 
              className="px-4 py-2 bg-[var(--color-evidence)]/10 border border-[var(--color-evidence)]/20 text-[var(--color-evidence)]/50 text-sm font-medium cursor-not-allowed"
            >
              Awaiting Tokens
            </button>
            <div className="text-[10px] text-[var(--color-evidence)]/70 mt-1">
              cETH integration ready
            </div>
          </div>
        ) : (
          <Link
            href="/canton"
            className="px-4 py-2 bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 text-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent)]/30 transition-all"
          >
            Create Market →
          </Link>
        )}
      </div>
    </div>
  );
}
