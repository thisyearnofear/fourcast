'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Loader } from 'lucide-react';

/**
 * ValidationStatusBar - Global validation status indicator
 * 
 * Shows overall system validation status across:
 * - Location validation
 * - Weather data quality  
 * - Market compatibility
 * - Trading readiness
 */

export default function ValidationStatusBar({ 
  locationValidation,
  weatherValidation,
  marketValidation,
  tradingValidation,
  isValidating = false
}) {
  const validations = [
    { 
      name: 'Location', 
      validation: locationValidation, 
      description: 'Location is appropriate for selected market type' 
    },
    { 
      name: 'Weather Data', 
      validation: weatherValidation, 
      description: 'Weather data is complete and up-to-date' 
    },
    { 
      name: 'Market Data', 
      validation: marketValidation, 
      description: 'Market data is valid and tradeable' 
    },
    { 
      name: 'Trading', 
      validation: tradingValidation, 
      description: 'Ready to place orders' 
    }
  ].filter(v => v.validation !== undefined);

  if (validations.length === 0 && !isValidating) {
    return null;
  }

  const getOverallStatus = () => {
    if (isValidating) return 'validating';
    
    const hasErrors = validations.some(v => v.validation && !v.validation.valid);
    const hasWarnings = validations.some(v => 
      v.validation && v.validation.valid && v.validation.warnings?.length > 0
    );
    
    if (hasErrors) return 'error';
    if (hasWarnings) return 'warning';
    return 'success';
  };

  const status = getOverallStatus();

  const statusConfig = {
    validating: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: <Loader className="h-4 w-4 animate-spin" />
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200', 
      text: 'text-green-800',
      icon: <CheckCircle className="h-4 w-4" />
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800', 
      icon: <AlertTriangle className="h-4 w-4" />
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: <XCircle className="h-4 w-4" />
    }
  };

  const config = statusConfig[status];

  return (
    <div className={`rounded-lg border p-3 ${config.bg} ${config.border} ${config.text}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {config.icon}
          <span className="font-medium">
            {isValidating ? 'Validating...' :
             status === 'success' ? 'All systems ready' :
             status === 'warning' ? 'Ready with notes' :
             'Issues detected'}
          </span>
        </div>
        
        {!isValidating && (
          <div className="flex items-center space-x-2">
            {validations.map(({ name, validation }) => (
              <ValidationIndicator 
                key={name}
                name={name}
                validation={validation}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* Detailed status when issues exist */}
      {status === 'error' && (
        <div className="mt-2 text-sm">
          {validations
            .filter(v => v.validation && !v.validation.valid)
            .map(({ name, validation }) => (
              <div key={name} className="flex items-start space-x-1">
                <span>•</span>
                <span>{name}: {validation.errors?.[0]}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

function ValidationIndicator({ name, validation, compact = false }) {
  if (!validation) {
    return (
      <div className={`inline-flex items-center space-x-1 ${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>
        <div className="w-2 h-2 bg-gray-300 rounded-full" />
        <span>{name}</span>
      </div>
    );
  }

  const hasErrors = !validation.valid;
  const hasWarnings = validation.valid && validation.warnings?.length > 0;

  let color, icon;
  if (hasErrors) {
    color = 'text-red-600';
    icon = <div className="w-2 h-2 bg-red-500 rounded-full" />;
  } else if (hasWarnings) {
    color = 'text-amber-600';
    icon = <div className="w-2 h-2 bg-amber-500 rounded-full" />;
  } else {
    color = 'text-green-600';
    icon = <div className="w-2 h-2 bg-green-500 rounded-full" />;
  }

  return (
    <div className={`inline-flex items-center space-x-1 ${compact ? 'text-xs' : 'text-sm'} ${color}`}>
      {icon}
      <span>{name}</span>
    </div>
  );
}