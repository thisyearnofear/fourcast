/**
 * Autonomous agent loop module.
 * Contains runAgentLoop - the async generator that discovers, filters,
 * forecasts, and detects edge across prediction markets.
 */
// Server-only guard: this module reads secret env vars (VENICE_API_KEY et al).
// The .server filename convention was lost in the god-file split — enforce it here.
if (typeof window !== 'undefined') {
  throw new Error('aiAgentLoop is server-only and must not be imported from client components');
}


import OpenAI from "openai";
import { getRedisClient } from "./redisService.js";
import { polymarketService } from "./polymarketService.js";
import { kalshiService } from "./kalshiService.js";
import { synthService } from "./synthService.js";
import { brightDataService } from "./brightDataService.js";
import { MarketIntelligenceAnalyzer } from "./analysis/MarketIntelligenceAnalyzer.js";
import { arbitrageService } from "./arbitrageService.js";
import { saveForecast, wasRecentlyAnalyzed, updateForecastExecution, getAutopilotExecutionsSince } from "./db.js";
import {
  buildTradedTodaySet,
  computeSpentToday,
  shouldSkipDedup,
  shouldSkipCap,
  formatDryRunMessage,
} from "./autopilotSafety.js";
import { analyzePathDependentMarket, detectPathDependentMarket } from "./pathDependentService.js";
import { calculateKellySizing } from "../utils/kellySizing.js";

/**
 * Autonomous agent loop that discovers, filters, forecasts, and detects edge
 * across prediction markets. Yields step-by-step updates for SSE streaming.
 *
 * @param {Object} config
 * @param {string[]} [config.categories] - Market categories to scan (e.g. ['Sports', 'Politics'])
 * @param {number} [config.maxMarkets] - Max markets to forecast (default 5)
 * @param {number} [config.minVolume] - Minimum 24h volume filter (default 10000)
 * @param {number} [config.maxDaysOut] - Max days until resolution (default 30)
 * @param {number} [config.riskTolerance] - 0-1 scale for sizing (default 0.5)
 * @yields {{ step: string, status: string, data?: any, message?: string }}
 */
