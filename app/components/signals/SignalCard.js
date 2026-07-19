import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ChainNetworkBadge, ConfidenceBadge, QualityBadge, EfficiencyBadge, OnChainBadge } from './SignalBadges';
import { generateXUrl, generateFarcasterUrl, generateSignalUrl, copySignalLink } from '@/utils/shareSignal';
import EvidenceBlock from '@/components/EvidenceBlock';
import ReputationBadge from '@/components/ReputationBadge';
import FollowButton from '@/components/FollowButton';

export default function SignalCard({ signal, index, isExpanded, onToggle, formatTimestamp, isNight, textColor, onProfileClick, userStats, onExpand }) {
    const [shareOpen, setShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const { address } = useAccount();

    const handleToggle = () => {
        onToggle();
        if (!isExpanded && onExpand) {
            onExpand();
        }
    };

    return (
        <div
            className="fc-signal-record pl-4 pb-4 cursor-pointer"
            onClick={handleToggle}
        >
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <ChainNetworkBadge signal={signal} isNight={isNight} />
                <ConfidenceBadge confidence={signal.confidence} isNight={isNight} />
                <QualityBadge signal={signal} isNight={isNight} />
                {signal.odds_efficiency && (
                    <EfficiencyBadge efficiency={signal.odds_efficiency} isNight={isNight} />
                )}
                <span className={`text-xs ${textColor} opacity-50`}>
                    {formatTimestamp(signal.timestamp)}
                </span>
                {signal.tx_hash && (
                    <OnChainBadge txHash={signal.tx_hash} isNight={isNight} />
                )}
                <span className={`ml-auto text-xs opacity-40 ${isExpanded ? 'rotate-180' : ''} transition-transform`}>▼</span>
            </div>
            {signal.ai_digest && (
                <p className={`text-sm ${textColor} opacity-70 ${isExpanded ? '' : 'line-clamp-2'} transition-all`}>
                    {signal.ai_digest}
                </p>
            )}
            {isExpanded && (
                <div className="fc-decision-chain mt-4" aria-label="Signal proof path">
                    <span className="is-complete">Evidence</span>
                    <span className="is-complete">Call recorded</span>
                    <span className={signal.tx_hash ? 'is-complete' : ''}>Arc receipt</span>
                    <span className={signal.outcome ? 'is-complete' : ''}>{signal.outcome ? 'Outcome logged' : 'Awaiting outcome'}</span>
                </div>
            )}
            {/* Evidence Block — shown when expanded */}
            {isExpanded && (
                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                    <EvidenceBlock
                        signal={signal}
                        isNight={isNight}
                        textColor={textColor}
                        calibrationScore={userStats?.calibrationScore}
                        agentBrierScore={userStats?.agentBrierScore}
                    />
                </div>
            )}
            {signal.author_address && (
                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onProfileClick(signal.author_address);
                            }}
                            className={`text-xs ${textColor} opacity-50 hover:opacity-100 hover:underline text-left shrink-0`}
                        >
                            By: {typeof signal.author_address === 'string' && signal.author_address ? `${signal.author_address.substring(0, 6)}...${signal.author_address.substring(signal.author_address.length - 4)}` : 'Unknown'}
                        </button>
                        {isExpanded && userStats && (
                            <ReputationBadge
                                stats={userStats}
                                isNight={isNight}
                                variant="compact"
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {/* Follow analyst — converts one-shot share virality into compounding retention */}
                        <span onClick={(e) => e.stopPropagation()}>
                            <FollowButton authorAddress={signal.author_address} currentAddress={address} />
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShareOpen(!shareOpen);
                            }}
                            className="text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30"
                        >
                            Share
                        </button>
                    </div>
                </div>
            )}
            {/* Share Menu — available without expanding provenance */}
            {shareOpen && (
                <div
                    className={`mt-4 flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex gap-2">
                        <a
                            href={generateXUrl(signal, userStats)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 text-xs px-3 py-2 rounded transition-all text-center bg-black/40 hover:bg-black/60 text-white border border-white/20`}
                        >
                            𝕏 Share
                        </a>
                        <a
                            href={generateFarcasterUrl(signal, userStats)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 text-xs px-3 py-2 rounded transition-all text-center bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100 border border-emerald-400/30`}
                        >
                            Warpcast
                        </a>
                    </div>
                    <button
                        onClick={() => {
                            copySignalLink(signal);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }}
                        className={`w-full text-xs px-3 py-2 rounded transition-all text-center flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border border-emerald-500/20`}
                    >
                        <span>{copied ? 'Copied' : 'Copy signal link'}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
