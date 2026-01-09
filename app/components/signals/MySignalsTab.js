import { ConfidenceBadge, EfficiencyBadge } from './SignalBadges';
import { PersonalStatsDashboard } from '@/components/PersonalStatsDashboard';
import { MarketInsightsTimeline } from '@/components/MarketInsightsTimeline';

export default function MySignalsTab({ signals, isLoading, isNight, textColor, cardBgColor, expandedSignalId, setExpandedSignalId, formatTimestamp, userAddress }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className={`w-6 h-6 border-2 ${isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'} rounded-full animate-spin`}></div>
                <span className={`ml-3 ${textColor} opacity-70`}>Loading your signals...</span>
            </div>
        );
    }

    if (!signals || signals.length === 0) {
        return (
            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-12 text-center`}>
                <div className="text-6xl mb-4">⭐</div>
                <h3 className={`text-xl font-light ${textColor} mb-2`}>No Signals Yet</h3>
                <p className={`${textColor} opacity-60 text-sm`}>
                    Head to Markets to analyze events and publish your first signal on-chain
                </p>
            </div>
        );
    }

    const won = signals.filter(s => s.outcome === 'YES' || s.outcome === 'CORRECT').length;
    const lost = signals.filter(s => s.outcome === 'NO' || s.outcome === 'INCORRECT').length;
    const pending = signals.filter(s => s.outcome === 'PENDING' || !s.outcome).length;
    const winRate = (won + lost) > 0 ? ((won / (won + lost)) * 100).toFixed(1) : 'N/A';

    return (
        <div className="space-y-6">
            {/* Comprehensive Stats Dashboard */}
            {userAddress ? (
                <PersonalStatsDashboard
                    userAddress={userAddress}
                    isNight={isNight}
                    compact={false}
                />
            ) : (
                <>
                    {/* Fallback: Basic stats grid if userAddress not provided */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                            <div className={`text-3xl font-light ${textColor} mb-1`}>{signals.length}</div>
                            <div className={`text-xs ${textColor} opacity-60`}>Total Published</div>
                        </div>
                        <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                            <div className={`text-3xl font-light ${isNight ? 'text-green-400' : 'text-green-600'} mb-1`}>{won}</div>
                            <div className={`text-xs ${textColor} opacity-60`}>Won</div>
                        </div>
                        <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                            <div className={`text-3xl font-light ${isNight ? 'text-red-400' : 'text-red-600'} mb-1`}>{lost}</div>
                            <div className={`text-xs ${textColor} opacity-60`}>Lost</div>
                        </div>
                        <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                            <div className={`text-3xl font-light ${textColor} mb-1`}>{pending}</div>
                            <div className={`text-xs ${textColor} opacity-60`}>Pending</div>
                        </div>
                    </div>

                    {/* Win Rate */}
                    {winRate !== 'N/A' && (
                        <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6`}>
                            <div className="flex items-end gap-4">
                                <div>
                                    <div className={`text-xs ${textColor} opacity-60 mb-2 uppercase tracking-wider`}>Win Rate</div>
                                    <div className={`text-4xl font-light ${isNight ? 'text-green-400' : 'text-green-600'}`}>
                                        {winRate}%
                                    </div>
                                </div>
                                <div className={`flex-1 h-2 rounded-full ${isNight ? 'bg-white/10' : 'bg-black/10'}`}>
                                    <div
                                        className={`h-full rounded-full ${isNight ? 'bg-green-500' : 'bg-green-600'}`}
                                        style={{ width: `${parseFloat(winRate)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Market Insights Timeline */}
            {userAddress && (
                <div className="space-y-4">
                    <h3 className={`text-lg font-light ${textColor}`}>Prediction History</h3>
                    <MarketInsightsTimeline
                        userAddress={userAddress}
                        isNight={isNight}
                    />
                </div>
            )}

            {/* Signals List */}
            <div className="space-y-4">
                {signals.map((signal) => {
                    const isExpanded = expandedSignalId === signal.id;
                    const statusColor = signal.outcome === 'YES' || signal.outcome === 'CORRECT'
                        ? (isNight ? 'text-green-400' : 'text-green-600')
                        : signal.outcome === 'NO' || signal.outcome === 'INCORRECT'
                            ? (isNight ? 'text-red-400' : 'text-red-600')
                            : (isNight ? 'text-yellow-400' : 'text-yellow-600');

                    return (
                        <div
                            key={signal.id}
                            className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 cursor-pointer hover:scale-[1.01] transition-all`}
                            onClick={() => setExpandedSignalId(isExpanded ? null : signal.id)}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className={`text-lg font-light ${textColor} mb-2`}>
                                        {signal.market_title || signal.event_id}
                                    </h3>
                                    {signal.venue && (
                                        <p className={`text-sm ${textColor} opacity-60`}>📍 {signal.venue}</p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className={`text-2xl font-light ${statusColor}`}>
                                        {signal.outcome === 'PENDING' || !signal.outcome ? '⏳' : signal.outcome === 'YES' || signal.outcome === 'CORRECT' ? '✓' : '✗'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <ConfidenceBadge confidence={signal.confidence} isNight={isNight} />
                                {signal.odds_efficiency && (
                                    <EfficiencyBadge efficiency={signal.odds_efficiency} isNight={isNight} />
                                )}
                                <span className={`text-xs ${textColor} opacity-50`}>
                                    {formatTimestamp(signal.timestamp)}
                                </span>
                                <span className={`ml-auto text-xs opacity-40 ${isExpanded ? 'rotate-180' : ''} transition-transform`}>▼</span>
                            </div>

                            {signal.ai_digest && (
                                <p className={`text-sm ${textColor} opacity-70 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                    {signal.ai_digest}
                                </p>
                            )}

                            {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                    {signal.tx_hash && (
                                        <div className={`text-xs ${textColor} opacity-60`}>
                                            <span className="font-medium">On-chain:</span>{' '}
                                            <a
                                                href={`https://explorer.aptoslabs.com/txn/${signal.tx_hash}?network=testnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:opacity-100 underline"
                                            >
                                                {typeof signal.tx_hash === 'string' ? signal.tx_hash.substring(0, 12) : 'View Tx'}...
                                            </a>
                                        </div>
                                    )}
                                    {signal.market_snapshot_hash && (
                                        <div className={`text-xs ${textColor} opacity-40`}>
                                            Snapshot: {typeof signal.market_snapshot_hash === 'string' ? signal.market_snapshot_hash.substring(0, 16) : ''}...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
