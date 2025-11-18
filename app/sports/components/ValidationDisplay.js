'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, TrendingUp, TrendingDown, Zap } from 'lucide-react';

/**
 * ValidationDisplay - User-friendly validation feedback component
 * 
 * PRINCIPLES APPLIED:
 * - User-friendly: Clear icons, colors, and messaging
 * - Intuitive: Progressive disclosure, contextual help
 * - Performant: Minimal re-renders, optimized animations
 */

export function ValidationAlert({ validation, type = 'default', compact = false }) {
  if (!validation || (validation.valid && (!validation.warnings || validation.warnings.length === 0))) {
    return null;
  }

  const { valid, errors = [], warnings = [] } = validation;
  
  // Determine severity and styling
  const severity = !valid ? 'error' : warnings.length > 0 ? 'warning' : 'success';
  
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800', 
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    error: <XCircle className="h-4 w-4 text-red-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    success: <CheckCircle className="h-4 w-4 text-green-500" />,
    info: <Info className="h-4 w-4 text-blue-500" />
  };

  const messages = [...errors, ...warnings];
  if (messages.length === 0) return null;

  return (
    <div className={`rounded-lg border p-3 ${styles[severity]} ${compact ? 'text-sm' : ''}`}>
      <div className="flex items-start space-x-2">
        {icons[severity]}
        <div className="flex-1">
          {messages.length === 1 ? (
            <p className="font-medium">{messages[0]}</p>
          ) : (
            <div>
              <p className="font-medium mb-1">
                {!valid ? `${errors.length} issue${errors.length !== 1 ? 's' : ''} found` : 
                         `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
              </p>
              <ul className="text-sm space-y-1">
                {messages.map((message, idx) => (
                  <li key={idx} className="flex items-start space-x-1">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>{message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RiskIndicator({ riskLevel, orderCost, compact = false }) {
  if (!riskLevel) return null;

  const riskConfig = {
    LOW: { 
      color: 'text-green-600', 
      bg: 'bg-green-100', 
      icon: <CheckCircle className="h-4 w-4" />,
      label: 'Low Risk' 
    },
    MEDIUM: { 
      color: 'text-amber-600', 
      bg: 'bg-amber-100', 
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Medium Risk' 
    },
    HIGH: { 
      color: 'text-red-600', 
      bg: 'bg-red-100', 
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'High Risk' 
    },
    VERY_HIGH: { 
      color: 'text-red-700', 
      bg: 'bg-red-200', 
      icon: <Zap className="h-4 w-4" />,
      label: 'Very High Risk' 
    }
  };

  const config = riskConfig[riskLevel] || riskConfig.MEDIUM;

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full ${config.bg} ${config.color} ${compact ? 'text-sm' : ''}`}>
      {config.icon}
      <span className="font-medium">{config.label}</span>
      {orderCost && (
        <span className="text-gray-600 ml-2">
          Cost: {orderCost.total} USDC
        </span>
      )}
    </div>
  );
}

export function DataQualityIndicator({ dataQuality, compact = false }) {
  if (!dataQuality || typeof dataQuality === 'string') {
    return null; // Handle legacy string format
  }

  const { score, level, missingFields } = dataQuality;
  
  const qualityConfig = {
    EXCELLENT: { color: 'text-green-600', bg: 'bg-green-100', progress: 'bg-green-500' },
    GOOD: { color: 'text-blue-600', bg: 'bg-blue-100', progress: 'bg-blue-500' },
    FAIR: { color: 'text-amber-600', bg: 'bg-amber-100', progress: 'bg-amber-500' },
    POOR: { color: 'text-red-600', bg: 'bg-red-100', progress: 'bg-red-500' }
  };

  const config = qualityConfig[level] || qualityConfig.FAIR;

  return (
    <div className={`${compact ? 'text-sm' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-medium ${config.color}`}>
          Data Quality: {level}
        </span>
        <span className="text-gray-500 text-sm">{Math.round(score)}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${config.progress} transition-all duration-300`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      
      {missingFields && missingFields.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          Missing: {missingFields.join(', ')}
        </p>
      )}
    </div>
  );
}

export function PriceImpactWarning({ estimatedImpact, compact = false }) {
  if (!estimatedImpact || estimatedImpact < 0.005) return null; // Hide if < 0.5%

  const impactPercent = (estimatedImpact * 100).toFixed(1);
  const severity = estimatedImpact > 0.05 ? 'high' : estimatedImpact > 0.02 ? 'medium' : 'low';
  
  const severityConfig = {
    low: { color: 'text-blue-600', bg: 'bg-blue-50', icon: <Info className="h-4 w-4" /> },
    medium: { color: 'text-amber-600', bg: 'bg-amber-50', icon: <AlertTriangle className="h-4 w-4" /> },
    high: { color: 'text-red-600', bg: 'bg-red-50', icon: <TrendingDown className="h-4 w-4" /> }
  };

  const config = severityConfig[severity];

  return (
    <div className={`${config.bg} border border-gray-200 rounded-lg p-3 ${compact ? 'text-sm' : ''}`}>
      <div className="flex items-center space-x-2">
        {config.icon}
        <div className={config.color}>
          <span className="font-medium">Price Impact: {impactPercent}%</span>
          <p className="text-sm mt-1">
            Your order may move the market price due to size relative to liquidity
          </p>
        </div>
      </div>
    </div>
  );
}

export function ValidationSummary({ validation, className = '' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!validation) return null;

  const { 
    riskLevel, 
    orderCost, 
    estimatedPriceImpact, 
    weatherDataQuality, 
    marketDataQuality,
    warnings = [],
    errors = []
  } = validation;

  const hasIssues = errors.length > 0 || warnings.length > 0;
  const issueCount = errors.length + warnings.length;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Risk and Cost Summary */}
      <div className="flex items-center justify-between">
        {riskLevel && (
          <RiskIndicator riskLevel={riskLevel} orderCost={orderCost} />
        )}
        
        {hasIssues && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
          >
            <span>{issueCount} item{issueCount !== 1 ? 's' : ''} to review</span>
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        )}
      </div>

      {/* Price Impact Warning */}
      <PriceImpactWarning estimatedImpact={estimatedPriceImpact} />

      {/* Data Quality Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {weatherDataQuality && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Weather Data</h4>
            <DataQualityIndicator dataQuality={weatherDataQuality} compact />
          </div>
        )}
        
        {marketDataQuality && typeof marketDataQuality === 'object' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Market Data</h4>
            <DataQualityIndicator dataQuality={marketDataQuality} compact />
          </div>
        )}
      </div>

      {/* Detailed Issues (Expandable) */}
      {hasIssues && isExpanded && (
        <div className="space-y-2">
          {errors.length > 0 && (
            <ValidationAlert 
              validation={{ valid: false, errors }} 
              compact 
            />
          )}
          {warnings.length > 0 && (
            <ValidationAlert 
              validation={{ valid: true, warnings }} 
              compact 
            />
          )}
        </div>
      )}
    </div>
  );
}

// Inline validation hook for real-time feedback
export function useValidationFeedback(value, validator, dependencies = []) {
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!validator || !value) {
      setValidation(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsValidating(true);
      try {
        const result = await validator(value);
        setValidation(result);
      } catch (error) {
        setValidation({
          valid: false,
          errors: ['Validation failed'],
          warnings: []
        });
      } finally {
        setIsValidating(false);
      }
    }, 300); // Debounce validation

    return () => clearTimeout(timeoutId);
  }, [value, validator, ...dependencies]);

  return { validation, isValidating };
}