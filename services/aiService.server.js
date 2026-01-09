/**
 * Server-only AI Service functions
 * Import this only in API routes (server-side)
 */

import OpenAI from "openai";
import { getRedisClient } from "./redisService.js";
import { LocationValidator } from "./locationValidator.js";
import { polymarketService } from "./polymarketService.js";
import { kalshiService } from "./kalshiService.js";
import { VenueExtractor } from "./venueExtractor.js";

const callVeniceAI = async (params, options = {}) => {
  const {
    eventType,
    location,
    weatherData,
    currentOdds,
    participants,
    title,
    isFuturesBet,
    eventDate,
  } = params;
  const { webSearch = true, showThinking = false } = options;

  // Configure Venice AI client
  const client = new OpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: "https://api.venice.ai/api/v1",
  });

  // Format odds properly
  const oddsText =
    typeof currentOdds === "object"
      ? `YES: ${currentOdds.yes || "N/A"}, NO: ${currentOdds.no || "N/A"}`
      : currentOdds;

  // Format participants if available
  const participantText = participants
    ? ` (${
        Array.isArray(participants) ? participants.join(" vs ") : participants
      })`
    : "";

  // Validate location using consolidated LocationValidator service
  const locationValidation = LocationValidator.validateLocation(
    eventType,
    location,
    { title }
  );
  if (!locationValidation.valid) {
    const locationText = location?.name || location || "Unknown";
    return LocationValidator.generateValidationErrorResponse(
      locationValidation,
      eventType,
      locationText
    );
  }

  const messages = [
    {
      role: "system",
      content: `You are an expert sports betting analyst specializing in weather impacts on game outcomes. Provide SPECIFIC, ACTIONABLE analysis with clear reasoning.

STRICT REQUIREMENTS:
- Tailor analysis to the given sport and participants only
- Do NOT reuse or reference any example content; generate event-specific analysis
- You MUST respond with ONLY a valid JSON object, no other text before or after
- Do NOT wrap the JSON in markdown code blocks
- Output a single JSON object with the required fields only
      `,
    },

    {
      role: "user",
      content: `EVENT CONTEXT
- Event Title: ${title || "Unknown"}
- Event Type: ${eventType}
- Participants: ${participantText || "Unknown"}
- Venue: ${location?.name || location || "Unknown"}
- Scheduled Date: ${
        eventDate || weatherData?.forecast?.forecastday?.[0]?.date || "Unknown"
      }

WEATHER
- Temperature: ${
        weatherData?.current?.temp_f ||
        weatherData?.forecast?.forecastday?.[0]?.day?.avgtemp_f ||
        "unknown"
      }°F
- Condition: ${
        weatherData?.current?.condition?.text ||
        weatherData?.forecast?.forecastday?.[0]?.day?.condition?.text ||
        "unknown"
      }
- Precipitation chance: ${
        weatherData?.current?.precip_chance ||
        weatherData?.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain ||
        "0"
      }%
- Wind: ${
        weatherData?.current?.wind_mph ||
        weatherData?.forecast?.forecastday?.[0]?.day?.maxwind_mph ||
        "0"
      } mph

MARKET ODDS: ${oddsText}

RESPONSE FORMAT - You MUST respond with ONLY this JSON structure, no other text:
{
  "weather_impact": "LOW|MEDIUM|HIGH",
  "odds_efficiency": "FAIR|OVERPRICED|UNDERPRICED|UNKNOWN",
  "confidence": "LOW|MEDIUM|HIGH",
  "analysis": "Event-specific reasoning only, no example content",
  "key_factors": ["specific, measurable factors"],
  "recommended_action": "Clear recommendation",
  "chain_recommendation": "PUBLISH|TRADE|BOTH" (PUBLISH for high confidence signals, TRADE for odds plays, BOTH if suitable for both)
}

Respond with ONLY the JSON object above. Do not include any text before or after the JSON.
      `,
    },
  ];

  try {
    console.log("🤖 Calling Venice AI...");
    
    // Venice API parameters - CRITICAL: Use correct format
    // - enable_web_search must be "auto" (string), not true (boolean)
    // - response_format is NOT supported by Venice
    // - strip_thinking_response is NOT a valid parameter
    const veniceParams = {};
    if (webSearch) {
      veniceParams.enable_web_search = "auto"; // Must be string "auto", not boolean
    }
    
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b", // Changed from qwen3-235b - it outputs thinking tags
      messages,
      temperature: 0.3,
      max_tokens: 1000,
      // REMOVED: response_format - Venice doesn't support this
      // Use prompt engineering instead (already in system message)
      venice_parameters: Object.keys(veniceParams).length > 0 ? veniceParams : undefined,
    });

    let content = response.choices[0].message.content;
    console.log("🤖 Venice AI raw response:", content.substring(0, 200) + '...');

    // Venice may include thinking tags or markdown - clean them
    content = content.trim();
    
    // Remove thinking tags if present
    if (content.includes('<think>')) {
      const thinkEnd = content.lastIndexOf('</think>');
      if (thinkEnd !== -1) {
        content = content.substring(thinkEnd + 8).trim();
      }
    }
    
    // Remove markdown code blocks if present
    if (content.startsWith('```')) {
      content = content.replace(/```json\n?|\n?```/g, '').trim();
    }
    
    // Extract JSON if there's text before/after
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    const parsed = JSON.parse(content);
    console.log("🤖 Venice AI parsed response:", parsed);

    // Validate that we got actual analysis, not echoed input
    const hasValidAnalysis =
      parsed.analysis &&
      parsed.analysis !== "string" &&
      !parsed.analysis.includes("Your detailed") &&
      typeof parsed.analysis === "string" &&
      parsed.analysis.length > 20;

    const hasValidFactors =
      Array.isArray(parsed.key_factors) &&
      parsed.key_factors.length > 0 &&
      !parsed.key_factors[0]?.includes("Factor");

    if (!hasValidAnalysis || !hasValidFactors) {
      console.warn(
        "⚠️ AI returned invalid response, attempting correction with web search"
      );
      // Retry once with web search explicitly enabled
      if (!options.__retry) {
        const retry = await callVeniceAI(
          {
            eventType,
            location,
            weatherData,
            currentOdds,
            participants,
            title,
            isFuturesBet,
            eventDate,
          },
          {
            webSearch: true,
            showThinking,
            __retry: true,
          }
        );
        return retry;
      }
      throw new Error("AI returned mismatched sport or template");
    }

    return {
      assessment: {
        weather_impact: parsed.weather_impact || "MEDIUM",
        odds_efficiency: parsed.odds_efficiency || "UNKNOWN",
        confidence: parsed.confidence || "LOW",
      },
      analysis: parsed.analysis || "Analysis completed via Venice AI",
      key_factors: Array.isArray(parsed.key_factors)
        ? parsed.key_factors
        : [parsed.key_factors || "Weather factors analyzed"],
      recommended_action:
        parsed.recommended_action || "Monitor the market closely",
      chain_recommendation: parsed.chain_recommendation || "BOTH",
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      limitations: parsed.limitations || null,
    };
  } catch (error) {
    console.error("Venice AI error:", error);
    throw new Error(`Venice AI analysis failed: ${error.message}`);
  }
};

