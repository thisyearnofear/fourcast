// Polymarket Service for fetching live market data and placing orders
import axios from 'axios';

class PolymarketService {
  constructor() {
    this.baseURL = 'https://gamma-api.polymarket.com';
    this.clobBaseURL = 'https://clob.polymarket.com';
    this.cache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for market data
    this.marketDetailsCache = new Map();
    this.MARKET_DETAILS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for market details
  }

  // Generate cache key for markets
  generateCacheKey(location) {
    return `markets_${location}`;
  }

  // Check if cached data is valid
  getCachedMarkets(location) {
    const cacheKey = this.generateCacheKey(location);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // Cache market data
  setCachedMarkets(location, markets) {
    const cacheKey = this.generateCacheKey(location);
    this.cache.set(cacheKey, {
      data: markets,
      timestamp: Date.now()
    });
  }

  /**
   * Fetch all active markets from Polymarket
   * Optionally filter by tags (e.g., "Sports", "Politics")
   */
  async getAllMarkets(tags = null) {
    try {
      const params = {
        limit: 100,
        active: true,
        order: 'volume24h'
      };

      if (tags) {
        params.tags = Array.isArray(tags) ? tags.join(',') : tags;
      }

      const response = await axios.get(`${this.baseURL}/markets`, { params });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching all markets:', error.message);
      return [];
    }
  }

  /**
   * Search markets by location using optimized /events endpoint
   * IMPROVED: Uses /events endpoint for better structure and performance
   * Returns weather-sensitive markets filtered by volume threshold
   */
  async searchMarketsByLocation(location) {
    // Check cache first
    const cached = this.getCachedMarkets(location);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      // Use /events endpoint for better market structure
      const response = await axios.get(`${this.baseURL}/events`, {
        params: {
          limit: 100,
          closed: false, // Active only
          offset: 0
        }
      });

      let relevantMarkets = [];

      if (response.data?.events && Array.isArray(response.data.events)) {
        // Find events matching the location
        for (const event of response.data.events) {
          const eventTitle = event.title || '';
          const eventLoc = this.extractLocation(eventTitle);

          // Match location (case-insensitive)
          if (eventLoc && eventLoc.toLowerCase() === location.toLowerCase()) {
            // Add all markets from this event
            if (event.markets && Array.isArray(event.markets)) {
              relevantMarkets.push(...event.markets);
            }
          }
        }
      }

      // Filter by minimum volume ($50k) - ROADMAP requirement
      const highVolume = relevantMarkets.filter(m => {
        const vol = parseFloat(m.volume24h || m.volume || 0);
        return vol >= 50000;
      });

      const result = {
        markets: highVolume.slice(0, 20), // Top 20 relevant markets
        location,
        timestamp: new Date().toISOString(),
        totalFound: highVolume.length,
        cached: false,
        source: 'events_endpoint' // Track which method was used
      };

      // Cache the results (6 hours for distant events, handled by caller)
      this.setCachedMarkets(location, result);

      return result;
    } catch (error) {
      console.error('Error searching markets by location:', error.message);
      return {
        markets: [],
        location,
        error: error.message,
        timestamp: new Date().toISOString(),
        cached: false
      };
    }
  }

  /**
   * Get detailed market information including current odds, tick size, negRisk
   * CRITICAL for order placement - needed for validation
   */
  async getMarketDetails(marketID) {
    try {
      // Check cache first
      const cached = this.marketDetailsCache.get(marketID);
      if (cached && Date.now() - cached.timestamp < this.MARKET_DETAILS_CACHE_DURATION) {
        return cached.data;
      }

      const response = await axios.get(`${this.baseURL}/markets/${marketID}`);
      const marketData = response.data;

      // Enrich with trading metadata needed for orders
      const enrichedData = {
        ...marketData,
        tradingMetadata: {
          tickSize: marketData.tickSize || '0.001',
          negRisk: marketData.negRisk || false,
          chainId: 137 // Polygon
        }
      };

      // Cache it
      this.marketDetailsCache.set(marketID, {
        data: enrichedData,
        timestamp: Date.now()
      });

      return enrichedData;
    } catch (error) {
      console.error(`Error fetching market details for ${marketID}:`, error.message);
      return null;
    }
  }

