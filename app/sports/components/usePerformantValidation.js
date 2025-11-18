'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * usePerformantValidation - Performance-optimized validation hook
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Debounced validation to prevent excessive API calls
 * - Memoized validation results with intelligent cache invalidation
 * - Batch validation for multiple fields
 * - Request cancellation for outdated validations
 * - Smart dependency tracking to avoid unnecessary re-validations
 */

export function usePerformantValidation(
  data,
  validators,
  options = {}
) {
  const {
    debounceMs = 300,
    cacheTimeout = 60000, // 1 minute cache
    enableBatching = true,
    dependencies = []
  } = options;

  const [validations, setValidations] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidated, setLastValidated] = useState(null);

  // Refs for cleanup and performance
  const timeoutRef = useRef();
  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef();

  // Memoized cache key generator
  const getCacheKey = useCallback((data, validatorKey) => {
    return `${validatorKey}-${JSON.stringify(data)}-${JSON.stringify(dependencies)}`;
  }, [dependencies]);

  // Clear expired cache entries
  const clearExpiredCache = useCallback(() => {
    const now = Date.now();
    for (const [key, entry] of cacheRef.current.entries()) {
      if (now - entry.timestamp > cacheTimeout) {
        cacheRef.current.delete(key);
      }
    }
  }, [cacheTimeout]);

  // Check cache for existing validation result
  const getCachedResult = useCallback((cacheKey) => {
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.result;
    }
    return null;
  }, [cacheTimeout]);

  // Store result in cache
  const setCachedResult = useCallback((cacheKey, result) => {
    cacheRef.current.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }, []);

  // Batch validation function
  const runValidation = useCallback(async (dataToValidate) => {
    // Cancel any in-flight validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsValidating(true);
    clearExpiredCache();

    const results = {};
    const validationPromises = [];

    // Process each validator
    for (const [validatorKey, validator] of Object.entries(validators)) {
      if (!validator || typeof validator !== 'function') continue;

      const cacheKey = getCacheKey(dataToValidate, validatorKey);
      const cachedResult = getCachedResult(cacheKey);

      if (cachedResult) {
        // Use cached result
        results[validatorKey] = cachedResult;
      } else {
        // Queue validation
        const validationPromise = (async () => {
          try {
            // Check if request was cancelled
            if (signal.aborted) return null;

            const result = await validator(dataToValidate, { signal });
            
            // Check again after async operation
            if (signal.aborted) return null;

            // Cache successful result
            setCachedResult(cacheKey, result);
            return { key: validatorKey, result };
          } catch (error) {
            if (error.name === 'AbortError') return null;
            
            console.warn(`Validation failed for ${validatorKey}:`, error);
            return { 
              key: validatorKey, 
              result: {
                valid: false,
                errors: [`Validation failed: ${error.message}`],
                warnings: []
              }
            };
          }
        })();

        validationPromises.push(validationPromise);
      }
    }

    try {
      // Wait for all validations to complete
      const validationResults = await Promise.allSettled(validationPromises);
      
      // Check if request was cancelled
      if (signal.aborted) return;

      // Process results
      validationResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          const { key, result: validationResult } = result.value;
          results[key] = validationResult;
        }
      });

      setValidations(results);
      setLastValidated(new Date());
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Batch validation error:', error);
      }
    } finally {
      setIsValidating(false);
    }
  }, [validators, getCacheKey, getCachedResult, setCachedResult, clearExpiredCache]);

  // Debounced validation effect
  useEffect(() => {
    if (!data || Object.keys(validators).length === 0) {
      setValidations({});
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      runValidation(data);
    }, debounceMs);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, runValidation, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoized aggregate results
  const aggregateValidation = useMemo(() => {
    const allResults = Object.values(validations).filter(Boolean);
    
    if (allResults.length === 0) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        hasData: false
      };
    }

    const errors = allResults.flatMap(result => result.errors || []);
    const warnings = allResults.flatMap(result => result.warnings || []);
    const isValid = allResults.every(result => result.valid);

    return {
      valid: isValid,
      errors,
      warnings,
      hasData: true,
      details: validations
    };
  }, [validations]);

  // Manual validation trigger
  const revalidate = useCallback(() => {
    if (data) {
      runValidation(data);
    }
  }, [data, runValidation]);

  // Clear cache manually
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    validations,
    aggregateValidation,
    isValidating,
    lastValidated,
    revalidate,
    clearCache
  };
}

