'use client';

import { useState, useEffect } from 'react';

export function useArbitrageOpportunities(initialFilters = { minSpread: 5, limit: 20 }) {
    const [opportunities, setOpportunities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState(initialFilters);

    const fetchArbitrage = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                minSpread: filters.minSpread,
                limit: filters.limit
            });

            const response = await fetch(`/api/defi/arbitrage?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setOpportunities(data.data.opportunities || []);
            } else {
                setError(data.error?.message || 'Failed to fetch arbitrage opportunities');
            }
        } catch (err) {
            console.error('Failed to fetch arbitrage:', err);
            setError('Unable to connect to arbitrage service');
        } finally {
            setIsLoading(false);
        }
    };

    // Re-fetch when filters change
    useEffect(() => {
        fetchArbitrage();
    }, [filters]);

    const setMinSpread = (spread) => {
        setFilters(prev => ({ ...prev, minSpread: spread }));
    };

    return {
        opportunities,
        isLoading,
        error,
        filters,
        setMinSpread,
        refresh: fetchArbitrage
    };
}