  /**
   * Get the best opportunities - markets with high volume but potentially mispriced
   * This requires comparing AI-assessed probability vs actual odds
   */
  async getWeatherAdjustedOpportunities(weatherData, location) {
    try {
      const markets = await this.searchMarketsByLocation(location);

      if (!markets.markets || markets.markets.length === 0) {
        return {
          opportunities: [],
          message: 'No weather-sensitive markets found for this location'
        };
      }

      // Map markets to opportunities with basic pricing
      const opportunities = markets.markets.map(market => ({
        marketID: market.tokenID || market.id,
        title: market.title || market.question,
        description: market.description,
        tags: market.tags || [],
        currentOdds: {
          yes: market.yesPrice || market.bid,
          no: market.noPrice || market.ask,
        },
        volume24h: market.volume24h,
        liquidityBin: market.liquidity,
        resolution: market.resolutionDate || market.expiresAt,
        weatherRelevance: this.assessWeatherRelevance(market, weatherData)
      }));

      // Sort by volume and weather relevance
      opportunities.sort((a, b) => {
        const volumeDiff = (b.volume24h || 0) - (a.volume24h || 0);
        if (volumeDiff !== 0) return volumeDiff;
        return (b.weatherRelevance.score || 0) - (a.weatherRelevance.score || 0);
      });

      return {
        opportunities: opportunities.slice(0, 10),
        location,
        weatherContext: {
          temp: weatherData.current?.temp_f,
          condition: weatherData.current?.condition?.text,
          wind: weatherData.current?.wind_mph,
          humidity: weatherData.current?.humidity
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting weather-adjusted opportunities:', error.message);
      return {
        opportunities: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract location information from market title
   */
  extractLocation(marketTitle) {
    if (!marketTitle) return null;

    // Common city names and locations (deduplicated)
    const cityNames = [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 
      'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 
      'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 
      'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Nashville', 
      'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville', 
      'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 
      'Mesa', 'Kansas City', 'Atlanta', 'Long Beach', 'Colorado Springs', 
      'Raleigh', 'Miami', 'Virginia Beach', 'Omaha', 'Oakland', 'Minneapolis', 
      'Tulsa', 'Arlington', 'Tampa', 'New Orleans', 'Wichita', 'Cleveland', 
      'Bakersfield', 'Aurora', 'Anaheim', 'Honolulu', 'Santa Ana', 'Riverside', 
      'Corpus Christi', 'Lexington', 'Stockton', 'St. Louis', 'Saint Paul', 
      'Henderson', 'Pittsburgh', 'Cincinnati', 'Anchorage', 'Greensboro', 
      'Plano', 'Newark', 'Lincoln', 'Orlando', 'Irvine', 'Toledo', 'Jersey City', 
      'Chula Vista', 'Durham', 'Fort Wayne', 'St. Petersburg', 'Laredo', 
      'Buffalo', 'Madison', 'Lubbock', 'Chandler', 'Scottsdale', 'Reno', 
      'Glendale', 'Gilbert', 'Winston-Salem', 'North Las Vegas', 'Norfolk', 
      'Chesapeake', 'Garland', 'Irving', 'Hialeah', 'Fremont', 'Boise', 
      'Richmond', 'Baton Rouge', 'Des Moines', 'Spokane', 'Modesto', 'Fayetteville', 
      'Tacoma', 'Oxnard', 'Fontana', 'Montgomery', 'Moreno Valley', 
      'Shreveport', 'Yonkers', 'Akron', 'Huntington Beach', 'Little Rock', 
      'Augusta', 'Amarillo', 'Mobile', 'Grand Rapids', 'Salt Lake City', 
      'Tallahassee', 'Huntsville', 'Grand Prairie', 'Knoxville', 'Worcester', 
      'Newport News', 'Brownsville', 'Overland Park', 'Santa Clarita', 'Providence', 
      'Garden Grove', 'Chattanooga', 'Oceanside', 'Jackson', 'Fort Lauderdale', 
      'Santa Rosa', 'Port St. Lucie', 'Ontario', 'Vancouver', 'Tempe', 'Springfield', 
      'Lancaster', 'Eugene', 'Pembroke Pines', 'Salem', 'Cape Coral', 'Peoria', 
      'Sioux Falls', 'Elk Grove', 'Rockford', 'Palmdale', 'Corona', 
      'Salinas', 'Pomona', 'Pasadena', 'Joliet', 'Paterson', 
      'Torrance', 'Syracuse', 'Bridgeport', 'Hayward', 'Fort Collins', 'Escondido', 
      'Lakewood', 'Naperville', 'Dayton', 'Hollywood', 'Sunnyvale', 'Alexandria', 
      'Mesquite', 'Hampton', 'Orange', 'Savannah', 'Cary', 'Fullerton', 
      'Warren', 'Clarksville', 'McKinney', 'McAllen', 'New Haven', 'Sterling Heights', 
      'West Valley City', 'Columbia', 'Killeen', 'Topeka', 'Thousand Oaks', 
      'Cedar Rapids', 'Olathe', 'Elizabeth', 'Waco', 'Hartford', 'Visalia', 
      'Gainesville', 'Simi Valley', 'Stamford', 'Bellevue', 'Concord', 'Miramar', 
      'Coral Springs', 'Lafayette', 'Charleston', 'Carrollton', 'Roseville', 
      'Thornton', 'Beaumont', 'Allentown', 'Surprise', 'Evansville', 'Abilene', 
      'Frisco', 'Independence', 'Santa Clara', 'Vallejo', 'Victorville', 
      'Athens', 'Lansing', 'Ann Arbor', 'El Monte', 'Denton', 'Berkeley', 
      'Provo', 'Downey', 'Midland', 'Norman', 'Waterbury', 'Costa Mesa', 'Inglewood', 
      'Manchester', 'Murfreesboro', 'Elgin', 'Clearwater', 'Miami Gardens', 
      'Rochester', 'Pueblo', 'Lowell', 'Wilmington', 'Arvada', 'San Buenaventura', 
      'Westminster', 'West Covina', 'Gresham', 'Fargo', 'Norwalk', 'Carlsbad', 
      'Fairfield', 'Cambridge', 'Wichita Falls', 'High Point', 'Billings', 
      'Green Bay', 'Tyler', 'San Mateo', 'Lewisville', 'Davie', 'League City', 
      'Rialto', 'Yakima', 'Broken Arrow', 'Round Rock', 'West Palm Beach', 
      'Burbank', 'Arden-Arcade', 'Allen', 'El Cajon', 'Las Cruces', 
      'Renton', 'Daly City', 'Sparks', 'Nampa', 'South Bend', 
      'Dearborn', 'Livonia', 'Tuscaloosa', 'Vacaville', 'Brockton', 
      'Roswell', 'Beaverton', 'Quincy', 'Lawrence', 'Clovis', 
      'Macon', 'Santa Maria', 'Kenosha', 'Bellingham', 'Sandy Springs', 
      'Gary', 'Bend', 'Meridian', 'Mission Viejo', 'Longmont', 
      'Farmington Hills', 'Boulder', 'San Luis Obispo', 'Schaumburg', 'Kingsport', 
      'Lynn', 'Redding', 'New Bedford', 'Chico', 'Camden', 'South Gate', 
      'San Angelo', 'Portsmouth', 'Temecula', 'Carmel', 'Bloomington', 
      'Warner Robins', 'Somerville', 'Janesville', 'Champaign', 
      'Alhambra', 'Chino', 'Davis', 'Redwood City', 'Nashua', 'Bethlehem', 
      'Lakeland', 'Reading', 'Antioch', 'Hawthorne', 
      'Whittier', 'Greeley', 'Citrus Heights', 'Petaluma', 
      'Flint', 'Waukegan', 'Merced', 
      'Kalamazoo', 'Cranston', 'Parma', 
      'Gilroy', 'Pasco', 'Pompano Beach', 
      'St. Clair Shores', 'Rockville', 'Trenton', 'Compton', 'Bossier City', 
      'Dearborn Heights', 'Lawton', 'Vineland', 'Suffolk', 'Waukesha', 
      'Mount Pleasant', 'Berwyn', 'Bowie', 'Evanston', 'Cypress', 
      'Coeur d\'Alene', 'Seaside', 'Hillsboro', 'North Lauderdale', 'Mishawaka', 
      'Silver Spring', 'Dale City', 'Sherman', 'Kendall', 'Orem', 
      'Boca Raton', 'Lynnwood', 'Southfield', 'New Britain', 
      'Chino Hills', 'Redlands', 
      'Decatur', 'Hammond', 'Haverhill', 'Plantation', 'San Leandro', 'Rocky Mount', 
      'Wheaton', 'Glen Burnie', 'Fort Smith', 'Bayonne', 'Kokomo', 
      'Lees Summit', 'Harlingen', 'Dubuque', 'Casper', 'Scranton', 'Pine Hills', 
      'Livermore', 'Plymouth', 'Riverton', 'Kirkland', 'Owensboro', 
      'Johns Creek', 'Beloit', 
      'Union City', 'Annandale', 
      'Ellicott City', 'Apple Valley', 'Largo', 'Wyoming', 'Redmond', 'Yuba City', 
      'Baldwin Park', 'West Des Moines', 'Greenwood', 'Gastonia', 'San Ramon', 
      'Cheyenne', 'New Braunfels', 'Medford', 'Port Arthur', 
      'St. Charles', 'Rancho Cordova', 'St. Cloud', 'Carson', 
      'Yorba Linda', 'Palm Bay', 'Cupertino', 'Cathedral City', 
      'Bentonville', 'Albany', 'Sammamish', 'Pleasanton', 'Benton Harbor', 
      'Florence', 'Fall River', 'Cicero', 'Palm Coast', 'Avondale', 
      'Glenview', 'Marietta', 'Homestead', 'Troy', 'Farmers Branch', 
      'Spring Hill', 'Casas Adobes', 'Temple', 'Keller', 'Grand Junction', 
      'West Allis', 'Waltham', 'Pawtucket', 'Pico Rivera', 
      'West Sacramento', 'North Charleston', 'Bismarck', 'Blaine', 
      'Longview', 'Caldwell', 'Cedar Park', 'Corvallis', 
      'The Woodlands', 'League City', 
      'Buena Park', 'Mission', 'Prescott Valley', 'Terre Haute', 
      'Hoboken', 'Palm Beach Gardens', 
      'Brooklyn Park', 'Richland', 
      'Fishers', 
      'Manteca', 'Bolingbrook', 'Lehi', 'Beavercreek', 'El Dorado Hills', 
      'Pearland', 'Lynwood', 'Mountain View', 
      'Norwalk', 'Rancho Cucamonga', 'St. Peters', 'Milpitas', 
      'Franklin', 'Kennewick', 'Biloxi', 'Newton', 
      'San Bruno', 'Greenville', 'Wausau', 'Westfield', 
      'Hendersonville', 'Perris', 'Rocklin', 'Goodyear', 'Doral', 
      'Brentwood', 
      'Watsonville', 'Palm Desert', 'West Haven', 
      'Lawrence', 'Edinburg', 
      'Minnetonka', 
      'Flagstaff', 'Euless', 'North Miami', 'Eden Prairie', 'Grand Forks', 
      'Sandusky', 'Fond du Lac', 'Colonial Heights', 'Everett', 
      'East Lansing', 'Bristol', 
      'Hazleton', 'East Providence', 
      'Manhattan', 
      'Miami Beach', 'Coon Rapids', 
      'Lakeville', 'Bowling Green', 
      'Rapid City', 
      'Buffalo Grove', 
      'Winter Haven', 'Middletown', 
      'Weymouth', 
      'Grand Island', 
      'Carbondale', 
      'Cleveland Heights', 
      'Stillwater'
    ];

    // Check for city names in the market title
    for (const city of cityNames) {
      if (marketTitle.toLowerCase().includes(city.toLowerCase())) {
        return city;
      }
    }

    // Check for state names as fallback
    const stateNames = [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 
      'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 
      'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 
      'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 
      'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 
      'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
      'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 
      'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 
      'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
    ];

    for (const state of stateNames) {
      if (marketTitle.toLowerCase().includes(state.toLowerCase())) {
        return state;
      }
    }

    return null;
  }

  /**
   * Extract detailed metadata from market title including teams and venues
   */
  extractMarketMetadata(marketTitle) {
    if (!marketTitle) return {};

    const metadata = {
      location: this.extractLocation(marketTitle),
      teams: [],
      event_type: null,
      venue: null
    };

    // Common sports teams
    const teamPatterns = [
      // NFL Teams
      { pattern: /bills|buffalo bills/i, team: 'Buffalo Bills', sport: 'NFL' },
      { pattern: /dolphins|miami dolphins/i, team: 'Miami Dolphins', sport: 'NFL' },
      { pattern: /patriots|new england patriots/i, team: 'New England Patriots', sport: 'NFL' },
      { pattern: /jets|new york jets/i, team: 'New York Jets', sport: 'NFL' },
      { pattern: /ravens|baltimore ravens/i, team: 'Baltimore Ravens', sport: 'NFL' },
      { pattern: /bengals|cincinnati bengals/i, team: 'Cincinnati Bengals', sport: 'NFL' },
      { pattern: /browns|cleveland browns/i, team: 'Cleveland Browns', sport: 'NFL' },
      { pattern: /steelers|pittsburgh steelers/i, team: 'Pittsburgh Steelers', sport: 'NFL' },
      { pattern: /texans|houston texans/i, team: 'Houston Texans', sport: 'NFL' },
      { pattern: /colts|indianapolis colts/i, team: 'Indianapolis Colts', sport: 'NFL' },
      { pattern: /jaguars|jacksonville jaguars/i, team: 'Jacksonville Jaguars', sport: 'NFL' },
      { pattern: /titans|tennessee titans/i, team: 'Tennessee Titans', sport: 'NFL' },
      { pattern: /broncos|denver broncos/i, team: 'Denver Broncos', sport: 'NFL' },
      { pattern: /chiefs|kansas city chiefs/i, team: 'Kansas City Chiefs', sport: 'NFL' },
      { pattern: /raiders|las vegas raiders/i, team: 'Las Vegas Raiders', sport: 'NFL' },
      { pattern: /chargers|los angeles chargers/i, team: 'Los Angeles Chargers', sport: 'NFL' },
      { pattern: /cowboys|dallas cowboys/i, team: 'Dallas Cowboys', sport: 'NFL' },
      { pattern: /giants|new york giants/i, team: 'New York Giants', sport: 'NFL' },
      { pattern: /eagles|philadelphia eagles/i, team: 'Philadelphia Eagles', sport: 'NFL' },
      { pattern: /washington|washington commanders/i, team: 'Washington Commanders', sport: 'NFL' },
      { pattern: /bears|chicago bears/i, team: 'Chicago Bears', sport: 'NFL' },
      { pattern: /lions|detroit lions/i, team: 'Detroit Lions', sport: 'NFL' },
      { pattern: /packers|green bay packers/i, team: 'Green Bay Packers', sport: 'NFL' },
      { pattern: /vikings|minnesota vikings/i, team: 'Minnesota Vikings', sport: 'NFL' },
      { pattern: /falcons|atlanta falcons/i, team: 'Atlanta Falcons', sport: 'NFL' },
      { pattern: /panthers|carolina panthers/i, team: 'Carolina Panthers', sport: 'NFL' },
      { pattern: /saints|new orleans saints/i, team: 'New Orleans Saints', sport: 'NFL' },
      { pattern: /buccaneers|tampa bay buccaneers/i, team: 'Tampa Bay Buccaneers', sport: 'NFL' },
      { pattern: /cardinals|arizona cardinals/i, team: 'Arizona Cardinals', sport: 'NFL' },
      { pattern: /rams|los angeles rams/i, team: 'Los Angeles Rams', sport: 'NFL' },
      { pattern: /49ers|san francisco 49ers/i, team: 'San Francisco 49ers', sport: 'NFL' },
      { pattern: /seahawks|seattle seahawks/i, team: 'Seattle Seahawks', sport: 'NFL' },

      // NBA Teams
      { pattern: /celtics|boston celtics/i, team: 'Boston Celtics', sport: 'NBA' },
      { pattern: /nets|brooklyn nets/i, team: 'Brooklyn Nets', sport: 'NBA' },
      { pattern: /knicks|new york knicks/i, team: 'New York Knicks', sport: 'NBA' },
      { pattern: /76ers|philadelphia 76ers/i, team: 'Philadelphia 76ers', sport: 'NBA' },
      { pattern: /raptors|toronto raptors/i, team: 'Toronto Raptors', sport: 'NBA' },
      { pattern: /bulls|chicago bulls/i, team: 'Chicago Bulls', sport: 'NBA' },
      { pattern: /cavaliers|cleveland cavaliers/i, team: 'Cleveland Cavaliers', sport: 'NBA' },
      { pattern: /pistons|detroit pistons/i, team: 'Detroit Pistons', sport: 'NBA' },
      { pattern: /pacers|indiana pacers/i, team: 'Indiana Pacers', sport: 'NBA' },
      { pattern: /bucks|milwaukee bucks/i, team: 'Milwaukee Bucks', sport: 'NBA' },
      { pattern: /hawks|atlanta hawks/i, team: 'Atlanta Hawks', sport: 'NBA' },
      { pattern: /hornets|charlotte hornets/i, team: 'Charlotte Hornets', sport: 'NBA' },
      { pattern: /heat|miami heat/i, team: 'Miami Heat', sport: 'NBA' },
      { pattern: /magic|orlando magic/i, team: 'Orlando Magic', sport: 'NBA' },
      { pattern: /wizards|washington wizards/i, team: 'Washington Wizards', sport: 'NBA' },
      { pattern: /nuggets|denver nuggets/i, team: 'Denver Nuggets', sport: 'NBA' },
      { pattern: /timberwolves|minnesota timberwolves/i, team: 'Minnesota Timberwolves', sport: 'NBA' },
      { pattern: /thunder|oklahoma city thunder/i, team: 'Oklahoma City Thunder', sport: 'NBA' },
      { pattern: /blazers|portland trail blazers/i, team: 'Portland Trail Blazers', sport: 'NBA' },
      { pattern: /jazz|utah jazz/i, team: 'Utah Jazz', sport: 'NBA' },
      { pattern: /warriors|golden state warriors/i, team: 'Golden State Warriors', sport: 'NBA' },
      { pattern: /clippers|los angeles clippers/i, team: 'Los Angeles Clippers', sport: 'NBA' },
      { pattern: /lakers|los angeles lakers/i, team: 'Los Angeles Lakers', sport: 'NBA' },
      { pattern: /suns|phoenix suns/i, team: 'Phoenix Suns', sport: 'NBA' },
      { pattern: /kings|sacramento kings/i, team: 'Sacramento Kings', sport: 'NBA' },
      { pattern: /mavericks|dallas mavericks/i, team: 'Dallas Mavericks', sport: 'NBA' },
      { pattern: /rockets|houston rockets/i, team: 'Houston Rockets', sport: 'NBA' },
      { pattern: /grizzlies|memphis grizzlies/i, team: 'Memphis Grizzlies', sport: 'NBA' },
      { pattern: /pelicans|new orleans pelicans/i, team: 'New Orleans Pelicans', sport: 'NBA' },
      { pattern: /spurs|san antonio spurs/i, team: 'San Antonio Spurs', sport: 'NBA' },

      // MLB Teams
      { pattern: /diamondbacks|arizona diamondbacks/i, team: 'Arizona Diamondbacks', sport: 'MLB' },
      { pattern: /braves|atlanta braves/i, team: 'Atlanta Braves', sport: 'MLB' },
      { pattern: /orioles|baltimore orioles/i, team: 'Baltimore Orioles', sport: 'MLB' },
      { pattern: /red sox|boston red sox/i, team: 'Boston Red Sox', sport: 'MLB' },
      { pattern: /cubs|chicago cubs/i, team: 'Chicago Cubs', sport: 'MLB' },
      { pattern: /white sox|chicago white sox/i, team: 'Chicago White Sox', sport: 'MLB' },
      { pattern: /reds|cincinnati reds/i, team: 'Cincinnati Reds', sport: 'MLB' },
      { pattern: /indians|cleveland indians|guardians|cleveland guardians/i, team: 'Cleveland Guardians', sport: 'MLB' },
      { pattern: /rockies|colorado rockies/i, team: 'Colorado Rockies', sport: 'MLB' },
      { pattern: /tigers|detroit tigers/i, team: 'Detroit Tigers', sport: 'MLB' },
      { pattern: /astros|houston astros/i, team: 'Houston Astros', sport: 'MLB' },
      { pattern: /royals|kansas city royals/i, team: 'Kansas City Royals', sport: 'MLB' },
      { pattern: /angels|los angeles angels/i, team: 'Los Angeles Angels', sport: 'MLB' },
      { pattern: /dodgers|los angeles dodgers/i, team: 'Los Angeles Dodgers', sport: 'MLB' },
      { pattern: /marlins|miami marlins/i, team: 'Miami Marlins', sport: 'MLB' },
      { pattern: /brewers|milwaukee brewers/i, team: 'Milwaukee Brewers', sport: 'MLB' },
      { pattern: /twins|minnesota twins/i, team: 'Minnesota Twins', sport: 'MLB' },
      { pattern: /mets|new york mets/i, team: 'New York Mets', sport: 'MLB' },
      { pattern: /yankees|new york yankees/i, team: 'New York Yankees', sport: 'MLB' },
      { pattern: /athletics|oakland athletics/i, team: 'Oakland Athletics', sport: 'MLB' },
      { pattern: /phillies|philadelphia phillies/i, team: 'Philadelphia Phillies', sport: 'MLB' },
      { pattern: /pirates|pittsburgh pirates/i, team: 'Pittsburgh Pirates', sport: 'MLB' },
      { pattern: /padres|san diego padres/i, team: 'San Diego Padres', sport: 'MLB' },
      { pattern: /giants|san francisco giants/i, team: 'San Francisco Giants', sport: 'MLB' },
      { pattern: /mariners|seattle mariners/i, team: 'Seattle Mariners', sport: 'MLB' },
      { pattern: /cardinals|st louis cardinals/i, team: 'St. Louis Cardinals', sport: 'MLB' },
      { pattern: /rays|tampa bay rays/i, team: 'Tampa Bay Rays', sport: 'MLB' },
      { pattern: /rangers|texas rangers/i, team: 'Texas Rangers', sport: 'MLB' },
      { pattern: /blue jays|toronto blue jays/i, team: 'Toronto Blue Jays', sport: 'MLB' },
      { pattern: /nationals|washington nationals/i, team: 'Washington Nationals', sport: 'MLB' }
    ];

    // Extract teams
    for (const { pattern, team, sport } of teamPatterns) {
      if (pattern.test(marketTitle)) {
        metadata.teams.push({ name: team, sport });
      }
    }

    // Determine event type based on teams or keywords
    if (metadata.teams.length > 0) {
      metadata.event_type = metadata.teams[0].sport;
    } else if (/nfl|football/i.test(marketTitle)) {
      metadata.event_type = 'NFL';
    } else if (/nba|basketball/i.test(marketTitle)) {
      metadata.event_type = 'NBA';
    } else if (/mlb|baseball/i.test(marketTitle)) {
      metadata.event_type = 'MLB';
    } else if (/nhl|hockey/i.test(marketTitle)) {
      metadata.event_type = 'NHL';
    } else if (/marathon|race/i.test(marketTitle)) {
      metadata.event_type = 'Marathon';
    } else if (/golf|pga/i.test(marketTitle)) {
      metadata.event_type = 'Golf';
    } else if (/tennis|wimbledon|open/i.test(marketTitle)) {
      metadata.event_type = 'Tennis';
    }

    return metadata;
  }

  /**
   * Assess how relevant weather is to a given market
   * IMPROVED: Now uses actual weather conditions from weatherData parameter
   * Returns both relevance score and weather context for analysis
   */
  assessWeatherRelevance(market, weatherData) {
    const title = (market.title || market.question || '').toLowerCase();
    const description = (market.description || '').toLowerCase();

    // Extract actual weather conditions if available
    const currentTemp = weatherData?.current?.temp_f;
    const currentCondition = (weatherData?.current?.condition?.text || '').toLowerCase();
    const precipChance = weatherData?.current?.precip_chance || weatherData?.current?.precip_prob || 0;
    const windSpeed = weatherData?.current?.wind_mph;
    const humidity = weatherData?.current?.humidity;

    // Score based on both market keywords AND actual weather conditions
    const weatherImpactFactors = {
      outdoor: (title.includes('outdoor') || title.includes('marathon')) ? 2 : 0,
      wind: (
        title.includes('wind') || 
        title.includes('sail') || 
        (windSpeed && windSpeed > 15)
      ) ? 2 : 0,
      precipitation: (
        title.includes('rain') || 
        title.includes('snow') || 
        (precipChance && precipChance > 30) ||
        currentCondition.includes('rain') ||
        currentCondition.includes('snow')
      ) ? 2 : 0,
      temperature: (
        title.includes('temperature') || 
        title.includes('cold') || 
        title.includes('heat') ||
        (currentTemp && (currentTemp < 45 || currentTemp > 85))
      ) ? 1.5 : 0,
      sports: ['nfl', 'nba', 'golf', 'tennis', 'baseball', 'soccer', 'cricket'].some(
        sport => title.includes(sport)
      ) ? 1 : 0,
      weather_word: title.includes('weather') ? 3 : 0,
      // New: Factor for when weather conditions match market keywords
      condition_match: (
        (precipChance && precipChance > 30) && (title.includes('rain') || title.includes('snow')) ? 1 : 0
      )
    };

    const score = Object.values(weatherImpactFactors).reduce((a, b) => a + b, 0);

    return {
      score: Math.min(score, 10),
      factors: weatherImpactFactors,
      isWeatherSensitive: score > 0,
      // Include weather context for AI analysis (new in roadmap Phase 2)
      weatherContext: {
        temp: currentTemp,
        condition: currentCondition,
        precipChance: precipChance,
        windSpeed: windSpeed,
        humidity: humidity,
        hasData: !!(weatherData?.current)
      }
    };
  }

  /**
   * Get market price history (if available via API)
   */
  async getMarketHistory(marketID) {
    try {
      const response = await axios.get(`${this.baseURL}/markets/${marketID}/history`, {
        params: { limit: 100 }
      });
      return response.data;
    } catch (error) {
      console.debug('Market history not available:', error.message);
      return null;
    }
  }

  /**
   * Build order object for CLOB client
   * Validates all required fields before sending to blockchain
   */
  buildOrderObject(marketData, price, side, size, feeRateBps = 0) {
    try {
      if (!marketData?.id && !marketData?.tokenID) {
        throw new Error('Market ID is required');
      }

      const tokenID = marketData.id || marketData.tokenID;
      const tradingMetadata = marketData.tradingMetadata || {
        tickSize: '0.001',
        negRisk: false,
        chainId: 137
      };

      // Validate price is within tick size precision
      const tickSize = parseFloat(tradingMetadata.tickSize);
      if (price % tickSize !== 0) {
        console.warn(`Price ${price} not aligned with tick size ${tickSize}`);
      }

      return {
        tokenID,
        price: parseFloat(price),
        side: side.toUpperCase(),
        size: parseFloat(size),
        feeRateBps: parseInt(feeRateBps),
        metadata: {
          tickSize: tradingMetadata.tickSize,
          negRisk: tradingMetadata.negRisk
        }
      };
    } catch (error) {
      console.error('Order building error:', error.message);
      throw error;
    }
  }

  /**
   * Validate order before submission
   * Checks market exists, price in valid range, sufficient size
   */
  async validateOrder(orderData) {
    try {
      const { marketID, price, side, size } = orderData;

      if (!marketID || price === undefined || !side || !size) {
        throw new Error('Missing required order fields');
      }

      if (price < 0 || price > 1) {
        throw new Error('Price must be between 0 and 1');
      }

      if (size <= 0) {
        throw new Error('Size must be greater than 0');
      }

      // Fetch market details to verify it exists
      const marketData = await this.getMarketDetails(marketID);
      if (!marketData) {
        throw new Error(`Market ${marketID} not found`);
      }

      return {
        valid: true,
        marketData
      };
    } catch (error) {
      console.error('Order validation error:', error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate order cost (price * size) + fees
   * Useful for UX: show "You will spend X USDC"
   */
  calculateOrderCost(price, size, feeRateBps = 0) {
    const baseCost = price * size;
    const fee = baseCost * (feeRateBps / 10000);
    return {
      baseCost: baseCost.toFixed(2),
      fee: fee.toFixed(2),
      total: (baseCost + fee).toFixed(2)
    };
  }

  /**
   * Get order metadata for display
   */
  getOrderMetadata(order, marketData) {
    return {
      market: marketData?.title || 'Unknown Market',
      side: order.side,
      size: order.size,
      price: order.price,
      cost: this.calculateOrderCost(order.price, order.size, order.feeRateBps),
      tokenID: order.tokenID,
      tradingMetadata: marketData?.tradingMetadata
    };
  }

  /**
   * Get status of Polymarket service
   */
  getStatus() {
    return {
      service: 'Polymarket Data & Trading Service',
      available: true,
      markets: {
        cache: this.cache.size,
        duration: `${this.CACHE_DURATION / (60 * 1000)} minutes`
      },
      marketDetails: {
        cache: this.marketDetailsCache.size,
        duration: `${this.MARKET_DETAILS_CACHE_DURATION / (60 * 1000)} minutes`
      },
      baseURL: this.baseURL,
      clobBaseURL: this.clobBaseURL
    };
  }
}

// Export singleton instance
export const polymarketService = new PolymarketService();
export default polymarketService;
