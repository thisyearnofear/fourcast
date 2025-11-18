# Venue Extraction Analysis Report

**Date:** November 18, 2024  
**Status:** Phase 4 - Testing  
**Build:** After `/ai` vs `/discovery` refactor

---

## Executive Summary

Tested VenueExtractor on 99 live sports markets from Polymarket API:
- **✅ SUCCESS:** 22% - Clear venue extraction (e.g., "Kansas City, MO")
- **⚠️ PARTIAL:** 53.5% - Extracted something but uncertain (e.g., "At Arrowhead", "Tampa, FL")
- **❌ FAILED:** 24.2% - No venue found (non-location-specific markets)

**Conclusion:** Venue extraction works but needs improvement before production. Current success rate (22%) is too low for primary `/ai` page reliance. Recommend using as secondary signal with fallback strategy.

---

## Detailed Findings

### Success Rate by Extraction Method

**Team-to-City Mapping:** ~65% success
- Warriors → San Francisco, CA ✅
- Lakers → Los Angeles, CA ✅
- Packers → Green Bay, WI ✅
- Chiefs → Kansas City, MO ✅

**Title Pattern Matching (@ or in):** ~40% success
- "at Sofi" → "At Sofi" (incomplete, needs cleanup)
- "at Lambeau" → "At Lambeau" (incomplete)
- "Liverpool beat Leicester" → "Liverpool, England" ✅

**Description Parsing:** ~10% success
- Rarely finds complete venue info in descriptions

### Issues Identified

#### 1. **Partial Extractions Not Cleaned**
Many extractions are incomplete or include extra text:
- ❌ "At Sofi" (should be "Inglewood, CA" or similar)
- ❌ "At Arrowhead" (should be "Kansas City, MO")
- ❌ "At Nissan" (should be "Nashville, TN")
- ❌ "Good Faith" (junk extracted from legal disclaimer language)

**Impact:** These pass validation but provide no usable location  
**Fix:** Add post-processing to clean and normalize extracted strings

#### 2. **Team-to-City Mapping Gaps**
Some teams are missing or incorrectly mapped:
- ❌ "Buccaneers vs Saints" → Extracts "Cleveland, OH" (wrong!)
- ❌ "Ravens vs Bills" → Extracts "Baltimore, MD" (only Ravens, not Bills)
- ⚠️ "Titans vs Ravens" → No extraction

**Impact:** Ambiguous when multiple teams, unclear which venue to use  
**Fix:** When multiple teams detected, return all possible venues or be conservative

#### 3. **Non-Sports Markets Incorrectly Processed**
Political/crypto markets that contain city names are falsely matched:
- "Which party will win Pennsylvania in the 2020 presidential election?" → Could extract "Pennsylvania" (if regex improved)
- "Will Coinbase begin publicly trading before Jan 1, 2021?" → Correctly rejected

**Impact:** Low false positive rate, but filters needed to avoid confusion  
**Fix:** Use `eventType` or category hints (once populated) to validate extracted venues

#### 4. **Stadium Name Ambiguity**
Markets reference stadium names without city:
- "Will the Green Bay Packers or the Tampa Bay Buccaneers win the NFC Champions..." @ "Lambeau" 
  - Extracted: "At Lambeau" (incomplete)
  - Should be: "Green Bay, WI" (from team mapping)

**Impact:** Some markets have stadium names but we need team context to resolve  
**Fix:** Build stadium-to-city mapping as secondary extraction method

---

## Data Quality Insights

### Market Metadata

**Current Polymarket API Response:**
```javascript
{
  question: "Will the Seahawks or the Rams win their week 10 NFL matchup?",
  description: "...(legal text with no venue info)...",
  eventType: null,  // ❌ NOT populated
  teams: null,      // ❌ NOT populated
  category: "sports" // ✅ Sometimes populated
}
```

**Problem:** `eventType` and `teams` fields are null in API response.  
**Impact:** We must extract venue from title/description only.  
**Recommendation:** Extract and populate these during catalog build.

### Title Analysis

