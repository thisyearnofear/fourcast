/**
 * Venue Extractor Service
 * 
 * Extracts event venue/location from Polymarket data.
 * Attempts multiple strategies to find the actual location where an event occurs.
 * Used by /ai page to fetch weather at event locations (not user location).
 * 
 * Version 2.0: Improved with stadium mapping and better filtering
 */

// Stadium-to-city mapping (for venue name resolution)
const STADIUM_CITY_MAP = {
  'lambeau': 'Green Bay, WI',
  'lambeau field': 'Green Bay, WI',
  'arrowhead': 'Kansas City, MO',
  'arrowhead stadium': 'Kansas City, MO',
  'sofi': 'Inglewood, CA',
  'sofi stadium': 'Inglewood, CA',
  'nissan': 'Nashville, TN',
  'nissan stadium': 'Nashville, TN',
  'at&t': 'Arlington, TX',
  'at&t stadium': 'Arlington, TX',
  'metlife': 'East Rutherford, NJ',
  'metlife stadium': 'East Rutherford, NJ',
  'gillette': 'Foxborough, MA',
  'gillette stadium': 'Foxborough, MA',
  'allegiant': 'Las Vegas, NV',
  'allegiant stadium': 'Las Vegas, NV',
  'lumen': 'Seattle, WA',
  'lumen field': 'Seattle, WA',
  'empower field': 'Denver, CO',
  'hard rock': 'Miami, FL',
  'hard rock stadium': 'Miami, FL',
  'mercedes-benz': 'Atlanta, GA',
  'mercedes benz': 'Atlanta, GA',
  'dome': 'New Orleans, LA',
  'superdome': 'New Orleans, LA',
  'soldier field': 'Chicago, IL',
  'millennium': 'Chicago, IL',
  'lake shore': 'Chicago, IL',
  'wrigley': 'Chicago, IL',
  'yankee': 'New York, NY',
  'yankee stadium': 'New York, NY',
  'fenway': 'Boston, MA',
  'fenway park': 'Boston, MA',
  'dodger': 'Los Angeles, CA',
  'dodger stadium': 'Los Angeles, CA',
  'petco': 'San Diego, CA',
  'oracle': 'San Francisco, CA',
  'oakland': 'Oakland, CA',
  'coliseum': 'Oakland, CA',
  'angel': 'Anaheim, CA',
  'angel stadium': 'Anaheim, CA',
  'chase': 'San Francisco, CA',
  'colorado': 'Denver, CO',
  'coors': 'Denver, CO',
  'coors field': 'Denver, CO',
  'minute maid': 'Houston, TX',
  'minute maid park': 'Houston, TX',
  'globe life': 'Arlington, TX',
  'rangers': 'Arlington, TX',
  'kauffman': 'Kansas City, MO',
  'kauffman stadium': 'Kansas City, MO',
  'comerica': 'Detroit, MI',
  'comerica park': 'Detroit, MI',
  'target field': 'Minneapolis, MN',
  'busch stadium': 'St. Louis, MO',
  'miller park': 'Milwaukee, WI',
  'american family': 'Milwaukee, WI',
  'great american ball park': 'Cincinnati, OH',
  'progressive field': 'Cleveland, OH',
  'truist park': 'Atlanta, GA',
  'braves': 'Atlanta, GA',
  'nationals park': 'Washington, DC',
  'mets': 'New York, NY',
  'citi field': 'New York, NY',
  'citizens bank': 'Philadelphia, PA',
  'pirates': 'Pittsburgh, PA',
  'pnc park': 'Pittsburgh, PA',
};

// List of junk strings that appear in descriptions but aren't venues
const JUNK_STRINGS = [
  'good faith',
  'the event',
  'this market',
  'shall be',
  'shall resolve',
  'market on',
  'market for',
  'market regarding',
  'in the event',
  'in case of',
  'definition',
  'resolution criteria',
  'terms and conditions',
  'market will',
  'this is a market',
];