import { weatherService } from "./weatherService.js";

// Multivariate Location Verification System
// 1. Infers location from title
// 2. Verifies with web search for schedule confirmation
// 3. Returns high-confidence location
const verifyEventLocation = async (title, eventType) => {
  try {
    const client = new OpenAI({
      apiKey: process.env.VENICE_API_KEY,
      baseURL: "https://api.venice.ai/api/v1",
    });

    // Step 1: Multivariate Analysis Prompt
    // We ask the model to perform two distinct tasks in one pass to cross-reference
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b", // Changed from qwen3-235b
      messages: [
        {
          role: "system",
          content: `You are a rigorous Fact-Checking Agent. Your goal is to determine the EXACT venue for a sports event.
        
        PROTOCOL:
        1. Search for the official schedule for this specific match-up.
        2. Identify the venue (Stadium/Arena) and City/State.
        3. Verify if this is a "Neutral Site" game (e.g. NFL in London, College Bowl Game).
        4. Return the confirmed location.

        You MUST respond with ONLY valid JSON, no other text.
        Output JSON: { "location": "City, State", "venue": "Stadium Name", "confidence": "HIGH/MEDIUM/LOW", "is_neutral_site": boolean }`,
        },
        {
          role: "user",
          content: `Verify the location for this ${eventType} event: "${title}". Ensure you check the latest schedule. Respond with ONLY the JSON object.`,
        },
      ],
      // REMOVED: response_format - Venice doesn't support this
      venice_parameters: {
        enable_web_search: "auto", // CRITICAL: Must be string "auto", not boolean
      },
    });

    let contentStr = response.choices[0].message.content;
    // Strip markdown code blocks if present
    contentStr = contentStr.replace(/```json\n?|\n?```/g, "").trim();

    const content = JSON.parse(contentStr);

    console.log(
      `🕵️‍♂️ Location Verification: ${title} -> ${content.venue} in ${content.location} (${content.confidence})`
    );

    if (content.location && content.location !== "UNKNOWN") {
      return content.location;
    }

    return null;
  } catch (e) {
    console.error("Location verification failed:", e);
    return null;
  }
};

