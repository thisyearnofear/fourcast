'use client';

import React from 'react';

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
  if (!analysis) return null;

  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-slate-800/80 border-white/30' : 'bg-slate-100/90 border-black/30';
  const buttonBgColor = isNight ? 'bg-green-600/40 hover:bg-green-600/60' : 'bg-green-200/60 hover:bg-green-300/70';
  const buttonTextColor = isNight ? 'text-green-100' : 'text-green-900';

  const assessment = analysis.assessment || {};

  return (
    <div className="space-y-6">
      {/* Trade Button */}
      <button
        onClick={onTrade}
        className={`w-full py-3 rounded-lg font-light transition-all duration-200 ${buttonBgColor} ${buttonTextColor}`}
      >
        Trade This Edge
      </button>

      {/* Assessment Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${bgColor} rounded-lg p-4 text-center border`}>
          <div className="text-2xl mb-2">{getImpactIcon(assessment.weather_impact)}</div>
          <div className={`text-xs font-light ${textColor} opacity-70 mb-1`}>Impact</div>
          <div className={`text-sm ${getConfidenceColor(assessment.confidence)}`}>
            {assessment.weather_impact}
          </div>
        </div>

        <div className={`${bgColor} rounded-lg p-4 text-center border`}>
          <div className="text-2xl mb-2">
            {assessment.odds_efficiency === 'EFFICIENT' ? '✅' : '⚠️'}
          </div>
          <div className={`text-xs font-light ${textColor} opacity-70 mb-1`}>Odds</div>
          <div className={`text-sm ${getEfficiencyColor(assessment.odds_efficiency)}`}>
            {assessment.odds_efficiency}
          </div>
        </div>

        <div className={`${bgColor} rounded-lg p-4 text-center border`}>
          <div className="text-2xl mb-2">
            {assessment.confidence === 'HIGH' ? '🎯' :
             assessment.confidence === 'MEDIUM' ? '⚖️' : '❓'}
          </div>
          <div className={`text-xs font-light ${textColor} opacity-70 mb-1`}>Confidence</div>
          <div className={`text-sm ${getConfidenceColor(assessment.confidence)}`}>
            {assessment.confidence}
          </div>
        </div>
      </div>

      {/* Analysis Text */}
      <div>
        <h4 className={`text-base font-light ${textColor} opacity-90 mb-3`}>Analysis</h4>
        <p className={`text-sm ${textColor} opacity-80 leading-relaxed`}>
          {analysis.analysis}
        </p>
      </div>

      {/* Key Factors */}
      {analysis.key_factors && analysis.key_factors.length > 0 && (
        <div>
          <h4 className={`text-base font-light ${textColor} opacity-90 mb-3`}>Key Factors</h4>
          <ul className="space-y-2">
            {analysis.key_factors.map((factor, index) => (
              <li key={index} className={`text-sm ${textColor} opacity-70 flex items-start`}>
                <span className="mr-3 mt-1.5 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      {analysis.recommended_action && (
        <div className={`${bgColor} border rounded-lg p-4`}>
          <h4 className={`text-base font-light ${textColor} opacity-90 mb-2`}>Recommendation</h4>
          <p className={`text-sm ${textColor} opacity-80`}>
            {analysis.recommended_action}
          </p>
        </div>
      )}

      {/* Cached Badge */}
      {analysis.cached && (
        <div className={`text-xs text-center ${textColor} opacity-50`}>
          Cached result
        </div>
      )}

      {/* Disclaimer */}
      <div className={`text-xs ${textColor} opacity-50 text-center pt-3 border-t border-white/10`}>
        AI analysis for informational purposes only
      </div>
    </div>
  );
}
