import { ConfidenceBadge, QualityBadge, EfficiencyBadge, OnChainBadge } from './SignalBadges';

export default function SignalCard({ signal, index, isExpanded, onToggle, formatTimestamp, isNight, textColor, onProfileClick, onTip }) {
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
                <div className="flex items-center justify-between mt-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onProfileClick(signal.author_address);
                        }}
                        className={`text-xs ${textColor} opacity-50 hover:opacity-100 hover:underline text-left`}
                    >
                        By: {signal.author_address.substring(0, 6)}...{signal.author_address.substring(signal.author_address.length - 4)}
                    </button>

                    {onTip && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const amount = prompt("Enter tip amount (in Octas/units):", "10000000");
                                if (amount) onTip(amount);
                            }}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${isNight
                                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                                : 'bg-green-600/10 hover:bg-green-600/20 text-green-700 border border-green-600/20'
                                }`}
                        >
                            <span>💸</span>
                            <span>Tip Analyst</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