// Basic team-to-city mapping (common US sports teams)
const TEAM_CITY_MAP = {
  // NFL
  'chiefs': 'Kansas City, MO',
  'patriots': 'Foxborough, MA',
  'cowboys': 'Arlington, TX',
  'packers': 'Green Bay, WI',
  'steelers': 'Pittsburgh, PA',
  '49ers': 'Santa Clara, CA',
  'niners': 'Santa Clara, CA',
  'broncos': 'Denver, CO',
  'raiders': 'Las Vegas, NV',
  'chargers': 'Los Angeles, CA',
  'titans': 'Nashville, TN',
  'ravens': 'Baltimore, MD',
  'bengals': 'Cincinnati, OH',
  'browns': 'Cleveland, OH',
  'colts': 'Indianapolis, IN',
  'jaguars': 'Jacksonville, FL',
  'seahawks': 'Seattle, WA',
  'lions': 'Detroit, MI',
  'bears': 'Chicago, IL',
  'vikings': 'Minneapolis, MN',
  'buccaneers': 'Tampa, FL',
  'bucs': 'Tampa, FL',
  'saints': 'New Orleans, LA',
  'falcons': 'Atlanta, GA',
  'eagles': 'Philadelphia, PA',
  'washington': 'Washington, DC',
  'commanders': 'Washington, DC',
  'giants': 'East Rutherford, NJ',
  'jets': 'East Rutherford, NJ',
  'dolphins': 'Miami, FL',
  'bills': 'Orchard Park, NY',
  'texans': 'Houston, TX',
  'cardinals': 'Glendale, AZ',

  // NBA
  'lakers': 'Los Angeles, CA',
  'celtics': 'Boston, MA',
  'warriors': 'San Francisco, CA',
  'heat': 'Miami, FL',
  'bulls': 'Chicago, IL',
  'nets': 'Brooklyn, NY',
  'spurs': 'San Antonio, TX',
  'knicks': 'New York, NY',
  'suns': 'Phoenix, AZ',
  'mavericks': 'Dallas, TX',
  'grizzlies': 'Memphis, TN',
  'nuggets': 'Denver, CO',
  'rockets': 'Houston, TX',
  'clippers': 'Los Angeles, CA',
  'kings': 'Sacramento, CA',
  'trail blazers': 'Portland, OR',
  'blazers': 'Portland, OR',
  'jazz': 'Salt Lake City, UT',
  'timberwolves': 'Minneapolis, MN',
  'pelicans': 'New Orleans, LA',
  'hawks': 'Atlanta, GA',
  'pacers': 'Indianapolis, IN',
  'cavaliers': 'Cleveland, OH',
  'pistons': 'Detroit, MI',
  'raptors': 'Toronto, ON',
  'seventy sixers': 'Philadelphia, PA',
  '76ers': 'Philadelphia, PA',
  'bucks': 'Milwaukee, WI',
  'hornets': 'Charlotte, NC',

  // MLB
  'yankees': 'New York, NY',
  'red sox': 'Boston, MA',
  'mets': 'New York, NY',
  'phillies': 'Philadelphia, PA',
  'braves': 'Atlanta, GA',
  'nationals': 'Washington, DC',
  'orioles': 'Baltimore, MD',
  'rays': 'Tampa, FL',
  'blue jays': 'Toronto, ON',
  'white sox': 'Chicago, IL',
  'indians': 'Cleveland, OH',
  'guardians': 'Cleveland, OH',
  'tigers': 'Detroit, MI',
  'royals': 'Kansas City, MO',
  'twins': 'Minneapolis, MN',
  'astros': 'Houston, TX',
  'mariners': 'Seattle, WA',
  'rangers': 'Arlington, TX',
  'angels': 'Los Angeles, CA',
  'athletics': 'Las Vegas, NV',
  'dodgers': 'Los Angeles, CA',
  'giants': 'San Francisco, CA',
  'padres': 'San Diego, CA',
  'rockies': 'Denver, CO',
  'diamondbacks': 'Phoenix, AZ',
  'cubs': 'Chicago, IL',
  'cardinals': 'St. Louis, MO',
  'brewers': 'Milwaukee, WI',
  'pirates': 'Pittsburgh, PA',
  'reds': 'Cincinnati, OH',
  'marlins': 'Miami, FL',

  // Soccer/EPL (English Premier League)
  'manchester united': 'Manchester, England',
  'man united': 'Manchester, England',
  'manchester city': 'Manchester, England',
  'man city': 'Manchester, England',
  'liverpool': 'Liverpool, England',
  'liverpool fc': 'Liverpool, England',
  'chelsea': 'London, England',
  'chelsea fc': 'London, England',
  'arsenal': 'London, England',
  'arsenal fc': 'London, England',
  'tottenham': 'London, England',
  'tottenham hotspur': 'London, England',
  'spurs': 'London, England',
  'newcastle': 'Newcastle, England',
  'newcastle united': 'Newcastle, England',
  'brighton': 'Brighton, England',
  'brighton hove albion': 'Brighton, England',
  'brighton & hove albion': 'Brighton, England',
  'crystal palace': 'London, England',
  'fulham': 'London, England',
  'fulham fc': 'London, England',
  'west ham': 'London, England',
  'west ham united': 'London, England',
  'aston villa': 'Birmingham, England',
  'villa': 'Birmingham, England',
  'everton': 'Liverpool, England',
  'everton fc': 'Liverpool, England',
  'leicester': 'Leicester, England',
  'leicester city': 'Leicester, England',
  'leeds': 'Leeds, England',
  'leeds united': 'Leeds, England',
  'southampton': 'Southampton, England',
  'southampton fc': 'Southampton, England',
  'nottingham': 'Nottingham, England',
  'nottingham forest': 'Nottingham, England',
  'bournemouth': 'Bournemouth, England',
  'afc bournemouth': 'Bournemouth, England',
  'wolves': 'Wolverhampton, England',
  'wolverhampton': 'Wolverhampton, England',
  'wolverhampton wanderers': 'Wolverhampton, England',
  'brentford': 'London, England',
  'brentford fc': 'London, England',
  'ipswich': 'Ipswich, England',
  'ipswich town': 'Ipswich, England',

  // International Soccer
  'barcelona': 'Barcelona, Spain',
  'real madrid': 'Madrid, Spain',
  'atletico madrid': 'Madrid, Spain',
  'juventus': 'Turin, Italy',
  'ac milan': 'Milan, Italy',
  'inter milan': 'Milan, Italy',
  'psg': 'Paris, France',
  'paris saint-germain': 'Paris, France',
  'bayern munich': 'Munich, Germany',
  'dortmund': 'Dortmund, Germany',
  'ajax': 'Amsterdam, Netherlands',
  'psv': 'Eindhoven, Netherlands',
};

