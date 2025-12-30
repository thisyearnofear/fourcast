# Architecture Guide: The EdgeAnalyzer Pattern

## Overview

Fourcast has evolved from a simple weather app into a **modular signal intelligence layer**. The core architectural innovation driving this is the `EdgeAnalyzer` pattern.

This pattern allows us to decouple the *method* of analysis (AI models, prompt engineering) from the *domain* of data (Weather, Traffic, Sentiment).

## 1. The EdgeAnalyzer Abstraction

Located in `services/analysis/EdgeAnalyzer.js`, this abstract base class defines the lifecycle of a signal:

```javascript
class EdgeAnalyzer {
  async analyze(context) {
    // 1. Validate Context
    this.validate(context);
    
    // 2. Enrich (Domain Specific)
    // e.g., Fetch weather from OpenMeteo OR Traffic from Google
    const data = await this.enrichContext(context);
    
    // 3. Construct Prompt (Domain Specific)
    const prompt = this.constructPrompt(data);
    
    // 4. AI Processing (Generic)
    const result = await this.executeAnalysis(prompt);
    
    // 5. Format for Blockchain (Standard)
    return this.formatSignal(result);
  }
}
```

## 2. Domain Implementations

### Weather Domain (`WeatherAnalyzer.js`)
- **Source**: Open-Meteo API / WeatherAPI
- **Trigger**: Market title contains "Rain", "Temperature", "Snow"
- **Enrichment**: Fetches GFS forecast models
- **Output**: Weather-weighted confidence score

### Mobility Domain (`MobilityAnalyzer.js`)
- **Source**: Google Popular Times (Simulated)
- **Trigger**: Market title contains "Attendance", "Turnout", "Delay"
- **Enrichment**: Fetches live crowd density and traffic flow
- **Output**: Logistics-weighted confidence score

## 3. Data Pipeline (`run-analysis-flow.js`)

The pipeline script demonstrates the power of this architecture. It iterates through a mixed list of market candidates:

```javascript
const candidates = [
  { domain: 'weather', title: 'Rain in London?' },
  { domain: 'mobility', title: 'Wembley Crowd Size?' }
];

for (const market of candidates) {
  // Polymorphic dispatch!
  // The system doesn't care *what* the domain is, 
  // it just asks for an analysis.
  const analyzer = getAnalyzer(market.domain);
  const signal = await analyzer.analyze(market);
  
  // Save to unified DB
  await db.save(signal);
}
```

## 4. On-Chain Standardization

Regardless of the complex off-chain analysis, the on-chain representation is standardized in the Move contract:

```move
struct Signal {
    event_id: String,
    domain_hash: String, // Hashed generic data (weather OR mobility)
    ai_digest: String,   // Human-readable reasoning
    confidence: String,  // HIGH/MEDIUM/LOW
    ...
}
```

This ensures that the **Movement Network** acts as the universal verification layer, while the complexity stays off-chain in our Edge Nodes.