export async function* runAgentLoop(config = {}) {
  const {
    categories = ["all"],
    maxMarkets = 5,
    minVolume = 10000,
    maxDaysOut = 30,
    riskTolerance = 0.5,
  } = config;

  const loopTimestamp = Date.now();

  // ── Step 1: Discover markets ──────────────────────────────────────────

  yield { step: "discover", status: "running", message: "Scanning Polymarket..." };

  let polymarkets = [];
  try {
    const result = await polymarketService.getTopWeatherSensitiveMarkets(50, {
      minVolume,
      analysisType: "discovery",
    });
    polymarkets = result?.markets || [];
  } catch (err) {
    console.error("Agent loop: Polymarket discovery failed:", err.message);
  }

  yield { step: "discover", status: "running", message: "Scanning Kalshi..." };

  let kalshiMarkets = [];
  try {
    const categoryToFetch = categories.length === 1 ? categories[0] : "all";
    kalshiMarkets = await kalshiService.getMarketsByCategory(categoryToFetch, 50);
  } catch (err) {
    console.error("Agent loop: Kalshi discovery failed:", err.message);
  }

  const allMarkets = [
    ...polymarkets.map((m) => ({ ...m, platform: m.platform || "polymarket" })),
    ...kalshiMarkets.map((m) => ({ ...m, platform: m.platform || "kalshi" })),
  ];

  yield {
    step: "discover",
    status: "complete",
    data: {
      polymarket: polymarkets.length,
      kalshi: kalshiMarkets.length,
      total: allMarkets.length,
    },
  };

  // ── Step 2: Filter candidates ─────────────────────────────────────────

  yield { step: "filter", status: "running", message: "Applying filters..." };

  const now = new Date();
  let candidates = allMarkets.filter((m) => {
    // Volume filter
    const vol = m.volume24h || m.volume || 0;
    if (vol < minVolume) return false;

    // Time horizon filter
    if (m.resolutionDate) {
      const resDate = new Date(m.resolutionDate);
      const daysOut = (resDate - now) / (1000 * 60 * 60 * 24);
      if (daysOut < 0 || daysOut > maxDaysOut) return false;
    }

    // Category filter
    if (categories.length > 0 && !categories.includes("all")) {
      const mType = (m.eventType || "").toLowerCase();
      const mTitle = (m.title || "").toLowerCase();
      const match = categories.some((c) => {
        const cl = c.toLowerCase();
        return mType.includes(cl) || mTitle.includes(cl);
      });
      if (!match) return false;
    }

    // Must have odds
    if (!m.currentOdds || (m.currentOdds.yes == null && m.currentOdds.no == null)) {
      return false;
    }

    return true;
  });

  // Sort by volume descending, take top N
  candidates.sort((a, b) => (b.volume24h || b.volume || 0) - (a.volume24h || a.volume || 0));
  candidates = candidates.slice(0, maxMarkets);

  // ── Step 2.5: Detect arbitrage opportunities ──────────────────────────

  yield { step: "filter", status: "running", message: "Detecting arbitrage..." };

  const arbitrageOpportunities = arbitrageService.findSimilarMarkets(allMarkets);

  yield {
    step: "filter",
    status: "complete",
    data: {
      candidates: candidates.map((c) => ({
        marketID: c.marketID,
        title: c.title,
        platform: c.platform,
        volume: c.volume24h || c.volume || 0,
        currentOdds: c.currentOdds,
      })),
      arbitrageCount: arbitrageOpportunities.length,
      topArbitrage: arbitrageOpportunities.slice(0, 3),
    },
  };

  if (candidates.length === 0) {
    yield {
      step: "edge",
      status: "complete",
      data: { recommendations: [], message: "No candidates passed filters" },
    };
    return;
  }

  // ── Step 3: Forecast probabilities ────────────────────────────────────

  const client = new OpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: "https://api.venice.ai/api/v1",
  });

  const hasSynthData = synthService.isAvailable();
  const intelligenceAnalyzer = new MarketIntelligenceAnalyzer();
  const forecasts = [];

  // Pre-filter: Separate Synth-eligible from non-eligible markets for efficiency
  const synthEligibleMarkets = [];
  const nonSynthMarkets = [];
  
  for (const market of candidates) {
    const hasAsset = synthService.detectAsset(market.title, market.description);
    const hasRelevantCategory = synthService.isSynthRelevantCategory(market.category);
    
    if (hasAsset || hasRelevantCategory) {
      synthEligibleMarkets.push(market);
    } else {
      nonSynthMarkets.push(market);
    }
  }

  // Process Synth-eligible markets first (higher priority, better data)
  const orderedMarkets = [...synthEligibleMarkets, ...nonSynthMarkets];

  yield {
    step: "forecast",
    status: "running",
    message: `Pre-filtered: ${synthEligibleMarkets.length} Synth-eligible, ${nonSynthMarkets.length} LLM-only`,
    total: orderedMarkets.length,
  };

  for (let i = 0; i < orderedMarkets.length; i++) {
    const market = orderedMarkets[i];
    const yesPrice = market.currentOdds?.yes ?? 0.5;
    const noPrice = market.currentOdds?.no ?? 0.5;
    const isSynthEligible = synthEligibleMarkets.includes(market);

    // Skip if recently analyzed (within 6 hours)
    const recentlyAnalyzed = await wasRecentlyAnalyzed(market.marketID, 6);
    if (recentlyAnalyzed) {
      yield {
        step: "forecast",
        status: "skipped",
        market: { title: market.title, marketID: market.marketID },
        message: "Recently analyzed, skipping",
        index: i,
        total: orderedMarkets.length,
      };
      continue;
    }

    yield {
      step: "forecast",
      status: "running",
      market: { title: market.title, marketID: market.marketID },
      message: "Analyzing market...",
      index: i,
      total: orderedMarkets.length,
    };

    let aiProbability = null;
    let reasoning = null;
    let keyFactors = [];
    let confidence = "LOW";
    let forecastSource = "llm";
    let brightDataSources = [];
    let brightDataDeepResearch = null;

    // Try SynthData first for supported price/crypto assets (only if pre-filtered as eligible)
    const detectedAsset = isSynthEligible ? synthService.detectAsset(market.title, market.description) : null;
    let synthForecast = null;
    
    // Check for path-dependent market pattern (only if asset detected)
    const pathDependent = detectedAsset ? detectPathDependentMarket(market.title) : { detected: false };

    if (detectedAsset) {
      yield {
        step: "forecast",
        status: "running",
        market: { title: market.title, marketID: market.marketID },
        message: `Detected ${detectedAsset} - preparing ML analysis`,
        index: i,
        total: orderedMarkets.length,
      };
    }

    if (hasSynthData && detectedAsset) {
      try {
        // Path-dependent market detected
        if (pathDependent.detected) {
          yield {
            step: "forecast",
            status: "running",
            market: { title: market.title, marketID: market.marketID },
            message: `🎯 Path-dependent: ${detectedAsset} $${pathDependent.priceA.toLocaleString()} vs $${pathDependent.priceB.toLocaleString()}`,
            index: i,
            total: orderedMarkets.length,
          };

          const pathAnalysis = await analyzePathDependentMarket(
            detectedAsset,
            synthForecast?.currentPrice || pathDependent.priceA, // Use current price if available
            pathDependent.priceA,
            pathDependent.priceB
          );

          if (!pathAnalysis.error) {
            yield {
              step: "forecast",
              status: "running",
              market: { title: market.title, marketID: market.marketID },
              message: `Calculated path probabilities using ML percentiles`,
              index: i,
              total: orderedMarkets.length,
            };

            // Use path-dependent probabilities
            aiProbability = pathAnalysis.probabilities.touchAFirst / 100;
            confidence = pathAnalysis.confidence;
            reasoning = pathAnalysis.reasoning;
            keyFactors = [
              `Path-dependent analysis: ${pathDependent.priceA} before ${pathDependent.priceB}`,
              `Probability: ${pathAnalysis.probabilities.touchAFirst}% vs ${pathAnalysis.probabilities.touchBFirst}%`,
              `Volatility ratio: ${pathAnalysis.volatility.ratio.toFixed(2)}x`,
            ];
            forecastSource = "synthdata+path";
            
            // Skip normal Synth forecast since we have path analysis
            synthForecast = pathAnalysis;
          }
        } else {
          // Normal price forecast
          yield {
            step: "forecast",
            status: "running",
            market: { title: market.title, marketID: market.marketID },
            message: `🤖 Fetching ${detectedAsset} forecast from 200+ ML models...`,
            index: i,
            total: orderedMarkets.length,
          };

          synthForecast = await synthService.buildForecast(detectedAsset, {
            includePolymarket: market.platform === "polymarket",
          });

          if (synthForecast) {
            yield {
              step: "forecast",
              status: "running",
              market: { title: market.title, marketID: market.marketID },
              message: `Received ML percentiles - comparing vs market odds`,
              index: i,
              total: orderedMarkets.length,
            };
          }
        }
      } catch (err) {
        console.warn(`SynthData forecast failed for ${detectedAsset}:`, err.message);
      }
    }


    try {
      if (synthForecast) {
        // SynthData-powered forecast: use quantitative data + LLM for reasoning
        forecastSource = "synthdata+llm";
        confidence = synthForecast.confidence;

        // Use SynthData's up probability if available, otherwise derive from percentiles
        if (synthForecast.upProbability != null) {
          aiProbability = synthForecast.upProbability;
        }

        // If Polymarket edge data is available, use the Synth fair probability directly
        if (synthForecast.polymarketEdge) {
          const edge = Array.isArray(synthForecast.polymarketEdge)
            ? synthForecast.polymarketEdge[0]
            : synthForecast.polymarketEdge;
          if (edge?.synthFairProb != null) {
            aiProbability = edge.synthFairProb;
          }
        }

        // Build quantitative context for LLM reasoning
        const synthContext = [
          `Asset: ${detectedAsset}, Current Price: $${synthForecast.currentPrice?.toLocaleString()}`,
          `24h Percentiles: P5=$${synthForecast.percentiles.p5?.toLocaleString()}, P50=$${synthForecast.percentiles.p50?.toLocaleString()}, P95=$${synthForecast.percentiles.p95?.toLocaleString()}`,
          synthForecast.volatility.forecast ? `Forecast Volatility: ${(synthForecast.volatility.forecast * 100).toFixed(2)}%` : null,
          synthForecast.volatility.realized ? `Realized Volatility: ${(synthForecast.volatility.realized * 100).toFixed(2)}%` : null,
        ].filter(Boolean).join('\n');

        keyFactors = [
          `Ensemble ML forecast (200+ models) via SynthData`,
          `P5-P95 range: $${synthForecast.percentiles.p5?.toLocaleString()} – $${synthForecast.percentiles.p95?.toLocaleString()}`,
          synthForecast.volatility.forecast
            ? `Forecast vol ${(synthForecast.volatility.forecast * 100).toFixed(1)}% vs realized ${(synthForecast.volatility.realized * 100).toFixed(1)}%`
            : `Volatility data unavailable`,
        ];

        // LLM generates reasoning on top of quantitative data
        yield {
          step: "forecast",
          status: "running",
          market: { title: market.title, marketID: market.marketID },
          message: `Layering AI reasoning on ML data...`,
          index: i,
          total: orderedMarkets.length,
        };

        const response = await client.chat.completions.create({
          model: "llama-3.3-70b",
          messages: [
            {
              role: "system",
              content: `You are a quantitative analyst interpreting ML-generated price forecasts for prediction markets. You have been given probabilistic forecast data from an ensemble of 200+ ML models. Your job is to explain the data clearly and assess whether the market is fairly priced.

You MUST respond with ONLY valid JSON, no other text.`,
            },
            {
              role: "user",
              content: `Market: "${market.title}"
Current market odds: YES ${yesPrice}, NO ${noPrice}

QUANTITATIVE FORECAST DATA (from SynthData ensemble):
${synthContext}

ML-derived probability: ${aiProbability != null ? (aiProbability * 100).toFixed(1) + '%' : 'N/A'}
Confidence: ${confidence}

Provide a brief reasoning explaining the edge (or lack thereof) between the ML forecast and market odds.

Output ONLY valid JSON:
{ "reasoning": "...", "key_factors": ["..."] }`,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
          venice_parameters: { enable_web_search: "auto" },
        });

        let content = response.choices[0].message.content.trim();
        if (content.includes('§THINK_OPEN§')) {
          const thinkEnd = content.lastIndexOf('§THINK_CLOSE§');
          if (thinkEnd !== -1) content = content.substring(thinkEnd + 8).trim();
        }
        if (content.startsWith('```')) {
          content = content.replace(/```json\n?|\n?```/g, "").trim();
        }
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];

        const parsed = JSON.parse(content);
        reasoning = parsed.reasoning || null;
        if (Array.isArray(parsed.key_factors) && parsed.key_factors.length > 0) {
          keyFactors = [...keyFactors, ...parsed.key_factors];
        }


      } else {
        // Fallback: intelligent forecast using Bright Data (SERP API + Scraping Browser + Web Unlocker)
        yield {
          step: "forecast",
          status: "running",
          market: { title: market.title, marketID: market.marketID },
          message: brightDataService.isAvailable()
            ? `Deep scanning with Bright Data intelligence...`
            : `Analyzing market with AI reasoning...`,
          index: i,
          total: orderedMarkets.length,
        };

        let intelligenceContext = "";
        let deepResearchData = "";
        try {
          // Use MarketIntelligenceAnalyzer to gather intelligence via all Bright Data products
          const enriched = await intelligenceAnalyzer.enrichContext({
            title: market.title,
            description: market.description,
            marketID: market.marketID,
            currentOdds: market.currentOdds,
          });

          const intel = enriched.intelligenceData;

          if (!intel || intel.results.length === 0) {
            // No Bright Data configured or no results returned
            yield {
              step: "forecast",
              status: "running",
              market: { title: market.title, marketID: market.marketID },
              message: intel?.error
                ? `Bright Data SERP error (${intel.error.status}), using LLM knowledge...`
                : `Bright Data not configured, using LLM reasoning with Venice web search...`,
              index: i,
              total: orderedMarkets.length,
              data: intel?.error ? { brightDataError: intel.error.message } : {},
            };
          }

          if (intel?.error) {
            yield {
              step: "forecast",
              status: "running",
              market: { title: market.title, marketID: market.marketID },
              message: `Bright Data SERP error (${intel.error.status}), using LLM knowledge...`,
              index: i,
              total: orderedMarkets.length,
              data: { brightDataError: intel.error.message }
            };
          }

          if (intel && intel.results.length > 0) {
            intelligenceContext = intel.results.map((r, idx) =>
              `[Source ${idx + 1}]: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`
            ).join('\n\n');

            brightDataSources = intel.results.map(r => ({
              title: r.title,
              url: r.link,
              snippet: r.snippet,
              source: r.source || 'Bright Data SERP',
              rank: r.rank,
            }));

            forecastSource = intel.source || 'brightdata+llm';

            if (intel.deepResearch?.text) {
              deepResearchData = intel.deepResearch.text;
              brightDataDeepResearch = {
                title: intel.deepResearch.title,
                url: intel.deepResearch.url,
                charCount: intel.deepResearch.charCount,
                sentenceCount: intel.deepResearch.sentenceCount,
                product: intel.productsUsed?.scrapingBrowser ? 'Scraping Browser' : 'Web Unlocker',
              };

              yield {
                step: "forecast",
                status: "running",
                market: { title: market.title, marketID: market.marketID },
                message: `Deep research via ${brightDataDeepResearch.product}: ${intel.deepResearch.sentenceCount ? intel.deepResearch.sentenceCount + ' evidence sentences' : intel.deepResearch.charCount.toLocaleString() + ' chars'}. Synthesizing...`,
                index: i,
                total: orderedMarkets.length,
              };
            }

            // Emit confirmed sources AFTER research completes
            const productSummary = [
              intel.productsUsed?.serp ? 'SERP' : null,
              intel.productsUsed?.scrapingBrowser ? 'Scraping Browser' : null,
              intel.productsUsed?.webUnlocker ? 'Web Unlocker' : null,
            ].filter(Boolean).join(' + ');

            yield {
              step: "forecast",
              status: "running",
              market: { title: market.title, marketID: market.marketID },
              message: `Gathered ${intel.results.length} sources via ${productSummary}. Synthesizing with AI...`,
              index: i,
              total: orderedMarkets.length,
              data: {
                sources: brightDataSources,
                ...(brightDataDeepResearch ? { deepResearch: brightDataDeepResearch } : {}),
                productsUsed: intel.productsUsed,
              },
            };
          }
        } catch (searchErr) {
          console.warn("Bright Data research failed, falling back to basic LLM search:", searchErr.message);
          yield {
            step: "forecast",
            status: "running",
            market: { title: market.title, marketID: market.marketID },
            message: `Bright Data error, using LLM knowledge...`,
            index: i,
            total: orderedMarkets.length,
          };
        }

        const response = await client.chat.completions.create({
          model: "llama-3.3-70b",
          messages: [
            {
              role: "system",
              content: `You are a Superforecaster tasked with estimating probabilities for prediction market outcomes.

${intelligenceContext ? `You have been provided with real-time search intelligence gathered via Bright Data SERP API${deepResearchData ? ` and deep research via ${brightDataDeepResearch?.product || 'Scraping Browser'}` : ''}.` : "Use your internal knowledge and logic to estimate the probability."}

Process:
1. Analyze provided evidence (if any)
2. Consider base rates and reference classes
3. Identify asymmetric information or market mispricing
4. Synthesize into a final probability estimate

You MUST respond with ONLY valid JSON, no other text.`,
            },
            {
              role: "user",
              content: `Market: "${market.title}"
Current market odds: YES ${yesPrice}, NO ${noPrice}
Description: ${market.description || "N/A"}

${intelligenceContext ? `BRIGHT DATA SEARCH INTELLIGENCE:\n${intelligenceContext}` : ""}

${deepResearchData ? `DEEP RESEARCH EVIDENCE (Extracted from top source via ${brightDataDeepResearch?.product || 'Bright Data'}):\n${deepResearchData}` : ""}

Output ONLY valid JSON:
{ "probability": 0.XX, "reasoning": "...", "key_factors": ["..."], "confidence": "HIGH|MEDIUM|LOW" }`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
          venice_parameters: intelligenceContext ? {} : { enable_web_search: "auto" },
        });

        let content = response.choices[0].message.content.trim();
        if (content.includes("§THINK_OPEN§")) {
          const thinkEnd = content.lastIndexOf("§THINK_CLOSE§");
          if (thinkEnd !== -1) content = content.substring(thinkEnd + 8).trim();
        }
        if (content.startsWith("```")) {
          content = content.replace(/```json\n?|\n?```/g, "").trim();
        }
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];

        const parsed = JSON.parse(content);
        aiProbability = Math.max(0, Math.min(1, parseFloat(parsed.probability)));
        reasoning = parsed.reasoning || null;
        keyFactors = Array.isArray(parsed.key_factors) ? parsed.key_factors : [];
        confidence = parsed.confidence || "LOW";
      }
    } catch (err) {
      console.error(`Agent loop: Forecast failed for ${market.title}:`, err.message);
    }

    const forecast = {
      marketID: market.marketID,
      title: market.title,
      platform: market.platform,
      description: market.description,
      currentOdds: market.currentOdds,
      aiProbability,
      reasoning,
      keyFactors,
      confidence,
      source: forecastSource,
      synthData: synthForecast ? {
        asset: synthForecast.asset,
        currentPrice: synthForecast.currentPrice,
        percentiles: synthForecast.percentiles,
        polymarketEdge: synthForecast.polymarketEdge,
      } : null,
      // Bright Data provenance: sources and deep research details
      brightData: brightDataSources.length > 0 ? {
        sources: brightDataSources,
        deepResearch: brightDataDeepResearch,
        productsUsed: {
          serp: true,
          scrapingBrowser: forecastSource === 'brightdata+research',
        },
      } : null,
    };
    forecasts.push(forecast);

    // Save forecast to database for track record
    await saveForecast({
      id: `forecast-${market.marketID}-${loopTimestamp}`,
      marketID: market.marketID,
      title: market.title,
      platform: market.platform,
      aiProbability,
      marketOdds: yesPrice,
      edge: aiProbability - yesPrice,
      confidence,
      reasoning,
      keyFactors,
      source: forecastSource,
      brightDataSources: brightDataSources.length > 0 ? JSON.stringify(brightDataSources) : null,
      brightDataDeepResearch: brightDataDeepResearch ? JSON.stringify(brightDataDeepResearch) : null,
      timestamp: Math.floor(loopTimestamp / 1000),
    });

    yield {
      step: "forecast",
      status: "complete",
      market: {
        title: market.title,
        marketID: market.marketID,
        aiProbability,
        currentOdds: market.currentOdds,
        source: forecastSource,
        synthData: synthForecast ? {
          asset: synthForecast.asset,
          currentPrice: synthForecast.currentPrice,
          confidence: synthForecast.confidence,
        } : null,
      },
    };
  }

  // ── Step 4: Detect edge ───────────────────────────────────────────────

  yield { step: "edge", status: "running", message: "Calculating edges..." };

  const recommendations = forecasts
    .filter((f) => f.aiProbability != null)
    .map((f) => {
      const marketYes = f.currentOdds?.yes ?? 0.5;
      const kelly = calculateKellySizing(f.aiProbability, marketYes, riskTolerance, f.confidence, f.source || "llm");
      const absEdge = Math.abs(kelly.edge);

      // Calibration guardrail: relax threshold for SynthData-backed forecasts
      // SynthData uses 200+ ML models so large edges are more credible
      const edgeThreshold = f.source === "synthdata+llm" ? 0.4 : 0.3;
      let adjustedConfidence = f.confidence;
      if (absEdge > edgeThreshold) {
        adjustedConfidence = "LOW";
      }

      return {
        marketID: f.marketID,
        title: f.title,
        platform: f.platform,
        aiProbability: f.aiProbability,
        marketOdds: marketYes,
        edge: kelly.edge,
        absEdge,
        actionable: kelly.actionable,
        direction: kelly.direction,
        sizePct: kelly.sizePct,
        kellyPct: kelly.kellyPct,
        confidence: adjustedConfidence,
        originalConfidence: f.confidence,
        calibrationWarning: absEdge > edgeThreshold ? `Edge >${(edgeThreshold * 100).toFixed(0)}% - high uncertainty` : null,
        reasoning: f.reasoning,
        keyFactors: f.keyFactors,
        source: f.source || "llm",
        synthData: f.synthData,
      };
    })
    .sort((a, b) => b.absEdge - a.absEdge);

  // Cache results in Redis
  try {
    const redis = await getRedisClient();
    if (redis) {
      const cacheKey = `agent:loop:${loopTimestamp}`;
      await redis.setEx(
        cacheKey,
        6 * 60 * 60, // 6 hour TTL
        JSON.stringify({
          timestamp: loopTimestamp,
          config,
          recommendations,
          marketsScanned: allMarkets.length,
          candidatesFiltered: candidates.length,
        })
      );
    }
  } catch (err) {
    console.warn("Agent loop: Redis cache failed:", err.message);
  }

  yield {
    step: "edge",
    status: "complete",
    data: { recommendations },
  };

  // ── Autopilot: Execute actionable trades ──────────────────────────────
  if (config.autopilot && process.env.POLYMARKET_PRIVATE_KEY) {
    yield { step: "execute", status: "running", message: "Autopilot executing trades..." };

    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    const executedTrades = [];
    const dryRun = config.dryRun === true;
    const dailyCapPct = typeof config.dailyCapPct === "number" ? config.dailyCapPct : 0.5;

    // Load last 24h of executions for per-market dedup and daily spend cap
    const nowSec = Math.floor(Date.now() / 1000);
    let todayExecutions = [];
    try {
      const execHistory = await getAutopilotExecutionsSince(nowSec - 24 * 3600, 200);
      todayExecutions = execHistory.success ? execHistory.executions : [];
    } catch (err) {
      console.warn("Autopilot: failed to load execution history:", err.message);
    }

    const tradedToday = buildTradedTodaySet(todayExecutions);
    let spentToday = computeSpentToday(todayExecutions);

    for (const rec of recommendations) {
      if (!rec.actionable || rec.sizePct <= 0) continue;

      // Per-market 24h deduplication
      if (shouldSkipDedup(rec, tradedToday)) {
        yield {
          step: "execute",
          status: "skipped",
          market: { title: rec.title, marketID: rec.marketID },
          message: "Already traded this market in last 24h",
        };
        continue;
      }

      // Daily spend cap guard
      if (shouldSkipCap(rec, spentToday, dailyCapPct)) {
        yield {
          step: "execute",
          status: "skipped",
          market: { title: rec.title, marketID: rec.marketID },
          message: "Daily cap reached",
        };
        break;
      }

      if (dryRun) {
        yield {
          step: "execute",
          status: "running",
          market: { title: rec.title, marketID: rec.marketID },
          message: formatDryRunMessage(rec),
        };

        const execResult = {
          success: true,
          dryRun: true,
          sizePct: rec.sizePct,
          kellyPct: rec.kellyPct,
          direction: rec.direction,
        };

        executedTrades.push({ ...rec, execution: execResult });
        tradedToday.add(rec.marketID);
        spentToday += rec.sizePct;

        try {
          await updateForecastExecution(
            `forecast-${rec.marketID}-${loopTimestamp}`,
            execResult
          );
        } catch (dbErr) {
          console.warn("Autopilot: DB save failed:", dbErr.message);
        }
        continue;
      }

      yield {
        step: "execute",
        status: "running",
        market: { title: rec.title, marketID: rec.marketID },
        message: `Executing ${rec.direction} ${(rec.sizePct * 100).toFixed(1)}% at ${rec.marketOdds}`,
      };

      try {
        const result = await polymarketService.executeServerOrder(
          {
            tokenID: rec.marketID,
            price: rec.marketOdds.toString(),
            side: rec.direction === "BUY YES" ? "BUY" : "SELL",
            size: (rec.sizePct * 100).toFixed(2),
            tickSize: "0.01",
          },
          privateKey
        );

        const execResult = {
          success: result.success,
          orderID: result.orderID,
          error: result.error,
          sizePct: rec.sizePct,
          kellyPct: rec.kellyPct,
          direction: rec.direction,
        };

        if (result.success) {
          console.log(`✅ Autopilot: Executed ${rec.direction} on ${rec.title}`);
          tradedToday.add(rec.marketID);
          spentToday += rec.sizePct;
        } else {
          console.warn(`⚠️ Autopilot: Failed ${rec.direction} on ${rec.title}: ${result.error}`);
        }

        executedTrades.push({ ...rec, execution: execResult });

        // Save execution result to DB
        try {
          await updateForecastExecution(
            `forecast-${rec.marketID}-${loopTimestamp}`,
            execResult
          );
        } catch (dbErr) {
          console.warn("Autopilot: DB save failed:", dbErr.message);
        }
      } catch (execErr) {
        console.error(`Autopilot: Execution error for ${rec.title}:`, execErr.message);
        executedTrades.push({ ...rec, execution: { success: false, error: execErr.message } });
      }
    }

    yield {
      step: "execute",
      status: "complete",
      data: {
        executed: executedTrades.filter(t => t.execution?.success).length,
        failed: executedTrades.filter(t => !t.execution?.success).length,
        dryRun,
        trades: executedTrades,
      },
    };
  }
}
