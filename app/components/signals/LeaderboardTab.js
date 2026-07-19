import { tierInfoFor, shortAddress } from '@/utils/signalTier';

export default function LeaderboardTab({ leaderboard, isNight, textColor, cardBgColor, onProfileClick }) {
    if (!leaderboard || leaderboard.length === 0) {
        return (
            <div className={`glass-subtle rounded-3xl p-12 text-center`}>
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
                    const tier = tierInfoFor(user.win_rate || 0);
                    const earnings = user.total_earnings || 0;

                    return (
                        <div
                            key={user.user_address}
                            onClick={() => onProfileClick(user.user_address)}
                            className={`glass-subtle rounded-2xl p-4 sm:p-6 hover:scale-[1.01] transition-all cursor-pointer`}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                                {/* Rank */}
                                <div className="flex items-center gap-3">
                                    <div className={`text-2xl font-thin ${index < 3 ? ('text-amber-400') : 'opacity-40'}`}>
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
                                        {shortAddress(user.user_address)}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="space-y-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border block w-fit bg-white/10 border-white/20 opacity-70`}>
                                        {user.total_predictions} Signals
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border block w-fit bg-green-500/20 text-green-300 border-green-500/30`}>
                                        {(user.win_rate * 100).toFixed(1)}% Win
                                    </span>
                                </div>

                                {/* Earnings */}
                                <div className="text-right sm:text-right">
                                    <div className={`text-xs ${textColor} opacity-60 mb-1`}>Tips Earned</div>
                                    <div className={`text-xl font-light text-emerald-300`}>
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
