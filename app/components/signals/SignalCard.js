import { ConfidenceBadge, QualityBadge, EfficiencyBadge, OnChainBadge } from './SignalBadges';

export default function SignalCard({ signal, index, isExpanded, onToggle, formatTimestamp, isNight, textColor, onProfileClick }) {
    return (
        <div
            className={`border-l-2 pl-4 pb-4 cursor-pointer transition-all ${isNight ? 'border-blue-500/30 hover:border-blue-500/60' : 'border-blue-400/30 hover:border-blue-400/60'}`}
            onClick={onToggle}
        >
            <div className="flex flex-wrap items-center gap-2 mb-2">
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
                    Snapshot: {signal.market_snapshot_hash.substring(0, 16)}...
                </div>
            )}

            {signal.author_address && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onProfileClick(signal.author_address);
                    }}
                    className={`text-xs ${textColor} opacity-50 mt-2 hover:opacity-100 hover:underline text-left`}
                >
                    By: {signal.author_address.substring(0, 6)}...{signal.author_address.substring(signal.author_address.length - 4)}
                </button>
            )}
        </div>
    );
}
