'use client';

import React, { useEffect, useState } from 'react';

export default function ProfileDrawer({ isOpen, onClose, address, isNight }) {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && address) {
            fetchProfile();
        }
    }, [isOpen, address]);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/profile?address=${address}`);
            const data = await response.json();
            if (data.success) {
                setProfile(data.profile);
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    // Glass CSS classes (DRY)
    const textColor = isNight ? 'text-white' : 'text-black';
    const glassPanel = isNight ? 'glass-heavy bg-slate-900/95' : 'glass-heavy-light bg-white/95';
    const borderColor = isNight ? 'border-white/10' : 'border-black/10';

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`relative w-full max-w-md h-full ${glassPanel} border-l shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto`}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className={`text-2xl font-thin ${textColor}`}>Analyst Profile</h2>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-full hover:bg-gray-500/10 ${textColor}`}
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mb-8">
                        <div className={`text-sm ${textColor} opacity-60 mb-1`}>Address</div>
                        <div className={`font-mono text-sm ${textColor} break-all`}>
                            {address}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className={`w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin ${textColor}`} />
                        </div>
                    ) : profile ? (
                        <div className="space-y-8">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded-2xl border ${borderColor} ${isNight ? 'bg-white/5' : 'bg-black/5'}`}>
                                    <div className={`text-xs ${textColor} opacity-60 mb-1`}>Win Rate</div>
                                    <div className={`text-2xl font-light ${textColor}`}>
                                        {profile.stats.win_count + profile.stats.loss_count > 0
                                            ? Math.round((profile.stats.win_count / (profile.stats.win_count + profile.stats.loss_count)) * 100)
                                            : 0}%
                                    </div>
                                </div>
                                <div className={`p-4 rounded-2xl border ${borderColor} ${isNight ? 'bg-white/5' : 'bg-black/5'}`}>
                                    <div className={`text-xs ${textColor} opacity-60 mb-1`}>Signals</div>
                                    <div className={`text-2xl font-light ${textColor}`}>
                                        {profile.stats.total_predictions}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div>
                                <h3 className={`text-lg font-light ${textColor} mb-4`}>Recent Activity</h3>
                                <div className="space-y-3">
                                    {profile.recent_predictions.length > 0 ? (
                                        profile.recent_predictions.map((pred, i) => (
                                            <div key={i} className={`p-4 rounded-xl border ${borderColor} ${isNight ? 'bg-white/5' : 'bg-black/5'}`}>
                                                <div className={`text-sm ${textColor} mb-1`}>
                                                    {pred.market_title || 'Unknown Market'}
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className={pred.side === 'YES' ? 'text-green-500' : 'text-red-500'}>
                                                        {pred.side}
                                                    </span>
                                                    <span className={`${textColor} opacity-50`}>
                                                        {new Date(pred.timestamp * 1000).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className={`text-sm ${textColor} opacity-50 italic`}>
                                            No recent activity
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={`text-center ${textColor} opacity-60`}>
                            Failed to load profile
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
