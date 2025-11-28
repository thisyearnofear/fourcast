export default function SignalFilters({ filters, setFilters, sortBy, setSortBy, isNight, textColor, cardBgColor }) {
    return (
        <>
            {/* Search Bar */}
            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 mb-6`}>
                <input
                    type="text"
                    value={filters.searchText}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                    placeholder="🔍 Search signals by market or analysis..."
                    className={`w-full px-4 py-3 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white placeholder-white/40' : 'bg-black/10 border-black/20 text-black placeholder-black/40'}`}
                />
            </div>

            {/* Filters & Sort */}
            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 mb-8`}>
                <div className="flex justify-between items-center mb-4">
                    <label className={`${textColor} text-xs opacity-60 uppercase tracking-wider`}>Filters & Sort</label>
                    <div className="flex gap-2">
                        {['newest', 'confidence', 'accuracy'].map(sort => (
                            <button
                                key={sort}
                                onClick={() => setSortBy(sort)}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-all capitalize ${sortBy === sort
                                    ? (isNight ? 'bg-blue-500/30 text-white border border-blue-400/40' : 'bg-blue-400/30 text-black border border-blue-500/40')
                                    : `${textColor} opacity-60 hover:opacity-100`}`}
                            >
                                {sort}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className={`${textColor} text-xs opacity-60 block mb-1`}>Event ID</label>
                        <input
                            type="text"
                            value={filters.eventId}
                            onChange={(e) => setFilters(prev => ({ ...prev, eventId: e.target.value }))}
                            placeholder="Filter by event..."
                            className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white placeholder-white/50' : 'bg-black/10 border-black/20 text-black placeholder-black/50'}`}
                        />
                    </div>

                    <div>
                        <label className={`${textColor} text-xs opacity-60 block mb-1`}>Confidence</label>
                        <select
                            value={filters.confidence}
                            onChange={(e) => setFilters(prev => ({ ...prev, confidence: e.target.value }))}
                            className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'}`}
                        >
                            <option value="all">All Confidence</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>

                    <div>
                        <label className={`${textColor} text-xs opacity-60 block mb-1`}>Odds Efficiency</label>
                        <select
                            value={filters.oddsEfficiency}
                            onChange={(e) => setFilters(prev => ({ ...prev, oddsEfficiency: e.target.value }))}
                            className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'}`}
                        >
                            <option value="all">All Efficiency</option>
                            <option value="INEFFICIENT">Inefficient</option>
                            <option value="EFFICIENT">Efficient</option>
                        </select>
                    </div>

                    <div>
                        <label className={`${textColor} text-xs opacity-60 block mb-1`}>Author</label>
                        <input
                            type="text"
                            value={filters.author}
                            onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
                            placeholder="Filter by author..."
                            className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white placeholder-white/50' : 'bg-black/10 border-black/20 text-black placeholder-black/50'}`}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
