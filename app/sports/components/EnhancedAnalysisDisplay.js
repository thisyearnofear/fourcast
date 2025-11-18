'use client';

import React, { useState, useEffect } from 'react';
import { 
  ValidationAlert, 
  DataQualityIndicator, 
  ValidationSummary 
} from './ValidationDisplay';
import { TrendingUp, TrendingDown, Minus, MapPin, Cloud, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * EnhancedAnalysisDisplay - Analysis results with validation awareness
 * 
 * ENHANCEMENTS:
 * - Weather data quality indicators
 * - Market compatibility warnings
 * - Progressive disclosure of technical details
 * - User-friendly confidence indicators
 */

export default function EnhancedAnalysisDisplay({ 
  analysis, 
  isLoading, 
  location, 
  weatherData,
  market 
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center py-8">
          <Cloud className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No analysis available yet</p>
        </div>
      </div>
    );
  }

  const getWeatherImpactIcon = (impact) => {
    switch (impact?.toUpperCase()) {
      case 'HIGH': return <TrendingUp className="h-5 w-5 text-red-500" />;
      case 'MEDIUM': return <Minus className="h-5 w-5 text-amber-500" />;
      case 'LOW': return <TrendingDown className="h-5 w-5 text-gray-400" />;
      default: return <Minus className="h-5 w-5 text-gray-400" />;
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence?.toUpperCase()) {
      case 'HIGH': return 'text-green-600 bg-green-50';
      case 'MEDIUM': return 'text-amber-600 bg-amber-50';
      case 'LOW': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRecommendationStyle = (action) => {
    if (!action) return 'bg-gray-50 text-gray-700';
    
    const actionLower = action.toLowerCase();
    if (actionLower.includes('bet yes') || actionLower.includes('buy')) {
      return 'bg-green-50 text-green-700 border-green-200';
    } else if (actionLower.includes('bet no') || actionLower.includes('sell')) {
      return 'bg-red-50 text-red-700 border-red-200';
    } else if (actionLower.includes('avoid') || actionLower.includes('skip')) {
      return 'bg-gray-50 text-gray-700 border-gray-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const validation = analysis.validation || {};
  const hasValidationIssues = validation.warnings?.length > 0;

  return (
    <div className="space-y-6">
      {/* Validation Summary */}
      {hasValidationIssues && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Analysis Notes</span>
            </h3>
            <button
              onClick={() => setShowValidationDetails(!showValidationDetails)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              {showValidationDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>

          {/* Quick validation summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {validation.weatherDataQuality && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Weather Data Quality</h4>
                <DataQualityIndicator dataQuality={validation.weatherDataQuality} />
              </div>
            )}
            
            {validation.marketWeatherCompatible !== undefined && (
              <div className="flex items-center space-x-2">
                {validation.marketWeatherCompatible ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <span className="text-sm font-medium">
                  Weather {validation.marketWeatherCompatible ? 'Compatible' : 'Limited Impact'}
                </span>
              </div>
            )}
          </div>

          {/* Detailed validation results */}
          {showValidationDetails && validation.warnings && (
            <ValidationAlert 
              validation={{ valid: true, warnings: validation.warnings }}
            />
          )}
        </div>
      )}

      {/* Main Analysis Card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Weather Impact Analysis</h2>
              <div className="flex items-center space-x-2 mt-2 text-blue-100">
                <MapPin className="h-4 w-4" />
                <span>{location}</span>
              </div>
            </div>
            
            {/* Confidence Badge */}
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(analysis.assessment?.confidence)} bg-white`}>
              {analysis.assessment?.confidence || 'Unknown'} Confidence
            </div>
          </div>
        </div>

        {/* Analysis Content */}
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                {getWeatherImpactIcon(analysis.assessment?.weather_impact)}
                <span className="ml-2 font-semibold">
                  {analysis.assessment?.weather_impact || 'Unknown'}
                </span>
              </div>
              <p className="text-sm text-gray-600">Weather Impact</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="font-semibold text-lg mb-1">
                {analysis.assessment?.odds_efficiency || 'Unknown'}
              </div>
              <p className="text-sm text-gray-600">Market Efficiency</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="font-semibold text-lg mb-1">
                {analysis.cached ? 'Cached' : 'Live'}
              </div>
              <p className="text-sm text-gray-600">
                {analysis.source?.replace('_', ' ').toUpperCase() || 'Analysis Source'}
              </p>
            </div>
          </div>

          {/* Weather Conditions */}
          {analysis.weather_conditions && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <Cloud className="h-4 w-4 mr-2" />
                Current Conditions
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {Object.entries(analysis.weather_conditions).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="font-medium text-blue-800">
                      {value}
                    </div>
                    <div className="text-blue-600 capitalize">
                      {key.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Analysis */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Analysis</h4>
            <div className="prose prose-sm max-w-none text-gray-700">
              {analysis.reasoning || analysis.analysis || 'No detailed analysis available.'}
            </div>
          </div>

          {/* Key Factors */}
          {analysis.key_factors && analysis.key_factors.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Key Factors</h4>
              <ul className="space-y-2">
                {analysis.key_factors.map((factor, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-gray-700">{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {analysis.recommended_action && (
            <div className={`rounded-lg p-4 border ${getRecommendationStyle(analysis.recommended_action)}`}>
              <h4 className="font-semibold mb-2">Recommendation</h4>
              <p>{analysis.recommended_action}</p>
            </div>
          )}

          {/* Technical Details Toggle */}
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              <span>Technical Details</span>
              <span className={`transform transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showTechnicalDetails && (
              <div className="mt-4 space-y-4 text-sm">
                {/* Limitations */}
                {analysis.limitations && (
                  <div>
                    <h5 className="font-medium text-gray-700">Limitations</h5>
                    <p className="text-gray-600 mt-1">{analysis.limitations}</p>
                  </div>
                )}

                {/* Citations */}
                {analysis.citations && analysis.citations.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-700">Sources</h5>
                    <ul className="mt-1 space-y-1">
                      {analysis.citations.map((citation, index) => (
                        <li key={index} className="text-gray-600">
                          • {citation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Analysis Metadata */}
                <div className="bg-gray-50 rounded p-3">
                  <h5 className="font-medium text-gray-700 mb-2">Analysis Metadata</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Source:</span>
                      <span className="ml-1">{analysis.source || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Cached:</span>
                      <span className="ml-1">{analysis.cached ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Timestamp:</span>
                      <span className="ml-1">{new Date(analysis.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Web Search:</span>
                      <span className="ml-1">{analysis.web_search ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Quality Summary for Advanced Users */}
      {validation && (validation.weatherDataQuality || validation.warnings?.length > 0) && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Analysis Quality Summary</h4>
          <div className="text-xs text-gray-600 space-y-1">
            {validation.weatherDataQuality && (
              <p>
                • Weather data quality: {validation.weatherDataQuality.level} 
                ({Math.round(validation.weatherDataQuality.score)}% complete)
              </p>
            )}
            <p>
              • Market weather compatibility: {validation.marketWeatherCompatible ? 'Good' : 'Limited'}
            </p>
            {validation.warnings?.length > 0 && (
              <p>• {validation.warnings.length} consideration{validation.warnings.length !== 1 ? 's' : ''} noted</p>
            )}
            <p className="text-gray-500 mt-2">
              Higher quality data and better compatibility typically lead to more reliable analysis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}