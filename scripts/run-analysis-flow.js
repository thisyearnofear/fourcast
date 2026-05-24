import fs from "fs";
import path from "path";
import { WeatherAnalyzer } from "../services/analysis/WeatherAnalyzer.js";
import { MobilityAnalyzer } from "../services/analysis/MobilityAnalyzer.js";
import { saveSignal, db } from "../services/db.js";
import { v4 as uuidv4 } from 'uuid'; 

// Polyfill randomUUID if needed (node < 14.17)
const generateId = () => crypto.randomUUID ? crypto.randomUUID() : uuidv4();

function loadEnvKey(keyName) {
  const candidates = [".env.local", ".env", ".env.development.local"];
  for (const file of candidates) {
    try {
      const p = path.resolve(process.cwd(), file);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq > 0) {
            const k = trimmed.slice(0, eq).trim();
            const v = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
            if (k === keyName && v) return v;
          }
        }
      }
    } catch (e) {
      console.warn(`Failed reading env file for ${keyName}:`, e?.message || e);
    }
  }
  return null;
}

// Ensure env vars are loaded
if (!process.env.VENICE_API_KEY) process.env.VENICE_API_KEY = loadEnvKey("VENICE_API_KEY");
if (!process.env.NEXT_PUBLIC_WEATHER_API_KEY) process.env.NEXT_PUBLIC_WEATHER_API_KEY = loadEnvKey("NEXT_PUBLIC_WEATHER_API_KEY");

// Mock Fetch for EdgeAnalyzer (since it runs in Node)
global.fetch = async (url, options) => {
  if (url.includes('/api/analyze/generic')) {
    // Simulate server-side AI response
    return {
      json: async () => ({
        digest: "Analysis indicates a potential signal based on current domain data.",
        confidence: Math.random() > 0.6 ? "HIGH" : "MEDIUM",
        oddsEfficiency: Math.random() > 0.5 ? "EFFICIENT" : "INEFFICIENT"
      })
    };
  }
  return fetch(url, options);
};

async function fetchRealMarkets() {
  console.log("🌍 Fetching market candidates...");
  
  // Weather Markets
  const cities = ['London', 'New York', 'Tokyo'];
  const weatherMarkets = cities.map(city => ({
    marketID: `weather-${city.toLowerCase()}-${Date.now()}`,
    title: `Will it rain in ${city} tomorrow?`,
    location: city,
    venue: city,
    currentOdds: { yes: Math.random().toFixed(2), no: Math.random().toFixed(2) },
    eventDate: new Date(Date.now() + 86400000).toISOString(),
    domain: 'weather'
  }));

  // Mobility Markets (Sports)
  const stadiums = [
    { name: 'Wembley Stadium', city: 'London', event: 'Cup Final' },
    { name: 'Madison Square Garden', city: 'New York', event: 'Knicks vs Celtics' }
  ];
  const mobilityMarkets = stadiums.map(s => ({
    marketID: `mobility-${s.city.toLowerCase()}-${Date.now()}`,
    title: `${s.event} at ${s.name} - High Turnout?`,
    location: s.city, // EdgeAnalyzer will verify this
    venue: s.name,
    currentOdds: { yes: Math.random().toFixed(2), no: Math.random().toFixed(2) },
    eventDate: new Date(Date.now() + 86400000).toISOString(),
    domain: 'mobility'
  }));
  
  return [...weatherMarkets, ...mobilityMarkets];
}

async function runPipeline() {
  console.log("🚀 Starting Multi-Domain Analysis Pipeline...");
  
  const weatherAnalyzer = new WeatherAnalyzer();
  const mobilityAnalyzer = new MobilityAnalyzer();
  
  const markets = await fetchRealMarkets();
  console.log(`📊 Found ${markets.length} markets to analyze.`);

  for (const market of markets) {
    const isWeather = market.domain === 'weather';
    const analyzer = isWeather ? weatherAnalyzer : mobilityAnalyzer;
    const emoji = isWeather ? '🌤️' : '🚗';

    console.log(`\n${emoji} Analyzing [${market.domain.toUpperCase()}]: ${market.title}`);
    
    try {
      // 1. Analyze
      const signal = await analyzer.analyze(market);
      
      // 2. Enrich with DB-specific fields
      const dbSignal = {
        id: generateId(),
        event_id: signal.eventId,
        market_title: signal.marketTitle,
        venue: signal.venue,
        event_time: signal.eventTime,
        market_snapshot_hash: signal.marketSnapshotHash,
        weather_json: signal.weatherData || null,
        // Store mobility data in a generic field or JSON if schema permitted, 
        // for now we just rely on the AI digest to capture the insight.
        ai_digest: signal.aiDigest,
        confidence: signal.confidence,
        odds_efficiency: signal.oddsEfficiency,
        author_address: isWeather ? "0xWEATHER_BOT" : "0xMOBILITY_BOT",
        tx_hash: null, 
        timestamp: Math.floor(Date.now() / 1000)
      };

      // 3. Save to DB
      const saved = await saveSignal(dbSignal);
      if (saved.success) {
        console.log(`✅ Signal saved: ${signal.confidence}`);
      } else {
        console.error(`❌ Failed to save: ${saved.error}`);
      }
      
    } catch (err) {
      console.error(`⚠️ Analysis failed:`, err.message);
    }
  }
  
  console.log("\n🏁 Pipeline Complete.");
}

runPipeline().catch(console.error);
