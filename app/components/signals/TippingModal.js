import React, { useState } from 'react';

export default function TippingModal({ isOpen, onClose, onTip, recipientAddress, isNight }) {
    const [amount, setAmount] = useState('1'); // Default 1 MOVE
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const textColor = isNight ? 'text-white' : 'text-black';
    const bgColor = isNight ? 'bg-slate-900/90' : 'bg-white/90';
    const borderColor = isNight ? 'border-white/10' : 'border-black/10';
    const inputBg = isNight ? 'bg-white/5' : 'bg-black/5';

    // Preset amounts in MOVE
    const PRESETS = [0.1, 0.5, 1, 5];

    const handleTip = async () => {
        if (!amount || parseFloat(amount) <= 0) return;

        setIsProcessing(true);
        try {
            // Convert MOVE to Octas (10^8)
            const octas = Math.floor(parseFloat(amount) * 100000000);
            await onTip(octas);
            onClose();
        } catch (error) {
            console.error('Tip failed:', error);
            // Error is handled in the parent component
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative w-full max-w-sm ${bgColor} backdrop-blur-xl border ${borderColor} rounded-3xl p-6 shadow-2xl transform transition-all`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-xl font-light ${textColor}`}>
                        Tip Analyst
                    </h3>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full hover:bg-gray-500/10 ${textColor} opacity-60 hover:opacity-100 transition-opacity`}
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Recipient Info */}
                    <div className={`p-4 rounded-2xl border ${borderColor} ${isNight ? 'bg-amber-500/10' : 'bg-amber-500/5'}`}>
                        <div className={`text-xs ${textColor} opacity-60 mb-1 uppercase tracking-wider`}>To</div>
                        <div className={`font-mono text-sm ${textColor} flex items-center gap-2`}>
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs">
                                ⛽
                            </span>
                            {recipientAddress ? `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}` : 'Unknown'}
                        </div>
                    </div>

                    {/* Amount Selection */}
                    <div>
                        <div className={`text-sm ${textColor} opacity-70 mb-3`}>Select Amount (MOVE)</div>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => setAmount(preset.toString())}
                                    className={`py-2 px-1 rounded-xl text-sm transition-all ${amount === preset.toString()
                                        ? 'bg-amber-500 text-white font-medium shadow-lg shadow-amber-500/20'
                                        : `${inputBg} ${textColor} hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20`
                                        }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Custom amount"
                                min="0"
                                step="any"
                                className={`w-full ${inputBg} ${textColor} border ${borderColor} rounded-2xl py-4 px-4 text-2xl font-light focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all`}
                            />
                            <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${textColor} opacity-50 text-sm font-medium`}>
                                MOVE
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleTip}
                        disabled={isProcessing || !amount}
                        className={`w-full py-4 rounded-2xl text-white font-medium text-lg transition-all
                            ${isProcessing || !amount
                                ? 'bg-gray-500/20 cursor-not-allowed opacity-50'
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]'
                            }
                        `}
                    >
                        {isProcessing ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Sending...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <span>💎</span>
                                <span>Send {amount || '0'} MOVE</span>
                            </div>
                        )}
                    </button>

                    <p className={`text-center text-xs ${textColor} opacity-40`}>
                        Transactions are secured by Movement network
                    </p>
                </div>
            </div>
        </div>
    );
}