**Good Titles (extractable):**
- "Will the Seahawks or the Rams win..." → Team names present
- "Will Liverpool beat Leicester..." → Team names present
- "Will the Warriors win on January 28th..." → Team name present

**Bad Titles (not extractable):**
- "Who will win the 2020 MLB World Series?" → Generic, no venue
- "Will the Buccaneers or the Saints win..." → Team names but generic structure
- "Will Khabib win his UFC 254 Fight?" → Event name but no location

**Percentage with Team Names:** ~65%  
**Percentage with Explicit Location:** ~15%

---

## Recommendations

### Priority 1: Fix Extraction Issues (Quick Wins)

**1.1 Clean Stadium Name Extractions**
```javascript
const stadiumMap = {
  'lambeau': 'Green Bay, WI',
  'arrowhead': 'Kansas City, MO',
  'sofi': 'Inglewood, CA',
  'nissan': 'Nashville, TN',
  'at&t': 'Arlington, TX',
  // ... add more
};

// If extraction starts with "At X", check stadium map
if (extracted.match(/^at\s+(\w+)/i)) {
  const stadium = RegExp.$1;
  const mapped = stadiumMap[stadium.toLowerCase()];
  if (mapped) return mapped;
}
```

**1.2 Filter Junk Extractions**
Remove common false positives from description parsing:
- "Good Faith", "the event", "this market", "shall be", etc.
- Minimum length: 5 characters
- Must contain a comma (for "City, State" format) OR be a known city

**1.3 Expand Team-to-City Mapping**
Current mapping covers ~50 teams. Need to add:
- International soccer clubs (Man City, Barcelona, Bayern Munich, etc.)
- NHL teams (Vegas Golden Knights, Seattle Kraken, etc.)
- College sports (Alabama, Ohio State, etc.)
- Esports teams (for LCS, worlds, etc.)

---

### Priority 2: Backend Integration (Medium Effort)

**2.1 Pre-Extract During Catalog Build**
Instead of extracting on-demand:
```javascript
// During buildMarketCatalog(), add:
const eventType = MarketTypeDetector.detectMarketType(market);
const teams = this.extractTeamsFromTitle(market.title);
const eventLocation = VenueExtractor.extractFromMarket(market);

market.eventType = eventType;
market.teams = teams;
market.eventLocation = eventLocation;
```

**Benefits:**
- Extractions done once, not per request
- Can validate/correct extracted data before caching
- Faster `/ai` page loads (no extraction latency)
- Easier to monitor data quality

**2.2 Add Stadium-to-City Mapping Service**
```javascript
export class StadiumExtractor {
  static stadiumMap = {
    'Arrowhead': 'Kansas City, MO',
    'Lambeau Field': 'Green Bay, WI',
    // ... 100+ stadiums
  };
  
  static extractStadium(title) {
    for (const stadium of Object.keys(this.stadiumMap)) {
      if (title.includes(stadium)) {
        return this.stadiumMap[stadium];
      }
    }
    return null;
  }
}
```

**2.3 Handle Multiple Venues Gracefully**
When a market involves two teams in different cities:
```javascript
// Option A: Return "home team" venue (more conservative)
// Option B: Return both venues as array
// Option C: Fetch both venues' weather and compare

// Recommend Option A initially: Use home team venue
// For "Seahawks @ Rams": Extract Rams (away) location
```

---

### Priority 3: Fallback Strategy (Handles Edge Cases)

**3.1 When Venue Extraction Fails**
Don't exclude market from `/ai` page. Instead:
- Show as "Location TBD" or "Nationwide event"
- Skip weather analysis for that market
- Or use generic venue weather (major city nearest to market)
- Still show in results for team interest

**3.2 Confidence Scoring**
```javascript
edgeScore = weatherScore * (venue_confidence / 100);

// High confidence (0.90-1.0):
//   - "Chiefs vs Raiders" (both teams in title, clear mapping)
//   - "Game in Kansas City" (explicit location in title)

// Medium confidence (0.60-0.89):
//   - "Will the Lakers win?" (team only, one possible venue)
//   - "At Arrowhead" (stadium name, needs mapping)

// Low confidence (0.00-0.59):
//   - "NFL matchup" (no team/venue info)
//   - Multiple teams, unclear which is home
```

