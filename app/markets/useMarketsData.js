'use client';

import { useMemo } from 'react';
import { requestStreamingAnalysis } from './useAnalysisStream';

/**
 * Markets data + analysis pipeline — extracted from app/markets/page.js.
 *
 * This hook returns the three callbacks the page uses to (1) fetch a list
 * of markets, (2) run a one-shot analysis against the current selections,
 * and (3) run an analysis whose options came from the AnalysisConfigModal.
 *
 * All callers pass their state in via `config`; the hook returns memoised
 * callbacks that close over that config. State ownership stays in the page
 * so the deep JSX (which calls `setError`, `setShowPricing`, etc.) doesn't
 * need to change.
 */
export function useMarketsData({
 // Page state the callbacks read
 activeTab,
 sportsFilters,
 selectedDateRange,
 sportsMinVolume,
 discoveryFilters,
 discoveryDateRange,
 analysisOptions,
 analysisMode,
 pendingMarket,
 // Page setters the callbacks call
 setMarkets,
 setSelectedMarket,
 setError,
 setIsLoadingMarkets,
 setIsLoadingAnalysis,
 setAnalysis,
 setAnalysisStage,
 setExpandedMarketId,
 setShowPricing,
 setShowConfigModal,
 setPendingMarket,
 setFreeAnalysesUsed,
 // External hook values
 addToast,
 }) {
 return useMemo(
 () => ({
 fetchMarkets: async () => {
 setIsLoadingMarkets(true);
 setMarkets(null);
 setError(null);

 try {
 const isSportsMode = activeTab === 'sports';

 // Calculate max days based on selected date range
 let maxDaysToResolution = 7;
 let dateRange = selectedDateRange;

 if (isSportsMode) {
 if (dateRange === 'today') maxDaysToResolution = 1;
 else if (dateRange === 'tomorrow') maxDaysToResolution = 2;
 else if (dateRange === 'this-week') maxDaysToResolution = 7;
 else if (dateRange === 'later') maxDaysToResolution = 60;
 } else {
 dateRange = discoveryDateRange;
 if (dateRange === 'today') maxDaysToResolution = 1;
 else if (dateRange === 'tomorrow') maxDaysToResolution = 2;
 else if (dateRange === 'this-week') maxDaysToResolution = 7;
 else if (dateRange === 'later') maxDaysToResolution = 60;
 }

 const requestBody = isSportsMode
 ? {
 weatherData: null,
 location: null,
 eventType: sportsFilters.eventType,
 confidence: sportsFilters.confidence,
 limitCount: 50,
 maxDaysToResolution: maxDaysToResolution,
 minVolume: sportsMinVolume,
 analysisType: 'event-weather',
 theme: sportsFilters.eventType === 'Sports' ? 'sports' : undefined,
 dateRange: selectedDateRange,
 excludeFutures: !sportsFilters.includeFutures,
 }
 : {
 location: null,
 eventType:
 discoveryFilters.category === 'all'
 ? 'all'
 : discoveryFilters.category,
 confidence: discoveryFilters.confidence,
 limitCount: 50,
 maxDaysToResolution: maxDaysToResolution,
 theme: 'all',
 minVolume: parseInt(discoveryFilters.minVolume),
 analysisType: 'discovery',
 weatherData: null,
 dateRange: discoveryDateRange,
 excludeFutures: !discoveryFilters.includeFutures,
 searchText: discoveryFilters.searchText || null,
 };

 const response = await fetch('/api/markets', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(requestBody),
 });

 if (!response.ok) {
 const errorText = await response.text();
 console.error('[Markets Page] API error response:', errorText);
 throw new Error(`API error: ${response.status}`);
 }

 const result = await response.json();

 if (result.success) {
 if (Array.isArray(result.markets) && result.markets.length > 0) {
 setMarkets(result.markets);
 setSelectedMarket(result.markets[0]);
 } else {
 setMarkets([]);
 setError(
 result.message || 'No markets found. Try adjusting filters.'
 );
 }
 } else {
 console.error(
 '[Markets Page] API returned success=false:',
 result.error
 );
 setError(result.error || 'Failed to fetch markets');
 }
 } catch (err) {
 console.error('[Markets Page] Market fetch failed:', err);
 setError('Unable to fetch markets: ' + err.message);
 } finally {
 setIsLoadingMarkets(false);
 }
 },

 analyzeMarket: async (market, mode = analysisMode) => {
 if (!market) return;
 setIsLoadingAnalysis(true);
 setError(null);
 setAnalysis(null);
 setAnalysisStage(0);
 setSelectedMarket(market);
 setExpandedMarketId(market.marketID || market.id || market.tokenID);

 try {
 const data = await requestStreamingAnalysis(
 {
 eventType: market.eventType || market.title || 'Market',
 title: market.title || market.question,
 location: market.location || market.eventLocation || '',
 weatherData: null,
 currentOdds:
 market.currentOdds ||
 (market.bid !== undefined && market.ask !== undefined
 ? { yes: Number(market.ask), no: Number(market.bid) }
 : null),
 participants: market.teams || [],
 marketID: market.marketID || market.id || market.tokenID,
 eventDate: market.resolutionDate || market.expiresAt || null,
 mode,
 // Analysis factor toggles from user preferences
 includeWeather: analysisOptions.includeWeather,
 includeSynthData: analysisOptions.includeSynthData,
 includeFutures: analysisOptions.includeFutures,
 webSearchEnabled: analysisOptions.webSearchEnabled,
 analysisTypes: analysisOptions.analysisTypes || [],
 },
 setAnalysisStage
 );

 if (data.success) {
 setAnalysis(data);
 // Track free analysis usage
 const used = parseInt(localStorage.getItem('fourcast_free_analyses') || '0', 10) + 1;
 localStorage.setItem('fourcast_free_analyses', String(used));
 setFreeAnalysesUsed(used);

 // Show upsell toast after 2 free analyses
 if (used === 2) {
 addToast(
 'Free analysis used 2/3. One more left — then upgrade for unlimited access.',
 'info',
 6000
 );
 }
 if (used === 3) {
 addToast(
 "You've used all free analyses. Upgrade to Pro for unlimited AI analysis.",
 'info',
 8000
 );
 }
 } else {
 // Check if rate limited (429)
 if (data.status === 429) {
 setShowPricing(true);
 setError("You've used your free analyses. Upgrade to Pro for unlimited AI analysis.");
 } else {
 setError(data.error || 'Analysis failed');
 }
 }
 } catch (err) {
 console.error('Analysis failed:', err);
 if (err.status === 429) setShowPricing(true);
 setError('Failed to analyze market');
 } finally {
 setIsLoadingAnalysis(false);
 }
 },

 openAnalyzeConfig: (market) => {
 setPendingMarket(market);
 setShowConfigModal(true);
 },

 analyzeMarketWithConfig: async (config) => {
 if (!pendingMarket) return;

 const market = pendingMarket;
 setShowConfigModal(false);
 setIsLoadingAnalysis(true);
 setError(null);
 setAnalysis(null);
 setAnalysisStage(0);
 setSelectedMarket(market);
 setExpandedMarketId(market.marketID || market.id || market.tokenID);

 try {
 const requestBody = {
 eventType: market.eventType || market.title || 'Market',
 title: market.title || market.question,
 location: market.location || market.eventLocation || '',
 weatherData: null,
 currentOdds:
 market.currentOdds ||
 (market.bid !== undefined && market.ask !== undefined
 ? { yes: Number(market.ask), no: Number(market.bid) }
 : null),
 participants: market.teams || [],
 marketID: market.marketID || market.id || market.tokenID,
 eventDate: market.resolutionDate || market.expiresAt || null,
 // Map modal's 'quick/standard/deep' to API's 'basic/detailed/deep'
 mode:
 (config.depth === 'quick'
 ? 'basic'
 : config.depth === 'standard'
 ? 'detailed'
 : config.depth) || analysisMode,
 // Config from modal
 includeWeather: config.includeWeather,
 includeSynthData: config.includeSynthData,
 includeFutures: config.includeFutures,
 webSearchEnabled: config.includeWebSearch,
 analysisTypes: [
 ...(config.includeFundamental ? ['fundamental'] : []),
 ...(config.includeTechnical ? ['technical'] : []),
 ...(config.includeSentiment ? ['sentiment'] : []),
 ],
 // Provider preferences
 aiProvider: config.providers?.aiProvider,
 weatherProvider: config.providers?.weatherProvider,
 marketDataProvider: config.providers?.marketDataProvider,
 };

 const data = await requestStreamingAnalysis(requestBody, setAnalysisStage);

 if (data.success) {
 setAnalysis(data);
 const used = parseInt(localStorage.getItem('fourcast_free_analyses') || '0', 10) + 1;
 localStorage.setItem('fourcast_free_analyses', String(used));
 setFreeAnalysesUsed(used);
 if (used === 2) {
 addToast(
 'Free analysis used 2/3. One more left — then upgrade for unlimited access.',
 'info',
 6000
 );
 }
 if (used === 3) {
 addToast(
 "You've used all free analyses. Upgrade to Pro for unlimited AI analysis.",
 'info',
 8000
 );
 }
 } else {
 if (data.status === 429) {
 setShowPricing(true);
 setError("You've used your free analyses. Upgrade to Pro for unlimited AI analysis.");
 } else {
 setError(data.error || 'Analysis failed');
 }
 }
 } catch (err) {
 console.error('Analysis failed:', err);
 if (err.status === 429) setShowPricing(true);
 setError('Failed to analyze market');
 } finally {
 setIsLoadingAnalysis(false);
 setPendingMarket(null);
 }
 },
 }),
 [
 activeTab,
 sportsFilters,
 selectedDateRange,
 sportsMinVolume,
 discoveryFilters,
 discoveryDateRange,
 analysisOptions,
 analysisMode,
 pendingMarket,
 setMarkets,
 setSelectedMarket,
 setError,
 setIsLoadingMarkets,
 setIsLoadingAnalysis,
 setAnalysis,
 setAnalysisStage,
 setExpandedMarketId,
 setShowPricing,
 setShowConfigModal,
 setPendingMarket,
 setFreeAnalysesUsed,
 addToast,
 ]
 );
}
