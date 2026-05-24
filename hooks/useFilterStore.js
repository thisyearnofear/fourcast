'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useFilterStore = create(
  persist(
    (set) => ({
      // Markets filters
      marketsActiveTab: 'discovery',
      sportsFilters: {
        eventType: 'Soccer',
        confidence: 'all',
        includeFutures: false,
        bestEdgesOnly: true,
      },
      discoveryFilters: {
        category: 'Crypto',
        minVolume: '50000',
        confidence: 'all',
        includeFutures: false,
        platform: 'all',
      },
      selectedDateRange: 'this-week',
      discoveryDateRange: 'this-week',
      sportsMinVolume: 10000,

      // Signals filters
      signalsActiveTab: 'feed',
      signalsFilters: {
        eventId: '',
        confidence: 'all',
        oddsEfficiency: 'all',
        author: '',
        searchText: '',
      },
      signalsSortBy: 'newest',

      // Setters — accept either a value or function updater (prev => newVal)
      setMarketsActiveTab: (tab) => set({ marketsActiveTab: tab }),
      setSportsFilters: (filters) =>
        set((s) => ({
          sportsFilters: typeof filters === 'function' ? filters(s.sportsFilters) : filters,
        })),
      setDiscoveryFilters: (filters) =>
        set((s) => ({
          discoveryFilters: typeof filters === 'function' ? filters(s.discoveryFilters) : filters,
        })),
      setSelectedDateRange: (range) => set({ selectedDateRange: range }),
      setDiscoveryDateRange: (range) => set({ discoveryDateRange: range }),
      setSportsMinVolume: (vol) => set({ sportsMinVolume: vol }),
      setSignalsActiveTab: (tab) => set({ signalsActiveTab: tab }),
      setSignalsFilters: (filters) =>
        set((s) => ({
          signalsFilters: typeof filters === 'function' ? filters(s.signalsFilters) : filters,
        })),
      setSignalsSortBy: (sort) => set({ signalsSortBy: sort }),
    }),
    {
      name: 'fourcast-filter-preferences',
      partialize: (state) => ({
        marketsActiveTab: state.marketsActiveTab,
        sportsFilters: state.sportsFilters,
        discoveryFilters: state.discoveryFilters,
        selectedDateRange: state.selectedDateRange,
        discoveryDateRange: state.discoveryDateRange,
        sportsMinVolume: state.sportsMinVolume,
        signalsActiveTab: state.signalsActiveTab,
        signalsFilters: state.signalsFilters,
        signalsSortBy: state.signalsSortBy,
      }),
    }
  )
);

export default useFilterStore;