// Extract structured event metadata via Venice web search
// Returns { home_team, away_team, venue_name, city, country, competition, kickoff_local, timezone, confidence }
const extractEventMetadataViaVenice = async (titleText) => {
  try {
    const client = new OpenAI({
      apiKey: process.env.VENICE_API_KEY,
      baseURL: "https://api.venice.ai/api/v1",
    });

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b", // Changed from qwen3-235b
      messages: [
        {
          role: "system",
          content:
            "You are a precise Sports Fixture Extractor. Use web search to identify exact fixture metadata. You MUST respond with ONLY valid JSON, no other text.",
        },
        {
          role: "user",
          content: `Extract structured metadata for this market title: "${titleText}".

Return ONLY valid JSON with keys:
{
  "home_team": string,
  "away_team": string,
  "venue_name": string,
  "city": string,
  "country": string,
  "competition": string,
  "kickoff_local": string, // ISO with local time if possible
  "timezone": string,
  "confidence": "HIGH|MEDIUM|LOW"
}

Respond with ONLY the JSON object, no other text.`,
        },
      ],
      // REMOVED: response_format - Venice doesn't support this
      venice_parameters: {
        enable_web_search: "auto", // Must be string "auto", not boolean
      },
    });

    let contentStr = response.choices[0].message.content || "{}";
    contentStr = contentStr.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(contentStr);

    return parsed;
  } catch (err) {
    console.warn("Fixture metadata extraction failed:", err?.message || err);
    return null;
  }
};

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
  } = params;

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
    if (!effectiveLocation || initialValidation.warning) {
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

    if (!correctedLocation && effectiveLocation && !weatherData) {
      // Only fetch weather if we don't already have it
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

    if (!location) {
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
        },
        {
          webSearch: true,
          showThinking: false,
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
          },
          {
            webSearch: true,
            showThinking: false,
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

    // Select forecast day aligned to eventDate if available
    let forecastDay = null;
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

    const wc = {
      location: location.name || location,
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

export function getAIStatus() {
  const hasRedis = !!process.env.REDIS_URL;
  return {
    available: true,
    model: "llama-3.3-70b", // Updated to reflect actual model in use
    cacheSize: 0,
    cacheDuration: 10 * 60 * 1000,
    cache: {
      memory: { size: 0, duration: "10 minutes" },
      redis: { connected: hasRedis, ttl: "6 hours" },
    },
  };
}
