/**
 * Venice AI client core module.
 * Contains the callVeniceAI function and shared weather-sensitivity helpers.
 */

import OpenAI from "openai";
import { LocationValidator } from "./locationValidator.js";

// Weather-sensitive market categories - weather impacts outcomes for these
export const WEATHER_SENSITIVE_CATEGORIES = [
  'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'golf', 'tennis', 'cricket', 'rugby', 'f1', 'formula 1',
  'marathon', 'racing', 'outdoor', 'weather', 'sports'
];

// Check if a market category is weather-sensitive
export const isWeatherSensitiveCategory = (eventType) => {
  if (!eventType) return false;
  const type = String(eventType).toLowerCase();
  return WEATHER_SENSITIVE_CATEGORIES.some(cat => type.includes(cat));
};

// Auto-detect event type from title when not provided
export const detectEventTypeFromTitle = (title) => {
  if (!title) return null;
  const titleLower = title.toLowerCase();
  
  // Financial keywords
  if (titleLower.includes('stock') || titleLower.includes('nvidia') || 
      titleLower.includes('bitcoin') || titleLower.includes('crypto') ||
      titleLower.includes('gold') || titleLower.includes('silver') ||
      titleLower.includes('oil') || titleLower.includes('s&p') ||
      titleLower.includes('dow') || titleLower.includes('nasdaq') ||
      titleLower.includes('dip') || titleLower.includes('hit $') ||
      titleLower.includes('price') || titleLower.includes('market') ||
      titleLower.includes('forex') || titleLower.includes('currency') ||
      titleLower.includes('bond') || titleLower.includes('treasury') ||
      titleLower.includes('fed') || titleLower.includes('rate')) {
    return 'finance';
  }
  
  // Political keywords
  if (titleLower.includes('election') || titleLower.includes('president') ||
      titleLower.includes('congress') || titleLower.includes('senate') ||
      titleLower.includes('parliament') || titleLower.includes('vote') ||
      titleLower.includes('referendum') || titleLower.includes('trump') ||
      titleLower.includes('biden')) {
    return 'politics';
  }
  
  // Sports keywords (check these last as they're more specific)
  const sportsKeywords = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 
    'tennis', 'golf', 'boxing', 'mma', 'ufc', 'cricket', 'rugby', 'f1', 
    'formula 1', 'nascar', 'indycar', 'marathon', 'racing', 'game', 
    'match', 'championship', 'season', 'playoffs', 'finals'];
  
  for (const keyword of sportsKeywords) {
    if (titleLower.includes(keyword)) return keyword;
  }
  
  return null;
};

export const callVeniceAI = async (params, options = {}) => {
  const {
    eventType,
    location,
    weatherData,
    currentOdds,
    participants,
    title,
    isFuturesBet,
    eventDate,
    analysisTypes = [], // Finance/stock analysis types: fundamental, technical, sentiment
    synthContext = null, // SynthData context for finance markets
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

  // Determine if this market is weather-sensitive
  const isWeatherMarket = isWeatherSensitiveCategory(eventType);
  
  // Determine if this is a finance/stock market
  const financeKeywords = ['stock', 'finance', 'crypto', 'bitcoin', 'btc', 'eth', 'trading', 'economy', 'earnings', 'market', 'price', 'index', 'futures', 'options', 'bond'];
  const isFinanceMarket = financeKeywords.some(kw => (eventType || '').toLowerCase().includes(kw) || (title || '').toLowerCase().includes(kw));
  
  // Build analysis types section for finance markets
  const analysisTypesSection = isFinanceMarket && analysisTypes.length > 0 ? `
ANALYSIS TYPES ENABLED:
- ${analysisTypes.map(t => {
  switch(t) {
    case 'fundamental': return '📊 Fundamental: Earnings, revenue, P/E ratios, macro factors';
    case 'technical': return '📈 Technical: Price patterns, trends, support/resistance';
    case 'sentiment': return '💬 Sentiment: Social media, news, community mood';
    default: return t;
  }
}).join('\n- ')}` : '';
  
  // Build weather section only for weather-sensitive markets
  const weatherSection = isWeatherMarket ? `
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
` : `
CONTEXT NOTE
- This is a ${eventType || 'financial/political'} market - weather is NOT a relevant factor
- Focus analysis on market fundamentals, news, and odds efficiency only
`;

  // Adjust system prompt based on market type
  const systemPrompt = isWeatherMarket 
    ? `You are an expert sports betting analyst specializing in weather impacts on game outcomes. Provide SPECIFIC, ACTIONABLE analysis with clear reasoning.

STRICT REQUIREMENTS:
- Tailor analysis to the given sport and participants only
- Consider how weather conditions may impact game outcomes
- Do NOT reuse or reference any example content; generate event-specific analysis
- You MUST respond with ONLY a valid JSON object, no other text before or after
- Do NOT wrap the JSON in markdown code blocks
- Output a single JSON object with the required fields only`
    : `You are an expert prediction market analyst specializing in ${isFinanceMarket ? 'stocks, crypto, and financial markets' : 'non-sports events'}. Provide SPECIFIC, ACTIONABLE analysis with clear reasoning.

${isFinanceMarket && analysisTypes.length > 0 ? `You have access to the following analysis types - incorporate them into your analysis:
- ${analysisTypes.join(', ')}` : ''}

STRICT REQUIREMENTS:
- Focus on market fundamentals, news, and odds efficiency
- Do NOT mention weather - it is NOT relevant for this market type
- Do NOT reuse or reference any example content; generate market-specific analysis
- You MUST respond with ONLY a valid JSON object, no other text before or after
- Do NOT wrap the JSON in markdown code blocks
- Output a single JSON object with the required fields only`;

  const messages = [
    {
      role: "system",
      content: systemPrompt,
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
${weatherSection}
${analysisTypesSection}
${synthContext ? `\n${synthContext}` : ''}
MARKET ODDS: ${oddsText}

RESPONSE FORMAT - You MUST respond with ONLY this JSON structure, no other text:
{
  "weather_impact": "${isWeatherMarket ? "LOW|MEDIUM|HIGH" : "N/A"}",
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
    
    let thinking = null;
    // Extract thinking tags if present
    if (content.includes('<think>')) {
      const thinkStart = content.indexOf('<think>');
      const thinkEnd = content.lastIndexOf('</think>');
      if (thinkEnd !== -1) {
        thinking = content.substring(thinkStart + 7, thinkEnd).trim();
        // Only strip if not requested to keep it
        if (!options.includeThinking) {
          content = content.substring(thinkEnd + 8).trim();
        }
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
      thinking: thinking,
    };
  } catch (error) {
    console.error("Venice AI error:", error);
    throw new Error(`Venice AI analysis failed: ${error.message}`);
  }
};

