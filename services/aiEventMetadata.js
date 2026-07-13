/**
 * Event metadata extraction and location verification via Venice AI.
 * These functions create their own OpenAI client instances and use web search.
 */
// Server-only guard: this module reads secret env vars (VENICE_API_KEY et al).
// The .server filename convention was lost in the god-file split — enforce it here.
if (typeof window !== 'undefined') {
  throw new Error('aiEventMetadata is server-only and must not be imported from client components');
}


import OpenAI from "openai";

// Multivariate Location Verification System
// 1. Infers location from title
// 2. Verifies with web search for schedule confirmation
// 3. Returns high-confidence location
export const verifyEventLocation = async (title, eventType) => {
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
export const extractEventMetadataViaVenice = async (titleText) => {
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