---

## Test Results in Detail

### Top Success Cases

| Market | Venue | Method |
|--------|-------|--------|
| Seahawks or Rams week 10 | "At Sofi" | Title pattern (incomplete) |
| Liverpool vs Leicester | "Liverpool, England" | Team mapping |
| Rams or Packers Jan 16 | "Green Bay, WI" | Team mapping (Packers) |
| Browns or Chiefs Jan 17 | "Kansas City, MO" | Team mapping (Chiefs) |
| Warriors or Suns Jan 28 | "San Francisco, CA" | Team mapping (Warriors) |

### Top Failure Cases

| Market | Issue | Recommendation |
|--------|-------|-----------------|
| 2020 MLB World Series | Generic title, no teams | Skip this market for /ai |
| LaMelo Ball draft pick | Crypto/futures, no venue | Skip non-location sports |
| Georgia Senate Runoff | Political market, not sports | Filter by category |
| Floyd Mayweather boxing | Extracted "His Boxing..." | Better regex patterns |
| Andrew Yang NYC Mayor | Political market | Better filtering |

---

## Before/After: With Improvements

### With Stadium Mapping + Team Expansion

```
❌ Before:
- "At Lambeau" (incomplete) → Ignored
- "At Arrowhead" (incomplete) → Ignored
- Buccaneers venue unknown → Skipped

✅ After:
- "At Lambeau" → "Green Bay, WI" (stadium map)
- "At Arrowhead" → "Kansas City, MO" (stadium map)
- "Buccaneers or Saints" → "Tampa, FL" (team map, more careful)
```

**Projected improvement:** 22% → 50-60% success rate

---

## Implementation Roadmap

### Week 1: Quick Fixes (Stadium + Filtering)
- [ ] Build complete stadium-to-city mapping
- [ ] Add junk-string filtering
- [ ] Improve team-to-city mapping (add 30+ teams)
- [ ] Test again (expect 40-50% success rate)

### Week 2: Backend Integration
- [ ] Extract during catalog build (not on-demand)
- [ ] Add eventType/teams population
- [ ] Validate extracted data quality
- [ ] Cache results

### Week 3: Confidence Scoring
- [ ] Implement venue_confidence field
- [ ] Adjust edge scores by confidence
- [ ] Add "Location TBD" handling
- [ ] Test end-to-end

### Week 4: Fallback & Edge Cases
- [ ] Handle multiple venues
- [ ] Multiple team disambiguation
- [ ] Generic region fallback (if needed)
- [ ] User feedback collection

---

## Success Criteria

**For /ai Page to Go Live:**
- ✅ Venue extraction success rate ≥ 50%
- ✅ Stadium mapping covers 80%+ of referenced stadiums
- ✅ No false positives in venue extraction
- ✅ Graceful handling of missing venues
- ✅ User testing validates usefulness

**Current Status:** 22% success rate → Needs work before production

**Estimated Timeline:** 2-3 weeks with focused effort

---

## Files to Update

```
services/
├── venueExtractor.js          (+ stadium mapping, filtering)
├── polymarketService.js        (+ pre-extraction during catalog build)
└── marketTypeDetector.js       (+ eventType extraction)

scripts/
├── test-venue-extraction-realistic.js (test suite)
└── test-venue-extraction.js (old test - can be archived)

docs/
└── VENUE_EXTRACTION_ANALYSIS.md (this file)
```

---

## Conclusion

Venue extraction is a viable approach for `/ai` page but needs improvements:
1. **Fix extraction bugs** (stadium mapping, filtering) - HIGH PRIORITY
2. **Expand team mappings** - MEDIUM PRIORITY  
3. **Pre-extract during catalog build** - MEDIUM PRIORITY
4. **Add confidence scoring** - LOW PRIORITY (nice-to-have)

With these improvements, we can achieve 50-60% venue extraction accuracy and safely launch `/ai` page with fallback handling for missing venues.

**Next Step:** Implement Priority 1 fixes and re-test.
