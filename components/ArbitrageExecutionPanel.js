'use client';

import { useState } from 'react';
import { OrderSigningPanel } from './OrderSigningPanel';
import KalshiOrderPanel from './KalshiOrderPanel';

/**
 * Arbitrage Execution Panel
 * Split-screen view to execute both legs of an arbitrage trade simultaneously.
 */
export function ArbitrageExecutionPanel({ opportunity, onClose, isNight }) {
  const [step, setStep] = useState('review'); // 'review' | 'execute'
  const [polyStatus, setPolyStatus] = useState('pending'); // 'pending' | 'signed' | 'submitted' | 'failed'
  const [kalshiStatus, setKalshiStatus] = useState('pending');

  const { polymarket, kalshi, arbitrage } = opportunity;
  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const cardBg = isNight ? 'bg-slate-800' : 'bg-white';
  const borderColor = isNight ? 'border-white/10' : 'border-black/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40">
      <div className={`${cardBg} w-full max-w-5xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border ${borderColor}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">⚡</span>
              <h2 className={`text-xl font-medium ${textColor}`}>Arbitrage Execution</h2>
            </div>
            <p className={`text-sm ${textColor} opacity-60`}>
              Capture <span className="text-green-500 font-bold">{arbitrage.priceDiff}% spread</span> between markets
            </p>
          </div>
          <button 
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm border ${borderColor} hover:opacity-80 transition-all ${textColor}`}
          >
            Close
          </button>
        </div>

        {/* Split View */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left: Polymarket (Buy/Sell) */}
          <div className="flex-1 border-r border-white/10 relative p-4 flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Leg 1: Polymarket</span>
              <h3 className={`text-md font-medium ${textColor} mt-1 line-clamp-2`}>{polymarket.title}</h3>
            </div>
            
            <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/5">
              {/* We embed the OrderSigningPanel but strictly controlled */}
              <OrderSigningPanel 
                market={polymarket}
                isNight={isNight}
                initialSide="YES" // Logic would determine this based on arb direction
                onClose={() => {}} // Disable close within embedded view
                embedded={true}
              />
            </div>
          </div>

          {/* Right: Kalshi (Buy/Sell) */}
          <div className="flex-1 relative p-4 flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Leg 2: Kalshi</span>
              <h3 className={`text-md font-medium ${textColor} mt-1 line-clamp-2`}>{kalshi.title}</h3>
            </div>

            <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/5">
              <KalshiOrderPanel 
                market={kalshi}
                isNight={isNight}
                onClose={() => {}}
                embedded={true}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