/**
 * useLocationValidation - Specialized hook for location validation
 */
export function useLocationValidation(eventType, location, options = {}) {
  const validators = useMemo(() => ({
    location: async (data, context) => {
      if (!data.eventType || !data.location) {
        return { valid: true, errors: [], warnings: [] };
      }

      // Call location validation API
      const response = await fetch('/api/validate/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: data.eventType,
          location: data.location,
          additionalContext: options.additionalContext
        }),
        signal: context?.signal
      });

      if (!response.ok) {
        throw new Error('Location validation failed');
      }

      return await response.json();
    }
  }), [options.additionalContext]);

  return usePerformantValidation(
    { eventType, location },
    validators,
    {
      debounceMs: 500, // Slightly longer debounce for location
      cacheTimeout: 300000, // 5 minute cache for location
      ...options
    }
  );
}

/**
 * useOrderValidation - Specialized hook for order validation
 */
export function useOrderValidation(orderData, walletStatus, marketData, options = {}) {
  const validators = useMemo(() => ({
    order: async (data, context) => {
      if (!data.orderData) {
        return { valid: true, errors: [], warnings: [] };
      }

      // Call order validation API
      const response = await fetch('/api/validate/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderData: data.orderData,
          walletStatus: data.walletStatus,
          marketData: data.marketData,
          userPreferences: options.userPreferences
        }),
        signal: context?.signal
      });

      if (!response.ok) {
        throw new Error('Order validation failed');
      }

      return await response.json();
    }
  }), [options.userPreferences]);

  return usePerformantValidation(
    { orderData, walletStatus, marketData },
    validators,
    {
      debounceMs: 200, // Faster response for order validation
      cacheTimeout: 30000, // 30 second cache for orders
      dependencies: [marketData?.id, walletStatus?.balance],
      ...options
    }
  );
}

/**
 * useWeatherValidation - Specialized hook for weather data validation
 */
export function useWeatherValidation(weatherData, options = {}) {
  const validators = useMemo(() => ({
    weather: async (data, context) => {
      if (!data.weatherData) {
        return { valid: true, errors: [], warnings: [] };
      }

      // Call weather validation API
      const response = await fetch('/api/validate/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weatherData: data.weatherData,
          dataType: options.dataType || 'current',
          analysisType: options.analysisType
        }),
        signal: context?.signal
      });

      if (!response.ok) {
        throw new Error('Weather validation failed');
      }

      return await response.json();
    }
  }), [options.dataType, options.analysisType]);

  return usePerformantValidation(
    { weatherData },
    validators,
    {
      debounceMs: 100, // Fast validation for weather
      cacheTimeout: 180000, // 3 minute cache for weather
      ...options
    }
  );
}

/**
 * Utility function to create custom validation functions
 */
export function createValidator(validationFn, options = {}) {
  const { 
    name = 'custom',
    timeout = 5000,
    retries = 1 
  } = options;

  return async (data, context = {}) => {
    const { signal } = context;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Validation timeout for ${name}`)), timeout);
        });

        // Create abort promise
        const abortPromise = signal ? new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Validation cancelled')));
        }) : Promise.resolve();

        // Race validation against timeout and abort
        const result = await Promise.race([
          validationFn(data, context),
          timeoutPromise,
          abortPromise
        ]);

        return result;
      } catch (error) {
        if (attempt === retries || error.name === 'AbortError') {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  };
}