export class VenueExtractor {
  /**
   * Extract venue location from market data
   * Tries multiple strategies in order of reliability
   */
  static extractFromMarket(market) {
    if (!market) return null;

    // Strategy 1: Use pre-populated eventLocation if available
    if (market.eventLocation && typeof market.eventLocation === 'string') {
      const cleaned = market.eventLocation.trim();
      if (cleaned.length > 2 && !this.isSuspiciousLocation(cleaned)) {
        return cleaned;
      }
    }

    // Strategy 2: Try extracting from title (e.g., "NFL @ Miami", "Game in KC")
    const titleVenue = this.extractFromTitle(market.title);
    if (titleVenue) return titleVenue;

    // Strategy 3: Try extracting from description
    const descVenue = this.extractFromDescription(market.description);
    if (descVenue) return descVenue;

    // Strategy 4: Use teams data if available (team-to-city mapping)
    if (Array.isArray(market.teams) && market.teams.length > 0) {
      const teamVenue = this.extractFromTeams(market.teams);
      if (teamVenue) return teamVenue;
    }

    // Strategy 5: Try parsing eventType for location hints
    if (market.eventType) {
      const typeVenue = this.extractFromEventType(market.eventType);
      if (typeVenue) return typeVenue;
    }

    // Strategy 6: Parse location from tags if available
    if (Array.isArray(market.tags) && market.tags.length > 0) {
      const tagVenue = this.extractFromTags(market.tags);
      if (tagVenue) return tagVenue;
    }

    // No venue found
    return null;
  }

