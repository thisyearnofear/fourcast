/**
 * AI Service (server-only) — facade re-exporting all sub-modules.
 *
 * This file was previously a 1,781-line god-file. It has been decomposed into:
 *   - aiVeniceClient.js     — Venice AI API client + shared constants/helpers
 *   - aiEventMetadata.js    — Event location verification + metadata extraction
 *   - aiWeatherAnalysis.js  — Single-market weather impact analysis
 *   - aiAgentLoop.js        — Autonomous agent loop (async generator)
 *   - aiStatus.js           — AI service status/availability
 *
 * Import this only in API routes (server-side). Consumers should not change:
 *   import { analyzeWeatherImpactServer, getAIStatus } from '@/services/aiService.server'
 *   import { runAgentLoop } from '@/services/aiService.server'
 */

export { analyzeWeatherImpactServer } from './aiWeatherAnalysis.js'
export { runAgentLoop } from './aiAgentLoop.js'
export { getAIStatus } from './aiStatus.js'

