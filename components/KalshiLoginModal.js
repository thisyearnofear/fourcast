'use client';

import { useState } from 'react';
import useKalshiAuth from '@/hooks/useKalshiAuth';

export default function KalshiLoginModal({ isOpen, onClose, onSuccess, isNight = true }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { setAuth } = useKalshiAuth();

    const bgColor = isNight ? 'bg-black/40' : 'bg-white/40';
    const inputBg = isNight ? 'bg-white/5' : 'bg-black/5';
    const textColor = isNight ? 'text-white' : 'text-black';
    const borderColor = isNight ? 'border-white/10' : 'border-black/10';

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/kalshi/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                // Store authentication in Zustand
                setAuth(data.data.token, data.data.memberId, data.data.expiry);
                onSuccess?.();
                onClose();

                // Clear form
                setEmail('');
                setPassword('');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`${bgColor} backdrop-blur-xl border ${borderColor} rounded-2xl max-w-md w-full p-8 shadow-2xl`}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className={`text-2xl font-light ${textColor} mb-2`}>Connect to Kalshi</h2>
                        <p className={`text-sm ${textColor} opacity-70`}>
                            Log in with your Kalshi account to trade directly from Fourcast
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`text-2xl ${textColor} opacity-50 hover:opacity-75`}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className={`block text-xs ${textColor} opacity-70 mb-2`}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl ${inputBg} border ${borderColor} ${textColor} focus:border-emerald-500 outline-none transition-colors`}
                            placeholder="your@email.com"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className={`block text-xs ${textColor} opacity-70 mb-2`}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl ${inputBg} border ${borderColor} ${textColor} focus:border-emerald-500 outline-none transition-colors`}
                            placeholder="••••••••"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className={`text-red-400 text-sm ${isNight ? 'bg-red-500/20' : 'bg-red-400/20'} border ${isNight ? 'border-red-400/30' : 'border-red-500/30'} px-4 py-3 rounded-xl`}>
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className={`flex-1 px-4 py-3 rounded-lg font-light text-sm transition-all border ${isNight
                                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'
                                    : 'bg-black/5 hover:bg-black/10 border-black/10 text-black/70'
                                } disabled:opacity-50`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex-1 px-4 py-3 rounded-lg font-light text-sm transition-all border ${isNight
                                    ? 'bg-emerald-500/30 hover:bg-emerald-500/40 border-emerald-400/30 text-emerald-200'
                                    : 'bg-emerald-400/30 hover:bg-emerald-400/40 border-emerald-500/30 text-emerald-900'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Connecting...
                                </span>
                            ) : (
                                'Connect'
                            )}
                        </button>
                    </div>
                </form>

                <p className={`text-xs ${textColor} opacity-50 mt-4 text-center`}>
                    Don't have a Kalshi account?{' '}
                    <a
                        href="https://kalshi.com/sign-up"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-500 hover:underline"
                    >
                        Sign up here
                    </a>
                </p>
            </div>
        </div>
    );
}
