'use client';

import { useState } from 'react';
import { BRAND } from '@/constants/brand';
import { useCantonWalletContext } from '@/app/CantonWalletLayer';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export default function PublishConfirmModal({ isOpen, onClose, onConfirm, market, analysis, isNight, isPublishing }) {
 const canton = useCantonWalletContext();
 const [settlementLayer, setSettlementLayer] = useState('arc'); // 'arc' | 'canton'
 const [cantonAsset, setCantonAsset] = useState('CBTC'); // 'CBTC' | 'CETH'
 const modalRef = useFocusTrap({ isOpen, onClose });

 if (!isOpen) return null;

 const chainLabel = settlementLayer === 'canton'
 ? `Canton (${cantonAsset === 'CETH' ? 'cETH' : 'cBTC'})`
 : BRAND.publish.arcPreferred.chain;
 const gasLabel = settlementLayer === 'canton'
 ? BRAND.publish.cantonPrivate.gas
 : BRAND.publish.arcPreferred.gas;

 const recommendation = analysis?.recommended_action || analysis?.assessment?.direction || 'Neutral';
 const confidence = analysis?.assessment?.confidence || 'Unknown';
 const reasoning = analysis?.reasoning || analysis?.analysis || '';
 const reasoningPreview = reasoning.length > 120 ? reasoning.slice(0, 120) + '...' : reasoning;

 const handleConfirm = () => {
 onConfirm(settlementLayer, cantonAsset);
 };

 return (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/50" onClick={onClose} />
 <div
 ref={modalRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby="publish-modal-heading"
 className={`relative max-w-md w-full p-6 border bg-[var(--color-paper-deep)] border-[var(--color-rule)]`}
 >
 <h3 id="publish-modal-heading" className={`text-lg font-light mb-2 text-[var(--color-ink)]`}>
 Publish one sealed receipt
 </h3>
 <p className="mb-4 text-xs leading-5 text-[var(--color-ink-faint)]">
 Your call is timestamped and sealed on-chain before the outcome is known — a tamper-proof receipt that starts your public track record.
 </p>

 <div className="space-y-3 mb-6">
 <div className={` p-3 border bg-[var(--color-paper-raised)] border-[var(--color-rule)]`}>
 <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Market</div>
 <div className={`text-sm font-medium text-[var(--color-ink)]`}>
 {market?.title || market?.question || 'Unknown'}
 </div>
 </div>

 <div className="flex gap-3">
 <div className={`flex-1 p-3 border bg-[var(--color-paper-raised)] border-[var(--color-rule)]`}>
 <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Your Call</div>
 <div className={`text-sm font-medium text-[var(--color-accent)]`}>
 {recommendation}
 </div>
 </div>
 <div className={`flex-1 p-3 border bg-[var(--color-paper-raised)] border-[var(--color-rule)]`}>
 <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Confidence</div>
 <div className={`text-sm font-medium text-[var(--color-review)]`}>
 {confidence}
 </div>
 </div>
 </div>

 <div className={` p-3 border bg-[var(--color-paper-raised)] border-[var(--color-rule)]`}>
 <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">AI Reasoning</div>
 <div className={`text-xs leading-relaxed text-[var(--color-ink-muted)]`}>
 {reasoningPreview}
 </div>
 </div>

 {/* Settlement Layer Selector */}
 <div className={` p-3 border bg-[var(--color-paper-raised)] border-[var(--color-rule)]`}>
 <div className="text-[10px] uppercase tracking-wider opacity-40 mb-2">Settlement Layer</div>
 <div className={`grid ${canton?.cantonEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
 <button
 type="button"
 onClick={() => setSettlementLayer('arc')}
 className={` p-2.5 text-left transition-all border ${
 settlementLayer === 'arc'
 ? 'bg-[var(--color-review)]/20 border-[var(--color-review)]/50 text-[var(--color-review)]'
 : 'bg-[var(--color-paper-raised)] border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]'
 }`}
 >
 <div className="text-xs font-medium flex items-center gap-1.5">
 <span>◆</span> Arc (Public)
 </div>
 <div className="text-[10px] opacity-60 mt-1">
 USDC · public reputation receipt
 </div>
 </button>
 {canton?.cantonEnabled && (
 <button
 type="button"
 onClick={() => setSettlementLayer('canton')}
 disabled={!canton?.connected}
 className={` p-2.5 text-left transition-all border disabled:opacity-30 disabled:cursor-not-allowed ${
 settlementLayer === 'canton'
 ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
 : 'bg-[var(--color-paper-raised)] border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]'
 }`}
 >
 <div className="text-xs font-medium flex items-center gap-1.5">
 <span>◈</span> Canton (Private)
 </div>
 <div className="text-[10px] opacity-60 mt-1">
 {canton?.connected ? 'cBTC/cETH · hidden sizes' : 'Connect Console Wallet first'}
 </div>
 </button>
 )}
 </div>
 
 {/* Settlement Asset Selector (only for Canton) */}
 {settlementLayer === 'canton' && canton?.connected && (
 <div className="mt-3 pt-3 border-t border-[var(--color-rule)]">
 <div className="text-[10px] uppercase tracking-wider opacity-40 mb-2">Settlement Asset</div>
 <div className="grid grid-cols-2 gap-2">
 <button
 type="button"
 onClick={() => setCantonAsset('CBTC')}
 className={`p-2 text-left transition-all border ${
 cantonAsset === 'CBTC'
 ? 'bg-[var(--color-sealed)]/20 border-[var(--color-sealed)]/50 text-[var(--color-sealed)]'
 : 'bg-[var(--color-paper-raised)] border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]'
 }`}
 >
 <div className="text-xs font-medium">cBTC</div>
 <div className="text-[10px] opacity-60">Canton Bitcoin (BitSafe)</div>
 </button>
 <button
 type="button"
 onClick={() => setCantonAsset('CETH')}
 className={`p-2 text-left transition-all border ${
 cantonAsset === 'CETH'
 ? 'bg-[var(--color-evidence)]/20 border-[var(--color-evidence)]/50 text-[var(--color-evidence)]'
 : 'bg-[var(--color-paper-raised)] border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]'
 }`}
 >
 <div className="text-xs font-medium">cETH</div>
 <div className="text-[10px] opacity-60">Canton Ethereum (onRails)</div>
 </button>
 </div>
 <div className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
 {cantonAsset === 'CETH' 
 ? 'cETH is CIP-56 compliant and composes atomically with USDCx.'
 : 'cBTC is the first programmable Bitcoin-backed asset on Canton.'}
 </div>
 </div>
 )}
 </div>

 <div className={`flex items-center justify-between p-3 border bg-[var(--color-paper-raised)] border-[var(--color-rule)]`}>
 <div className="text-[10px] uppercase tracking-wider opacity-40">Chain</div>
 <div className={`text-xs font-medium ${settlementLayer === 'canton' ? 'text-[var(--color-accent)]' : 'text-[var(--color-review)]'}`}>
 {chainLabel}
 </div>
 <div className="text-[10px] uppercase tracking-wider opacity-40">Fee</div>
 <div className={`text-xs font-medium text-[var(--color-ink)]`}>{gasLabel}</div>
 </div>
 </div>

 <div className="flex gap-3">
 <button
 onClick={onClose}
 disabled={isPublishing}
 className={`flex-1 px-4 py-2.5 border text-sm transition-all border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] disabled:opacity-30`}
 >
 Cancel
 </button>
 <button
 onClick={handleConfirm}
 disabled={isPublishing}
 className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 ${
 settlementLayer === 'canton'
 ? 'bg-gradient-to-r from-[var(--color-accent)]/20 to-[var(--color-evidence)]/20 border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:from-[var(--color-accent)]/30 hover:to-[var(--color-evidence)]/30'
 : 'bg-gradient-to-r from-[var(--color-review)]/20 to-[var(--color-review)]/20 border border-[var(--color-review)]/30 text-[var(--color-review)] hover:from-[var(--color-review)]/30 hover:to-[var(--color-review)]/30'
 }`}
 >
 {isPublishing
 ? 'Confirming...'
 : settlementLayer === 'canton'
 ? 'Settle Privately on Canton'
 : 'Confirm & Publish on Arc'}
 </button>
 </div>

 <p className={`text-[10px] text-center mt-4 text-[var(--color-ink-faint)]`}>
 {settlementLayer === 'canton'
 ? 'Private Daml transaction — position size visible only to you and the operator.'
 : 'This action is on-chain and cannot be undone.'}
 </p>
 </div>
 </div>
 );
}
