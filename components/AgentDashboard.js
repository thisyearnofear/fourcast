'use client';

import React, { useState } from 'react';
import { useAgentLoop } from '@/hooks/useAgentLoop';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Markets' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Politics', label: 'Politics' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'Weather', label: 'Weather' },
];

export function AgentDashboard({ isNight = false }) {
  const { run, stop, isRunning, steps, recommendations, error } = useAgentLoop();
  const [category, setCategory] = useState('all');
  const [maxMarkets, setMaxMarkets] = useState(5);
  const [riskTolerance, setRiskTolerance] = useState(0.5);

  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';
  const cardBg = isNight ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/30';
  const inputBg = isNight ? 'bg-white/10 border-white/20 text-white' : 'bg-white/60 border-white/40 text-slate-900';

  const handleRun = () => {
    run({
      categories: category === 'all' ? ['all'] : [category],
      maxMarkets,
      riskTolerance,
      minVolume: 10000,
      maxDaysOut: 30,
    });
  };

  const currentStep = steps[steps.length - 1];
  const discoverResult = steps.find(s => s.step === 'discover' && s.status === 'complete');
  const filterResult = steps.find(s => s.step === 'filter' && s.status === 'complete');
  const forecastSteps = steps.filter(s => s.step === 'forecast');

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-6 ${cardBg} space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className={`font-medium text-lg ${textColor}`}>
            🤖 Agent Mode
          </h3>
          <p className={`text-xs ${subtleText} mt-1`}>
            Autonomous market scanning &amp; edge detection
          </p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          isRunning
            ? 'bg-green-500/20 text-green-300 animate-pulse'
            : 'bg-white/10 text-white/40'
        }`}>
          {isRunning ? 'RUNNING' : 'IDLE'}
        </div>
      </div>

      {/* Controls */}
      {!isRunning && recommendations.length === 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs ${subtleText} block mb-1`}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={`w-full rounded-lg px-3 py-2 text-sm border ${inputBg}`}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`text-xs ${subtleText} block mb-1`}>Markets to scan</label>
              <select
                value={maxMarkets}
                onChange={e => setMaxMarkets(Number(e.target.value))}
                className={`w-full rounded-lg px-3 py-2 text-sm border ${inputBg}`}
              >
                {[3, 5, 8, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={`text-xs ${subtleText} block mb-1`}>
              Risk tolerance: {(riskTolerance * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={riskTolerance}
              onChange={e => setRiskTolerance(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className={`flex justify-between text-xs ${subtleText}`}>
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
          </div>
        </div>
      )}

      {/* Run / Stop button */}
      <button
        onClick={isRunning ? stop : handleRun}
        className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
          isRunning
            ? isNight ? 'bg-red-500/20 hover:bg-red-500/30 text-red-200' : 'bg-red-100 hover:bg-red-200 text-red-900'
            : isNight ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-200' : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
        }`}
      >
        {isRunning ? '⏹ Stop Agent' : '▶ Run Agent'}
      </button>

      {/* Error */}
      {error && (
        <div className={`text-xs p-3 rounded-lg ${
          isNight ? 'bg-red-500/10 text-red-300' : 'bg-red-100 text-red-700'
        }`}>
          {error}
        </div>
      )}

      {/* Live Progress */}
      {isRunning && currentStep && (
        <div className="space-y-2">
          <StepIndicator step="discover" label="Discover" current={currentStep} isNight={isNight} result={discoverResult} />
          <StepIndicator step="filter" label="Filter" current={currentStep} isNight={isNight} result={filterResult} />
          <StepIndicator step="forecast" label="Forecast" current={currentStep} isNight={isNight} forecastSteps={forecastSteps} />
          <StepIndicator step="edge" label="Edge Detection" current={currentStep} isNight={isNight} />
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className={`text-sm font-medium ${textColor}`}>
            Recommendations ({recommendations.filter(r => r.actionable).length} actionable)
          </h4>
          {recommendations.map((rec, i) => (
            <RecommendationCard key={rec.marketID || i} rec={rec} isNight={isNight} />
          ))}
        </div>
      )}

      {/* Arbitrage Opportunities */}
      {steps.find(s => s.step === 'filter' && s.data?.arbitrageCount > 0) && (
        <div className="space-y-2 mt-4">
          <h4 className={`text-sm font-medium ${textColor}`}>
            🔄 Arbitrage Detected ({steps.find(s => s.step === 'filter')?.data?.arbitrageCount || 0})
          </h4>
          {steps.find(s => s.step === 'filter')?.data?.topArbitrage?.map((arb, i) => (
            <div key={i} className={`text-xs p-2 rounded-lg border ${
              isNight ? 'bg-purple-500/10 border-purple-400/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}>
              <div className="font-medium">{arb.polymarket.title}</div>
              <div className={`${isNight ? 'text-purple-300/70' : 'text-purple-700/70'} mt-1`}>
                {arb.arbitrage.priceDiff}% spread · {arb.similarity}% match
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, label, current, isNight, result, forecastSteps }) {
  const isActive = current?.step === step;
  const isComplete = current?.step !== step &&
    (result || (step === 'edge' && current?.step === 'edge' && current?.status === 'complete'));

  let statusIcon = '○';
  if (isComplete) statusIcon = '✓';
  else if (isActive) statusIcon = '◉';

  let detail = '';
  if (result?.data) {
    if (step === 'discover') detail = `${result.data.total} markets found`;
    if (step === 'filter') detail = `${result.data.candidates?.length || 0} candidates`;
  }
  if (step === 'forecast' && forecastSteps?.length) {
    const completed = forecastSteps.filter(s => s.status === 'complete').length;
    const total = forecastSteps.find(s => s.total)?.total || '?';
    const synthCount = forecastSteps.filter(s => s.market?.source === 'synthdata+llm').length;
    detail = `${completed}/${total} forecasted${synthCount > 0 ? ` (${synthCount} ML-backed)` : ''}`;
  }

  const subtleText = isNight ? 'text-white/40' : 'text-slate-400';
  const activeText = isNight ? 'text-blue-300' : 'text-blue-600';
  const completeText = isNight ? 'text-green-300' : 'text-green-600';

  return (
    <div className={`flex items-center gap-2 text-sm ${
      isComplete ? completeText : isActive ? activeText : subtleText
    }`}>
      <span className={isActive ? 'animate-pulse' : ''}>{statusIcon}</span>
      <span>{label}</span>
      {detail && <span className={`text-xs ${subtleText}`}>· {detail}</span>}
    </div>
  );
}

function RecommendationCard({ rec, isNight }) {
  const isActionable = rec.actionable;
  const edgeColor = rec.edge > 0 ? 'green' : 'red';
  const hasCalibrationWarning = rec.calibrationWarning;
  const isSynthBacked = rec.source === 'synthdata+llm' || rec.source === 'synthdata+path';
  const isPathDependent = rec.source === 'synthdata+path';

  return (
    <div className={`border rounded-xl p-4 ${
      isActionable
        ? isNight ? `border-${edgeColor}-400/30 bg-${edgeColor}-500/10` : `border-${edgeColor}-200 bg-${edgeColor}-50`
        : isNight ? 'border-white/10 bg-white/5' : 'border-white/20 bg-white/10'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <h5 className={`text-sm font-medium leading-tight ${isNight ? 'text-white' : 'text-slate-900'}`}>
            {rec.title}
          </h5>
          {isSynthBacked && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              isPathDependent
                ? isNight ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                : isNight ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
            }`} title={isPathDependent ? 'Path-dependent ML analysis' : 'Backed by 200+ ML models via SynthData'}>
              {isPathDependent ? '🎯 PATH' : '🤖 ML'}
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
          isActionable
            ? isNight ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-800'
            : isNight ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'
        }`}>
          {rec.direction}
        </span>
      </div>

      {/* SynthData details if available */}
      {isSynthBacked && rec.synthData && (
        <div className={`text-xs mb-2 px-2 py-1.5 rounded ${
          isNight ? 'bg-purple-500/10 text-purple-200' : 'bg-purple-50 text-purple-800'
        }`}>
          {rec.synthData.asset && (
            <div className="flex items-center justify-between">
              <span className="opacity-70">{rec.synthData.asset}</span>
              <span className="font-medium">${rec.synthData.currentPrice?.toLocaleString()}</span>
            </div>
          )}
          {rec.synthData.percentiles?.p5 && rec.synthData.percentiles?.p95 && (
            <div className="flex items-center justify-between mt-1 text-[10px]">
              <span className="opacity-70">Range:</span>
              <span>${rec.synthData.percentiles.p5.toLocaleString()} - ${rec.synthData.percentiles.p95.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {hasCalibrationWarning && (
        <div className={`text-xs px-2 py-1 rounded mb-2 ${
          isNight ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-800'
        }`}>
          ⚠️ {rec.calibrationWarning}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className={isNight ? 'text-white/50' : 'text-slate-500'}>
            {isSynthBacked ? 'ML Prob' : 'AI Prob'}
          </span>
          <div className={`font-medium ${isNight ? 'text-white' : 'text-slate-900'}`}>
            {(rec.aiProbability * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <span className={isNight ? 'text-white/50' : 'text-slate-500'}>Market</span>
          <div className={`font-medium ${isNight ? 'text-white' : 'text-slate-900'}`}>
            {(rec.marketOdds * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <span className={isNight ? 'text-white/50' : 'text-slate-500'}>Edge</span>
          <div className={`font-medium ${
            rec.edge > 0
              ? isNight ? 'text-green-300' : 'text-green-700'
              : isNight ? 'text-red-300' : 'text-red-700'
          }`}>
            {rec.edge > 0 ? '+' : ''}{(rec.edge * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {isSynthBacked && rec.synthData?.currentPrice && (
        <div className={`mt-2 pt-2 border-t text-xs grid grid-cols-2 gap-1 ${
          isNight ? 'border-white/10 text-white/50' : 'border-white/20 text-slate-500'
        }`}>
          <span>{rec.synthData.asset} ${rec.synthData.currentPrice.toLocaleString()}</span>
          {rec.synthData.percentiles?.p5 && rec.synthData.percentiles?.p95 && (
            <span>Range: ${rec.synthData.percentiles.p5.toLocaleString()}–${rec.synthData.percentiles.p95.toLocaleString()}</span>
          )}
        </div>
      )}

      {isActionable && rec.sizePct > 0 && (
        <div className={`mt-2 pt-2 border-t text-xs ${
          isNight ? 'border-white/10 text-white/60' : 'border-white/20 text-slate-600'
        }`}>
          Suggested size: {(rec.sizePct * 100).toFixed(0)}% of portfolio · {rec.platform}
        </div>
      )}

      {rec.reasoning && (
        <p className={`mt-2 text-xs leading-relaxed ${isNight ? 'text-white/50' : 'text-slate-500'}`}>
          {rec.reasoning.length > 200 ? rec.reasoning.slice(0, 200) + '…' : rec.reasoning}
        </p>
      )}
    </div>
  );
}
