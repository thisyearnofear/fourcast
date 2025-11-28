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
            <div className="grid grid-cols-1 gap-4">
                {leaderboard.map((user, index) => (
                    <div
                        key={user.user_address}
                        onClick={() => onProfileClick(user.user_address)}
                        className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 flex items-center justify-between hover:scale-[1.01] transition-all cursor-pointer`}
                    >
                        <div className="flex items-center gap-6">
                            <div className={`text-3xl font-thin ${index < 3 ? (isNight ? 'text-yellow-400' : 'text-yellow-600') : 'opacity-40'}`}>
                                #{index + 1}
                            </div>
                            <div>
                                <div className={`text-lg font-light ${textColor}`}>
                                    {user.user_address.substring(0, 6)}...{user.user_address.substring(user.user_address.length - 4)}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${isNight ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20'} opacity-70`}>
                                        {user.total_predictions} Signals
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30'}`}>
                                        {(user.win_rate * 100).toFixed(1)}% Win Rate
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className={`text-sm ${textColor} opacity-60 mb-1`}>Reputation Score</div>
                            <div className={`text-2xl font-light ${textColor}`}>
                                {Math.round(user.win_rate * user.total_predictions * 100)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
