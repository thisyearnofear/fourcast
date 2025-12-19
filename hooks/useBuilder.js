/**
 * useBuilder Hook - Consolidated builder program integration for UI
 * Provides builder stats, volume tracking, and leaderboard position
 * Single hook for all builder-related UI needs
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { builderService } from '@/services/builderService';

export function useBuilder() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [relayerConfig, setRelayerConfig] = useState(null);

  // Check if builder is configured
  const isConfigured = builderService.isConfigured();

  // Fetch stats on mount
  useEffect(() => {
    if (!isConfigured) {
      setStats({ configured: false });
      return;
    }

    fetchStats();
  }, [isConfigured]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [builderStats, relayer] = await Promise.all([
        builderService.getBuilderStats(),
        Promise.resolve(builderService.getRelayerConfig())
      ]);

      setStats(builderStats);
      setRelayerConfig(relayer);
    } catch (err) {
      console.error('Failed to fetch builder stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh stats (manual trigger)
  const refresh = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    isConfigured,
    relayerConfig,
    refresh,
    service: builderService
  };
}
