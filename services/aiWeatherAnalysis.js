/**
 * Weather impact analysis module.
 * Contains analyzeWeatherImpactServer - the main single-market analysis function.
 */

import { getRedisClient } from "./redisService.js";
import { LocationValidator } from "./locationValidator.js";
import { polymarketService } from "./polymarketService.js";
import { kalshiService } from "./kalshiService.js";
import { VenueExtractor } from "./venueExtractor.js";
import { synthService } from "./synthService.js";
import { weatherService } from "./weatherService.js";
import {
  callVeniceAI,
  isWeatherSensitiveCategory,
  detectEventTypeFromTitle,
} from "./aiVeniceClient.js";
import {
  verifyEventLocation,
  extractEventMetadataViaVenice,
} from "./aiEventMetadata.js";

export async function analyzeWeatherImpactServer(params) {
  let {
    eventType,
    location,
    weatherData,
    currentOdds,
    participants,
    marketId,
    eventDate,
    title,
    isFuturesBet,
    mode = "basic",
    analysisTypes = [], // Finance analysis types: fundamental, technical, sentiment
    includeThinking = false,
    brightDataContext = null, // Bright Data web intelligence from MarketIntelligenceAnalyzer
  } = params;

  // Auto-detect event type from title if not provided
  if (!eventType && title) {
    const detected = detectEventTypeFromTitle(title);
    if (detected) {
      console.log(`🔍 Auto-detected eventType: ${detected} from title: "${title.substring(0, 50)}..."`);
      eventType = detected;
    }
  }

  try {
    // Check for futures bets FIRST
    if (isFuturesBet) {
      console.log("🎯 Futures bet detected, skipping weather analysis");
      return {
        assessment: {
          weather_impact: "N/A",
          odds_efficiency: "UNKNOWN",
          confidence: "LOW",
        },
        analysis: `This is a futures bet for ${
          title || "a championship market"
        }. Weather analysis isn't applicable since the event won't be decided until the season plays out. The current odds reflect team strength, injuries, and schedule difficulty rather than weather conditions.`,
        key_factors: [
          "Futures bets cannot be analyzed based on current weather",
          "Championship location and weather unknown until event is scheduled",
          "Season-long performance depends on many games in varying conditions",
        ],
        recommended_action: `Focus on team fundamentals - This is a futures bet where weather won't impact the outcome. Research team performance metrics, schedule difficulty, and injury reports instead.`,
        citations: [],
        limitations: "Weather analysis not applicable to futures bets",
        cached: false,
        source: "futures_bypass",
      };
    }

    // Check if this market type is weather-sensitive
    const isWeatherMarket = isWeatherSensitiveCategory(eventType);
    if (!isWeatherMarket) {
      console.log(`📊 Non-weather market detected (${eventType}), proceeding with financial/political analysis`);
      // For non-weather markets (finance, stocks, crypto, politics, etc.), skip venue resolution and weather data
      // The callVeniceAI function will handle these markets with appropriate prompts
      weatherData = null;
      location = null;
    }

    // For finance/stock markets, try to get SynthData to inform the analysis
    let synthData = null;
    let synthContext = null;
    if (!isWeatherMarket && synthService.isAvailable()) {
      try {
        const detectedAsset = synthService.detectAsset(title, title);
        if (detectedAsset) {
          console.log(`🎯 Detected asset for single-market analysis: ${detectedAsset}`);
          const synthForecast = await synthService.buildForecast(detectedAsset, {
            includePolymarket: true,
          });
          
          if (synthForecast) {
            synthData = {
              asset: synthForecast.asset,
              currentPrice: synthForecast.currentPrice,
              percentiles: synthForecast.percentiles,
              polymarketEdge: synthForecast.polymarketEdge,
              confidence: synthForecast.confidence,
            };
            
            // Build context for LLM to incorporate synth data into reasoning
            const edge = synthForecast.polymarketEdge;
            const edgeInfo = edge ? `
- Polymarket Edge: ${Math.abs(edge.edge * 100).toFixed(1)}% ${edge.edge > 0 ? 'UNDERPRICED (YES value)' : 'OVERPRICED (YES overvalued)'}
- Synth Fair Probability: ${(edge.synthFairProb * 100).toFixed(1)}%
- Market Probability: ${(edge.polymarketProb * 100).toFixed(1)}%
` : '';
            
            synthContext = `
📊 SYNTHDATA MARKET INTELLIGENCE:
- Current ${synthForecast.asset} Price: $${synthForecast.currentPrice?.toLocaleString()}
- 24h Price Range (P5-P95): $${synthForecast.percentiles?.p5?.toLocaleString()} - $${synthForecast.percentiles?.p95?.toLocaleString()}
- P50 (Median): $${synthForecast.percentiles?.p50?.toLocaleString()}
- ML Confidence: ${synthForecast.confidence}
${edgeInfo}
`;
          }
        }
      } catch (err) {
        console.warn(`SynthData fetch failed for single-market analysis:`, err.message);
      }
    }

    // Build Bright Data intelligence context for the LLM prompt
    let brightDataContextStr = null;
    if (brightDataContext && brightDataContext.results.length > 0) {
      const sources = brightDataContext.results.map((r, i) =>
        `[${i + 1}] ${r.title}\nSource: ${r.source || 'Unknown'}\nURL: ${r.link}\nSnippet: ${r.snippet}`
      ).join('\n\n');

      const deepPart = brightDataContext.deepResearch?.text
        ? `\n\nDEEP RESEARCH (${brightDataContext.deepResearch.charCount?.toLocaleString()} chars via ${brightDataContext.deepResearchProduct || 'Scraping Browser'}):\n${brightDataContext.deepResearch.text.substring(0, 4000)}`
        : '';

      brightDataContextStr = `
🌐 BRIGHT DATA WEB INTELLIGENCE (live search results):
${sources}
${deepPart}

Use this live web intelligence as the PRIMARY source for your analysis. These are real-time search results gathered moments ago.`;
    }

    const deriveProvider = (id) => {
      if (!id) return "polymarket";
      if (typeof id === "string") {
        const hasLetter = /[A-Za-z]/.test(id);
        const isDigits = /^\d+$/.test(id);
        if (hasLetter) return "kalshi";
        if (isDigits) return "polymarket";
        return "polymarket";
      }
      if (typeof id === "number") return "polymarket";
      return "polymarket";
    };

    const resolveVenueFromProvider = async (id, titleText) => {
      const provider = deriveProvider(id);
      if (provider === "polymarket" && id) {
        const details = await polymarketService.getMarketDetails(id);
        if (details) {
          const v =
            VenueExtractor.extractFromMarket(details) ||
            VenueExtractor.extractFromTitle(details.title || details.question);
          if (VenueExtractor.isValidVenue(v)) return v;
        }
      }
      if (provider === "kalshi" && id) {
        const v = kalshiService.deriveLocation(String(id), titleText || "");
        if (v && !VenueExtractor.isSuspiciousLocation(v) && v !== "USA")
          return v;
      }
      return null;
    };

    let effectiveLocation = null;
    try {
      effectiveLocation = await resolveVenueFromProvider(marketId, title);
      if (!effectiveLocation) {
        const fallback = VenueExtractor.extractFromMarket({
          title,
          description: title,
          teams: participants,
          eventType,
        });
        if (VenueExtractor.isValidVenue(fallback)) effectiveLocation = fallback;
      }
    } catch (e) {
      console.warn("Venue resolution from provider failed:", e?.message || e);
    }

    let correctedLocation = null;
    let correctedWeather = null;

    // Phase 1: Extract fixture metadata via web search
    let fixtureMeta = null;
    try {
      fixtureMeta = await extractEventMetadataViaVenice(title);
      if (fixtureMeta) {
        // Update participants if present
        const teams = [];
        if (fixtureMeta.home_team) teams.push(fixtureMeta.home_team);
        if (fixtureMeta.away_team) teams.push(fixtureMeta.away_team);
        if (teams.length > 0) participants = teams;

        // Update event date if provided
        if (fixtureMeta.kickoff_local) {
          eventDate = fixtureMeta.kickoff_local.split("T")[0];
        }

        // Derive effective location from city/country when venue name present
        const cityCountry = [fixtureMeta.city, fixtureMeta.country]
          .filter(Boolean)
          .join(", ");
        if (cityCountry && VenueExtractor.isValidVenue(cityCountry)) {
          effectiveLocation = cityCountry;
        }
      }
    } catch (e) {
      console.warn("Fixture metadata step failed:", e?.message || e);
    }

    const initialValidation = LocationValidator.validateLocation(
      eventType,
      effectiveLocation || location,
      { title }
    );
    
    // Only fetch weather for weather-sensitive markets
    if (isWeatherMarket && (!effectiveLocation || initialValidation.warning)) {
      const inferred = await verifyEventLocation(title, eventType);
      if (inferred) {
        try {
          const newWeather = await weatherService.getCurrentWeather(inferred);
          location = { name: inferred };
          weatherData = newWeather;
          correctedLocation = inferred;
          correctedWeather = true;
        } catch (e) {
          console.warn(
            "Weather fetch for inferred location failed:",
            e?.message || e
          );
        }
      }
    }

    // Only fetch weather for weather-sensitive markets that don't already have it
    if (isWeatherMarket && !correctedLocation && effectiveLocation && !weatherData) {
      try {
        const newWeather = await weatherService.getCurrentWeather(
          effectiveLocation
        );
        location = { name: effectiveLocation };
        weatherData = newWeather;
      } catch (e) {
        console.warn(
          "Weather fetch for effective location failed:",
          e?.message || e
        );
      }
    }

    // For weather-sensitive markets, venue is required. For others, skip this check.
    if (isWeatherMarket && !location) {
      return {
        assessment: {
          weather_impact: "UNKNOWN",
          odds_efficiency: "UNKNOWN",
          confidence: "LOW",
        },
        analysis:
          "Unable to determine event venue from provider or web search. Analysis skipped.",
        key_factors: ["Venue resolution failed"],
        recommended_action: "Verify game venue and retry",
        cached: false,
        source: "venue_missing",
      };
    }

    // For non-weather markets (finance, crypto, politics), set placeholder values for location
    if (!isWeatherMarket) {
      location = location || { name: "N/A (Non-weather market)" };
    }

    const apiKey = process.env.VENICE_API_KEY;
    console.log(
      "Venice API Key available:",
      !!apiKey,
      "length:",
      apiKey?.length
    );

    let redis = null;
    const cacheKey = `analysis:${marketId}`;

    // Server-side Redis caching
    redis = await getRedisClient();
    if (redis) {
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        const parsed = JSON.parse(cachedResult);
        return {
          ...parsed,
          cached: true,
          source: "redis",
        };
      }
    }

    // Call Venice AI API if key is available
    if (!apiKey) {
      return {
        assessment: {
          weather_impact: "UNKNOWN",
          odds_efficiency: "UNKNOWN",
          confidence: "LOW",
        },
        analysis: "AI service unavailable - no API key configured",
        key_factors: ["API service not configured"],
        recommended_action: "Configure VENICE_API_KEY in environment",
        weather_conditions: {
          location: location.name || location,
          temperature: `${
            weatherData?.current?.temp_f ||
            weatherData?.forecast?.forecastday?.[0]?.day?.avgtemp_f ||
            "N/A"
          }°F`,
          condition:
            weatherData?.current?.condition?.text ||
            weatherData?.forecast?.forecastday?.[0]?.day?.condition?.text ||
            "Unknown",
          precipitation: `${
            weatherData?.current?.precip_chance ||
            weatherData?.forecast?.forecastday?.[0]?.day
              ?.daily_chance_of_rain ||
            "0"
          }%`,
          wind: `${
            weatherData?.current?.wind_mph ||
            weatherData?.forecast?.forecastday?.[0]?.day?.maxwind_mph ||
            "0"
          } mph`,
        },
        cached: false,
        source: "unavailable",
      };
    }

    // Derive participants/event type from title if missing
    let resolvedParticipants = Array.isArray(participants) ? participants : [];
    try {
      if (!resolvedParticipants || resolvedParticipants.length === 0) {
        const meta = polymarketService.extractMarketMetadata(title || "", []);
        if (Array.isArray(meta?.teams)) {
          resolvedParticipants = meta.teams;
        }
        if (!eventType && meta?.event_type) {
          eventType = meta.event_type;
        }
      }
    } catch (e) {
      console.warn("Metadata extraction failed:", e?.message || e);
    }

    let analysis;
    try {
      analysis = await callVeniceAI(
        {
          eventType,
          location,
          weatherData,
          currentOdds,
          participants: Array.isArray(resolvedParticipants)
            ? resolvedParticipants.map((p) =>
                typeof p === "string" ? p : String(p)
              )
            : [],
          title,
          eventDate,
          isFuturesBet,
          analysisTypes, // Finance/stock analysis types
          synthContext: [synthContext, brightDataContextStr].filter(Boolean).join('\n\n') || null,
        },
        {
          webSearch: !brightDataContext, // Skip Venice web search if Bright Data already provided intelligence
          showThinking: false,
          includeThinking: includeThinking,
        }
      );
    } catch (primaryError) {
      // One retry with explicit web search
      try {
        analysis = await callVeniceAI(
          {
            eventType,
            location,
            weatherData,
            currentOdds,
            participants: Array.isArray(resolvedParticipants)
              ? resolvedParticipants.map((p) =>
                  typeof p === "string" ? p : String(p)
                )
              : [],
            title,
            eventDate,
            isFuturesBet,
            analysisTypes, // Finance/stock analysis types
            synthContext, // Include SynthData context for finance markets
          },
          {
            webSearch: true,
            showThinking: false,
            includeThinking: includeThinking,
          }
        );
      } catch (secondaryError) {
        throw primaryError; // preserve original
      }
    }


    // If we corrected the location, append a note to the analysis
    if (correctedLocation) {
      analysis.analysis += `\n\n(Note: Analysis automatically corrected location from "${
        params.location?.name || params.location
      }" to "${correctedLocation}" based on event details.)`;
    }

    // Cache result with roadmap-aligned TTL (6 hours for distant events, 1 hour for near events)
    const baseTtl =
      eventDate && new Date(eventDate) - new Date() < 24 * 60 * 60 * 1000
        ? 3600
        : 21600; // 1h or 6h
    const ttl = mode === "deep" ? Math.max(baseTtl, 21600) : baseTtl; // Deep cached at least 6h
    if (redis) {
      await redis.setEx(cacheKey, ttl, JSON.stringify(analysis));
    }

    // Select forecast day aligned to eventDate if available (only for weather-sensitive markets)
    let forecastDay = null;
    if (isWeatherMarket && weatherData) {
      try {
        const fd = weatherData?.forecast?.forecastday || [];
        if (eventDate) {
          forecastDay = fd.find((d) => d.date === eventDate) || fd[0] || null;
        } else {
          forecastDay = fd[0] || null;
        }
      } catch (e) {
        console.warn("Forecast day selection failed:", e?.message || e);
      }
    }

    // Build weather conditions - only include for weather-sensitive markets
    const wc = isWeatherMarket ? {
      location: location?.name || location || "Unknown",
      temperature: `${
        weatherData?.current?.temp_f || forecastDay?.day?.avgtemp_f || "N/A"
      }°F`,
      condition:
        weatherData?.current?.condition?.text ||
        forecastDay?.day?.condition?.text ||
        "Unknown",
      precipitation: `${
        weatherData?.current?.precip_chance ||
        forecastDay?.day?.daily_chance_of_rain ||
        "0"
      }%`,
      wind: `${
        weatherData?.current?.wind_mph || forecastDay?.day?.maxwind_mph || "0"
      } mph`,
    } : {
      location: location?.name || location || "N/A",
      note: "Weather data not applicable for this market type",
      category: eventType || "Unknown"
    };

    // Derive chain recommendation from confidence, liquidity, and odds efficiency
    let chainRec = analysis.chain_recommendation;
    if (!chainRec) {
      const conf = analysis.assessment?.confidence;
      const eff = analysis.assessment?.odds_efficiency;
      const hasLiquidity = params.currentOdds && typeof params.currentOdds === "object";
      
      // Decision tree: combine confidence + market characteristics
      const isConfidentAnalysis = conf === "HIGH" || conf === "MEDIUM";
      const hasOddsEdge = eff === "UNDERPRICED" || eff === "OVERPRICED";
      
      if (isConfidentAnalysis && hasOddsEdge && hasLiquidity) {
        // Strong conviction + market inefficiency + liquidity = BOTH (hedge + signal)
        chainRec = "BOTH";
      } else if (isConfidentAnalysis && !hasOddsEdge) {
        // High confidence but fair odds = PUBLISH (build record without trading)
        chainRec = "PUBLISH";
      } else if (hasOddsEdge && hasLiquidity) {
        // Market is mispriced regardless of confidence = TRADE
        chainRec = "TRADE";
      } else if (conf === "LOW") {
        // Low conviction = TRADE only (speculative odds play)
        chainRec = "TRADE";
      } else {
        // Default: neither strong conviction nor clear edge
        chainRec = "BOTH";
      }
    }

    return {
      ...analysis,
      chain_recommendation: chainRec,
      weather_conditions: wc,
      cached: false,
      source: "venice_ai",
      synthData, // Include SynthData for finance markets (displays price, percentiles, edge)
    };
  } catch (error) {
    console.error("AI Analysis failed:", error);

    // Fallback to simple heuristic analysis
    return {
      assessment: {
        weather_impact: "MEDIUM",
        odds_efficiency: "UNKNOWN",
        confidence: "LOW",
      },
      analysis: `Error in AI analysis: ${error.message}. Fallback assessment provided.`,
      key_factors: ["Analysis service error"],
      recommended_action: "Proceed with manual evaluation",
      cached: false,
      source: "fallback",
    };
  }
}


