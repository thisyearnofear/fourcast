import { useState } from 'react';
import { ChainNetworkBadge, ConfidenceBadge, QualityBadge, EfficiencyBadge, OnChainBadge } from './SignalBadges';
import { generateXUrl, generateFarcasterUrl } from '@/utils/shareSignal';

export default function SignalCard({ signal, index, isExpanded, onToggle, formatTimestamp, isNight, textColor, onProfileClick, onTip, userStats, onExpand }) {
    const [shareOpen, setShareOpen] = useState(false);

    const handleToggle = () => {
        onToggle();
        if (!isExpanded && onExpand) {
            onExpand();
        }
    };

    return (
        <div
            className={`border-l-2 pl-4 pb-4 cursor-pointer transition-all ${isNight ? 'border-blue-500/30 hover:border-blue-500/60' : 'border-blue-400/30 hover:border-blue-400/60'}`}
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

            {isExpanded && signal.market_snapshot_hash && (
                <div className={`mt-3 text-xs ${textColor} opacity-40`}>
                    Snapshot: {typeof signal.market_snapshot_hash === 'string' && signal.market_snapshot_hash ? signal.market_snapshot_hash.substring(0, 16) : 'N/A'}...
                </div>
            )}

            {signal.author_address && (
                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onProfileClick(signal.author_address);
                        }}
                        className={`text-xs ${textColor} opacity-50 hover:opacity-100 hover:underline text-left`}
                    >
                        By: {typeof signal.author_address === 'string' && signal.author_address ? `${signal.author_address.substring(0, 6)}...${signal.author_address.substring(signal.author_address.length - 4)}` : 'Unknown'}
                    </button>

                    <div className="flex items-center gap-2 ml-auto">
                        {/* Tip Button - Visible for Movement signals */}
                        {onTip && (signal.chain_origin === 'MOVEMENT' || signal.tipping_enabled) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const amount = prompt("Enter tip amount (in Octas/units):", "10000000");
                                    if (amount) onTip(amount);
                                }}
                                className={`text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${isNight
                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                                    : 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 border border-amber-600/20'
                                    }`}
                            >
                                <span>💰</span>
                                <span>Tip</span>
                            </button>
                        )}

                        {isExpanded && (
                            /* Share Button */
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShareOpen(!shareOpen);
                                }}
                                className={`text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${isNight
                                    ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                                    : 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 border border-blue-600/20'
                                    }`}
                            >
                                <span>🔗</span>
                                <span>Share</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Share Menu */}
            {isExpanded && shareOpen && (
                <div className={`mt-4 flex gap-2 p-3 rounded-lg ${isNight ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'}`}>
                    <a
                        href={generateXUrl(signal, userStats)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-1 text-xs px-3 py-2 rounded transition-all text-center ${isNight
                            ? 'bg-black/40 hover:bg-black/60 text-white border border-white/20'
                            : 'bg-gray-200 hover:bg-gray-300 text-black'
                            }`}
                    >
                        𝕏 Share
                    </a>
                    <a
                        href={generateFarcasterUrl(signal, userStats)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-1 text-xs px-3 py-2 rounded transition-all text-center ${isNight
                            ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/30'
                            : 'bg-purple-100 hover:bg-purple-200 text-purple-900'
                            }`}
                    >
                        ⛵ Warpcast
                    </a>
                </div>
            )}
        </div>
    );
}