  /**
   * Extract venue from market title
   * Examples: "NFL @ Miami", "Will the KC game go to OT?"
   */
  static extractFromTitle(title) {
    if (!title || typeof title !== 'string') return null;

    const text = title.toLowerCase();

    // Try stadium extraction first (more specific)
    const stadiumVenue = this.extractStadium(text);
    if (stadiumVenue) return stadiumVenue;

    // Pattern: "@ CityName" (e.g., "@ Miami", "@ Kansas City")
    // More conservative: only match explicit locations after @
    // Must have @ symbol (not "at" word)
    const atMatch = text.match(/\s@\s+([a-z\s]+?)(?:\s+(?:game|match|vs|\?|win|play|nfl|nba|stadium|field))/i);
    if (atMatch) {
      const city = atMatch[1].trim();
      // Validate it's not stadium junk like "@Sofi" or "@Home"
      if (city.length > 3 && !city.match(/^(at|sofi|lambeau|arrowhead|home)/i)) {
        const normalized = this.normalizeCity(city);
        if (normalized && !this.isSuspiciousLocation(normalized)) {
          return normalized;
        }
      }
    }

    // Pattern: "in CityName" (e.g., "in Miami", "in Kansas City")
    // More conservative: avoid matching "in their", "in case", etc.
    const inMatch = text.match(/in\s+([a-z\s]+?)(?:\s+(?:game|match|vs|\?|win|matchup|against|on|at))/i);
    if (inMatch) {
      const city = inMatch[1].trim();
      // Skip bad matches like "their", "case", etc.
      if (city.length > 3 && !this.isJunkString(city)) {
        const normalized = this.normalizeCity(city);
        if (normalized && !this.isSuspiciousLocation(normalized)) {
          return normalized;
        }
      }
    }

    // Try to find city names directly in title (team-to-city mapping)
    // Return first match found
    for (const [team, city] of Object.entries(TEAM_CITY_MAP)) {
      if (text.includes(team)) {
        return city;
      }
    }

    return null;
  }

  /**
   * Extract stadium name from text and map to city
   */
  static extractStadium(text) {
    if (!text || typeof text !== 'string') return null;

    const lower = text.toLowerCase();

    // Look for stadium keywords with "at" prefix (most reliable)
    // But exclude "at home", "at the", "at your", etc.
    for (const [stadium, city] of Object.entries(STADIUM_CITY_MAP)) {
      if ((lower.includes(`at ${stadium}`) || lower.includes(`@${stadium}`)) && 
          !lower.match(/at\s+(home|the|your|their|a|an)\s/)) {
        return city;
      }
    }

    // Look for stadium name anywhere in text
    // But only if it's clearly a known stadium, not just a word
    for (const [stadium, city] of Object.entries(STADIUM_CITY_MAP)) {
      if (lower.includes(stadium)) {
        // Make sure it's a real stadium match, not just part of another word
        const pattern = new RegExp(`\\b${stadium}\\b`, 'i');
        if (pattern.test(lower)) {
          return city;
        }
      }
    }

    return null;
  }

  /**
   * Extract venue from market description
   */
  static extractFromDescription(description) {
    if (!description || typeof description !== 'string') return null;

    const text = description.toLowerCase();

    // Check for junk strings first
    for (const junk of JUNK_STRINGS) {
      if (text.startsWith(junk)) {
        return null; // Description starts with legal junk, skip it
      }
    }

    // Try stadium extraction in description
    const stadiumVenue = this.extractStadium(text);
    if (stadiumVenue) return stadiumVenue;

    // Look for patterns like "in Miami", "at Kansas City", "New York game"
    const patterns = [
      /(?:in|at)\s+([A-Za-z\s]+?)(?:\s+on\s|\s+at\s|\?|$)/,
      /([A-Za-z\s]+?)\s+(?:stadium|arena|field|court|track)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const city = match[1].trim();
        
        // Skip if it's junk
        if (this.isJunkString(city)) {
          continue;
        }

        const normalized = this.normalizeCity(city);
        if (normalized) return normalized;
      }
    }

    // Look for team names
    for (const [team, city] of Object.entries(TEAM_CITY_MAP)) {
      if (text.includes(team)) {
        return city;
      }
    }

