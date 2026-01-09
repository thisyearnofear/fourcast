function getTierInfo(winRate) {
    if (winRate >= 0.85) return { name: 'Sage', emoji: '👑', color: 'from-yellow-500 to-orange-500' };
    if (winRate >= 0.75) return { name: 'Elite Analyst', emoji: '🌟', color: 'from-blue-500 to-cyan-500' };
    if (winRate >= 0.60) return { name: 'Forecaster', emoji: '🎯', color: 'from-green-500 to-emerald-500' };
    if (winRate >= 0.50) return { name: 'Predictor', emoji: '📊', color: 'from-slate-500 to-gray-500' };
    return { name: 'Novice', emoji: '🌱', color: 'from-slate-400 to-gray-400' };
}

export default function LeaderboardTab({ leaderboard, isNight, textColor, cardBgColor, onProfileClick }) {
    if (!leaderboard || leaderboard.length === 0) {
        return (
            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-12 text-center`}>
                <div className="text-6xl mb-4">🏆</div>
                <h3 className={`text-xl font-light ${textColor} mb-2`}>No Ranked Analysts Yet</h3>
                <p className={`${textColor} opacity-60 text-sm`}>
                    Be the first to publish high-quality signals and climb the ranks.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-center mb-4">
                <div className={`${textColor} opacity-60`}>Rank</div>
                <div className={`${textColor} opacity-60`}>Analyst</div>
                <div className={`${textColor} opacity-60`}>Stats</div>
                <div className={`${textColor} opacity-60`}>Earnings</div>
            </div>

            {/* Leaderboard Cards */}
            <div className="grid grid-cols-1 gap-4">
                {leaderboard.map((user, index) => {
                    const tier = getTierInfo(user.win_rate || 0);
                    const earnings = user.total_earnings || 0;

                    return (
                        <div
                            key={user.user_address}
                            onClick={() => onProfileClick(user.user_address)}
                            className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4 sm:p-6 hover:scale-[1.01] transition-all cursor-pointer`}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                                {/* Rank */}
                                <div className="flex items-center gap-3">
                                    <div className={`text-2xl font-thin ${index < 3 ? (isNight ? 'text-yellow-400' : 'text-yellow-600') : 'opacity-40'}`}>
                                        #{index + 1}
                                    </div>
                                </div>

                                {/* Analyst Info */}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{tier.emoji}</span>
                                        <span className={`text-sm font-light ${textColor}`}>
                                            {tier.name}
                                        </span>
                                    </div>
                                    <div className={`text-xs ${textColor} opacity-60`}>
                                        {typeof user.user_address === 'string'
                                            ? `${user.user_address.substring(0, 6)}...${user.user_address.substring(user.user_address.length - 4)}`
                                            : 'Unknown'}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="space-y-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border block w-fit ${isNight ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20'} opacity-70`}>
                                        {user.total_predictions} Signals
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border block w-fit ${isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30'}`}>
                                        {(user.win_rate * 100).toFixed(1)}% Win
                                    </span>
                                </div>

                                {/* Earnings */}
                                <div className="text-right sm:text-right">
                                    <div className={`text-xs ${textColor} opacity-60 mb-1`}>Tips Earned</div>
                                    <div className={`text-xl font-light ${isNight ? 'text-blue-300' : 'text-blue-700'}`}>
                                        {earnings > 0 ? `${earnings}  APT` : '—'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
