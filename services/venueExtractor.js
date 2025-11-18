/**
 * Venue Extractor Service
 * 
 * Extracts event venue/location from Polymarket data.
 * Attempts multiple strategies to find the actual location where an event occurs.
 * Used by /ai page to fetch weather at event locations (not user location).
 */

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

  // Soccer/EPL
  'manchester united': 'Manchester, England',
  'man united': 'Manchester, England',
  'manchester city': 'Manchester, England',
  'man city': 'Manchester, England',
  'liverpool': 'Liverpool, England',
  'chelsea': 'London, England',
  'arsenal': 'London, England',
  'tottenham': 'London, England',
  'spurs': 'London, England',
  'newcastle': 'Newcastle, England',
  'brighton': 'Brighton, England',
  'crystal palace': 'London, England',
  'fulham': 'London, England',
  'west ham': 'London, England',
  'aston villa': 'Birmingham, England',
  'everton': 'Liverpool, England',
  'leicester': 'Leicester, England',
  'leeds': 'Leeds, England',
  'southampton': 'Southampton, England',
  'nottingham': 'Nottingham, England',
  'bournemouth': 'Bournemouth, England',
  'wolves': 'Wolverhampton, England',
  'wolverhampton': 'Wolverhampton, England',
  'brentford': 'London, England',

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

    // Pattern: "@ CityName" (e.g., "@ Miami", "@ Kansas City")
    const atMatch = text.match(/@\s+([a-z\s]+?)(?:\s+(?:game|match|vs|\?|win|play))/i);
    if (atMatch) {
      const city = atMatch[1].trim();
      return this.normalizeCity(city);
    }

    // Pattern: "in CityName" (e.g., "in Miami", "in Kansas City")
    const inMatch = text.match(/in\s+([a-z\s]+?)(?:\s+(?:game|match|vs|\?|win))/i);
    if (inMatch) {
      const city = inMatch[1].trim();
      return this.normalizeCity(city);
    }

    // Try to find city names directly in title
    for (const [team, city] of Object.entries(TEAM_CITY_MAP)) {
      if (text.includes(team)) {
        return city;
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

    // Look for patterns like "in Miami", "at Kansas City", "New York game"
    const patterns = [
      /(?:in|at)\s+([A-Za-z\s]+?)(?:\s+on\s|\s+at\s|\?|$)/,
      /([A-Za-z\s]+?)\s+(?:stadium|arena|field|court|track)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const city = match[1].trim();
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