    return null;
  }

  /**
   * Check if extracted string is likely junk (not a real venue)
   */
  static isJunkString(str) {
    if (!str || str.length < 3) return true;

    const lower = str.toLowerCase();

    // Check against known junk strings
    for (const junk of JUNK_STRINGS) {
      if (lower.includes(junk)) {
        return true;
      }
    }

    // Words that indicate non-venue text
    const badPatterns = [
      /^(the|this|that|these|those|good|bad|will|shall|is|are|at|home|their|against)$/,
      /event/,
      /market/,
      /shall/,
      /outcome/,
      /legal/,
      /definition/,
      /case/,
      /terms/,
    ];

    for (const pattern of badPatterns) {
      if (pattern.test(lower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract venue from teams array
   * Uses team-to-city mapping (assumes home team is one of them)
   */
  static extractFromTeams(teams) {
    if (!Array.isArray(teams) || teams.length === 0) return null;

    for (const team of teams) {
      if (typeof team !== 'string') continue;

      const teamLower = team.toLowerCase();
      for (const [mappedTeam, city] of Object.entries(TEAM_CITY_MAP)) {
        if (teamLower.includes(mappedTeam)) {
          return city;
        }
      }
    }

    return null;
  }

  /**
   * Try to extract location hints from eventType
   * Examples: "NFL", "NBA", "Soccer" (too generic, but try harder context matching)
   */
  static extractFromEventType(eventType) {
    if (!eventType || typeof eventType !== 'string') return null;
    // eventType alone is usually too generic (NFL, NBA, etc.)
    // Return null and let other strategies handle it
    return null;
  }

  /**
   * Extract venue from market tags
   */
  static extractFromTags(tags) {
    if (!Array.isArray(tags)) return null;

    for (const tag of tags) {
      const tagText = typeof tag === 'string' ? tag : tag.label || tag.name || '';
      if (!tagText) continue;

      const normalized = this.normalizeCity(tagText.toLowerCase());
      if (normalized && !this.isSuspiciousLocation(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * Normalize city/location strings
   * Handles abbreviations, common variations
   */
  static normalizeCity(city) {
    if (!city || typeof city !== 'string') return null;

    const normalized = city.trim();

    // Filter out obviously bad values
    if (normalized.length < 2) return null;
    if (this.isSuspiciousLocation(normalized)) return null;
    if (this.isJunkString(normalized)) return null;

    // Handle common abbreviations
    const abbrevMap = {
      'ny': 'New York, NY',
      'la': 'Los Angeles, CA',
      'sf': 'San Francisco, CA',
      'dc': 'Washington, DC',
      'atl': 'Atlanta, GA',
      'chi': 'Chicago, IL',
      'bos': 'Boston, MA',
      'miami': 'Miami, FL',
      'denver': 'Denver, CO',
      'seattle': 'Seattle, WA',
      'phoenix': 'Phoenix, AZ',
      'vegas': 'Las Vegas, NV',
      'kc': 'Kansas City, MO',
    };

    const lower = normalized.toLowerCase();
    if (abbrevMap[lower]) return abbrevMap[lower];

    // Capitalize properly (e.g., "kansas city" -> "Kansas City")
    return normalized
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Check if a location string looks like placeholder/bad data
   */
  static isSuspiciousLocation(location) {
    const bad = [
      'unknown',
      'null',
      'undefined',
      'n/a',
      'na',
      'none',
      'test',
      'tba',
      'to be announced',
      'online',
      'virtual',
      'worldwide',
      'global',
      'at home',
      'home',
      'away',
      '',
    ];

    const lower = location.toLowerCase().trim();
    return bad.includes(lower) || lower.length < 2;
  }

  /**
   * Check if extracted venue is valid
   * Returns true if venue looks legitimate
   */
  static isValidVenue(venue) {
    return (
      venue &&
      typeof venue === 'string' &&
      venue.length > 2 &&
      !this.isSuspiciousLocation(venue)
    );
  }
}

// Export singleton instance for convenience
export const venueExtractor = new VenueExtractor();
