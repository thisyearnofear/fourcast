'use client';

import React, { useState } from 'react';

const getConfidenceColor = (confidence) => {
  switch (confidence) {
    case 'HIGH': return 'text-green-400';
    case 'MEDIUM': return 'text-yellow-400';
    case 'LOW': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getImpactIcon = (impact) => {
  switch (impact) {
    case 'HIGH': return '⚠️';
    case 'MEDIUM': return '⚡';
    case 'LOW': return '✅';
    default: return '❓';
  }
};

const getEfficiencyColor = (efficiency) => {
  switch (efficiency) {
    case 'EFFICIENT': return 'text-green-400';
    case 'INEFFICIENT': return 'text-orange-400';
    default: return 'text-gray-400';
  }
};

export default function AnalysisDisplay({
  analysis,
  selectedMarket,
  isNight,
  onTrade
}) {
  const [expandDetails, setExpandDetails] = useState(false);
  
  if (!analysis) return null;

  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-slate-800/80 border-white/30' : 'bg-slate-100/90 border-black/30';
  const buttonBgColor = isNight ? 'bg-green-600/40 hover:bg-green-600/60' : 'bg-green-200/60 hover:bg-green-300/70';
  const buttonTextColor = isNight ? 'text-green-100' : 'text-green-900';
  const accentBg = isNight ? 'bg-blue-600/20 border-blue-400/40' : 'bg-blue-200/40 border-blue-400/60';
  
  const assessment = analysis.assessment || {};
  const hasCitations = Array.isArray(analysis.citations) && analysis.citations.length > 0;

  // Extract one-line summary (first sentence of analysis)
  const oneSentenceSummary = analysis.analysis
    ?.split('.')
    ?.[0]
    ?.trim() || 'Weather conditions significantly impact market pricing';

  // Estimate risk/reward based on confidence and edge score
  const confidence = assessment.confidence || 'MEDIUM';
  const isEdgeFavorable = assessment.odds_efficiency === 'INEFFICIENT' || 
                          assessment.weather_impact === 'HIGH';
  const estimatedEdge = selectedMarket?.edgeScore || 0.15; // Default 15% edge
  const riskRewardRatio = estimatedEdge ? (estimatedEdge / (1 - estimatedEdge)).toFixed(2) : 'Unknown';

  return (
    <div className="space-y-4">
      {/* Quick Trade Button */}
      <button
        onClick={onTrade}
        className={`w-full py-3 rounded-lg font-light transition-all duration-200 ${buttonBgColor} ${buttonTextColor} border border-current/30`}
      >
        Quick Trade This Edge
      </button>

      {/* One-Sentence Summary & Badges */}
      <div className={`${accentBg} border rounded-lg p-4`}>
        <p className={`text-sm ${textColor} leading-relaxed font-light`}>
          {oneSentenceSummary}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {analysis.web_search && (
            <span className={`text-[10px] px-2 py-1 rounded ${isNight ? 'bg-white/10 border border-white/20 text-white' : 'bg-black/10 border border-black/20 text-black'}`}>
              Web search enabled
            </span>
          )}
          {analysis.cached && (
            <span className={`text-[10px] px-2 py-1 rounded ${isNight ? 'bg-white/10 border border-white/20 text-white' : 'bg-black/10 border border-black/20 text-black'}`}>
              Cached result
            </span>
          )}
        </div>
      </div>

      {/* Full Reasoning (Visible by default) */}
      <div className={`${bgColor} border rounded-lg p-4`}>
        <h4 className={`text-sm font-light ${textColor} opacity-90 mb-2`}>AI Analysis</h4>
        <p className={`text-sm ${textColor} opacity-80 leading-relaxed`}>
          {analysis.analysis}
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Weather Impact */}
        <div className={`${bgColor} rounded-lg p-3 text-center border`}>
          <div className="text-xl mb-1">{getImpactIcon(assessment.weather_impact)}</div>
          <div className={`text-xs font-light ${textColor} opacity-70 mb-1`}>Weather Impact</div>
          <div className={`text-xs font-medium ${getConfidenceColor(assessment.weather_impact)}`}>
            {assessment.weather_impact || 'MEDIUM'}
          </div>
        </div>

        {/* Odds Efficiency */}
        <div className={`${bgColor} rounded-lg p-3 text-center border`}>
          <div className="text-xl mb-1">
            {assessment.odds_efficiency === 'EFFICIENT' ? '✅' : '⚠️'}
          </div>
          <div className={`text-xs font-light ${textColor} opacity-70 mb-1`}>Odds</div>
          <div className={`text-xs font-medium ${getEfficiencyColor(assessment.odds_efficiency)}`}>
            {assessment.odds_efficiency === 'EFFICIENT' ? 'Fair' : 'Mispriced'}
          </div>
        </div>

        {/* Confidence */}
        <div className={`${bgColor} rounded-lg p-3 text-center border`}>
          <div className="text-xl mb-1">
            {assessment.confidence === 'HIGH' ? '🎯' :
             assessment.confidence === 'MEDIUM' ? '⚖️' : '❓'}
          </div>
          <div className={`text-xs font-light ${textColor} opacity-70 mb-1`}>Confidence</div>
          <div className={`text-xs font-medium ${getConfidenceColor(assessment.confidence)}`}>
            {assessment.confidence || 'MEDIUM'}
          </div>
        </div>
      </div>

      {/* Odds Comparison - Risk/Reward */}
      {selectedMarket && (
        <div className={`${bgColor} border rounded-lg p-4`}>
          <div className="space-y-3">
            <div>
              <div className={`text-xs font-light ${textColor} opacity-70 mb-2`}>Market Price</div>
              <div className={`text-sm ${textColor}`}>
                Yes: <span className="font-medium">{(selectedMarket.currentOdds?.yes * 100 || 50).toFixed(1)}%</span>
                {' '} | {' '}
                No: <span className="font-medium">{(selectedMarket.currentOdds?.no * 100 || 50).toFixed(1)}%</span>
              </div>
            </div>
            {estimatedEdge > 0 && (
              <div className={`pt-2 border-t border-current/20`}>
                <div className={`text-xs font-light ${textColor} opacity-70 mb-1`}>Estimated Edge</div>
                <div className={`text-sm font-medium ${getConfidenceColor(confidence)}`}>
                  {(estimatedEdge * 100).toFixed(1)}% advantage
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Why Weather Matters - Event-Specific */}
      {analysis.key_factors && analysis.key_factors.length > 0 && (
        <div className={`${bgColor} border rounded-lg p-4`}>
          <h4 className={`text-sm font-light ${textColor} opacity-90 mb-3`}>Why Weather Matters Here</h4>
          <ul className="space-y-2">
            {analysis.key_factors.slice(0, 3).map((factor, index) => (
              <li key={index} className={`text-xs ${textColor} opacity-70 flex items-start`}>
                <span className="mr-2 mt-0.5 w-1 h-1 bg-current rounded-full flex-shrink-0"></span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      {analysis.recommended_action && (
        <div className={`border-l-2 ${isEdgeFavorable ? 'border-green-400' : 'border-yellow-400'} pl-4 py-2`}>
          <h4 className={`text-xs font-light ${textColor} opacity-70 mb-1 uppercase tracking-wide`}>Recommendation</h4>
          <p className={`text-sm ${textColor}`}>
            {analysis.recommended_action}
          </p>
        </div>
      )}

      {/* Expandable Full Analysis */}
      <button
        onClick={() => setExpandDetails(!expandDetails)}
        className={`w-full py-2 text-xs font-light ${textColor} opacity-60 hover:opacity-100 transition-opacity`}
      >
        {expandDetails ? '▼ Hide Details' : '▶ Show Full Analysis'}
      </button>

      {expandDetails && (
        <div className={`${bgColor} border rounded-lg p-4 space-y-3`}>
          <div>
            <h4 className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wide`}>Detailed Analysis</h4>
            <p className={`text-xs ${textColor} opacity-80 leading-relaxed`}>
              {analysis.analysis}
            </p>
          </div>

          {/* Citations (Deep Mode) */}
          {hasCitations && (
            <div>
              <h4 className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wide`}>Citations</h4>
              <ul className="space-y-2">
                {analysis.citations.slice(0, 4).map((c, idx) => (
                  <li key={idx} className={`text-xs ${textColor} opacity-80`}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                      {c.title || c.url}
                    </a>
                    {c.snippet && (
                      <div className={`opacity-70`}>{c.snippet}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Source & Transparency */}
          <div className={`border-t border-current/20 pt-3 mt-3`}>
            <div className={`text-xs ${textColor} opacity-50 space-y-1`}>
              <div>Model: <span className="font-mono">qwen3-235b</span></div>
              <div>Cached: {analysis.cached ? 'Yes' : 'Fresh analysis'}</div>
              <div>Timestamp: {new Date(analysis.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className={`text-xs ${textColor} opacity-40 text-center pt-2 border-t border-white/10`}>
        <p>For informational purposes only. Not financial advice.</p>
        <p className="mt-1 text-xs opacity-60"><a href="#methodology" className="underline">How we score edges</a></p>
      </div>
    </div>
  );
}
