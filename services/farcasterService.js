import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

/**
 * Farcaster/Neynar Service
 * 
 * Encapsulates all Farcaster/Neynar API interactions for:
 * - Publishing casts (weather forecasts, market signals)
 * - Listening for mentions
 * - Fetching user data (wallet addresses, holdings)
 * 
 * Single source of truth for Neynar integration
 */

let neynarClient = null;

const getFarcasterClient = () => {
  if (!neynarClient) {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY not configured');
    }
    const config = new Configuration({ apiKey });
    neynarClient = new NeynarAPIClient(config);
  }
  return neynarClient;
};

/**
 * Publish a cast to Farcaster
 * @param {string} text - Cast content
 * @param {string} signerUuid - Approved signer UUID from Neynar
 * @param {Object} options - Additional options (embedUrl, imageUrl, etc.)
 * @returns {Promise<Object>} Cast response with hash and details
 */
export const publishCast = async (text, signerUuid, options = {}) => {
  try {
    if (!signerUuid) {
      throw new Error('Signer UUID required for publishing');
    }

    const client = getFarcasterClient();
    const payload = {
      text,
      signer_uuid: signerUuid,
    };

    // Optional: Add embeds if provided
    if (options.embedUrl || options.imageUrl) {
      payload.embeds = [{ url: options.embedUrl || options.imageUrl }];
    }

    const response = await client.publishCast(payload);
    return response;
  } catch (error) {
    console.error('Failed to publish cast:', error);
    throw error;
  }
};

/**
 * Fetch user information by username
 * @param {string} username - Farcaster username
 * @returns {Promise<Object>} User data including FID, wallet address, profile
 */
export const getUserByUsername = async (username) => {
  try {
    const client = getFarcasterClient();
    const response = await client.searchUser(username);
    return response.result?.users?.[0] || null;
  } catch (error) {
    console.error(`Failed to fetch user ${username}:`, error);
    throw error;
  }
};

/**
 * Fetch user information by FID
 * @param {number} fid - Farcaster ID
 * @returns {Promise<Object>} User data
 */
export const getUserByFID = async (fid) => {
  try {
    const client = getFarcasterClient();
    const response = await client.fetchUserByFid(fid);
    return response.result?.user || null;
  } catch (error) {
    console.error(`Failed to fetch user FID ${fid}:`, error);
    throw error;
  }
};

/**
 * Extract wallet address from user
 * @param {Object} user - User object from Neynar API
 * @returns {string|null} Ethereum address if available
 */
export const getUserWalletAddress = (user) => {
  if (!user) return null;
  // Neynar provides verified addresses and custody addresses
  return user.verified_accounts?.find(a => a.platform === 'ethereum')?.address ||
         user.custody_address ||
         null;
};

/**
 * Format weather data as a cast
 * @param {Object} weatherData - Weather data from weatherService
 * @param {string} location - Location name
 * @returns {string} Formatted cast text
 */
export const formatWeatherCast = (weatherData, location) => {
  if (!weatherData?.current) {
    return `🌍 No weather data available for ${location}`;
  }

  const { current, forecast } = weatherData;
  const temp = Math.round(current.temp_f);
  const condition = current.condition.text;
  const humidity = current.humidity;
  const wind = Math.round(current.wind_mph);

  // Tomorrow's forecast
  const tomorrow = forecast?.forecastday?.[1];
  const tomorrowHigh = tomorrow ? Math.round(tomorrow.day.maxtemp_f) : '?';
  const tomorrowCondition = tomorrow?.day?.condition?.text || 'Unknown';

  return `🌤️ Weather Alert: ${location}

Current: ${temp}°F, ${condition}
Humidity: ${humidity}%
Wind: ${wind} mph

Tomorrow: ${tomorrowHigh}°F, ${tomorrowCondition}

#weather #fourcast`;
};

/**
 * Format market signal as a cast
 * @param {Object} signal - Market signal object
 * @returns {string} Formatted cast text
 */
export const formatSignalCast = (signal) => {
  const { market, direction, confidence, reason } = signal;
  
  return `📊 Market Signal: ${market}

Direction: ${direction.toUpperCase()}
Confidence: ${(confidence * 100).toFixed(0)}%
Reason: ${reason}

Trade with caution. DYOR.
#markets #signals #fourcast`;
};

/**
 * Validate signer UUID (by checking if it can be used)
 * @param {string} signerUuid - Signer UUID to validate
 * @returns {Promise<boolean>} Whether signer is valid and approved
 */
export const validateSigner = async (signerUuid) => {
  try {
    if (!signerUuid) return false;
    
    const client = getFarcasterClient();
    // Attempt to get signer details
    const response = await client.fetchSigner(signerUuid);
    return response?.result?.signer?.status === 'approved';
  } catch (error) {
    console.warn(`Signer validation failed for ${signerUuid}:`, error.message);
    return false;
  }
};

/**
 * Get cast data by hash
 * @param {string} castHash - Cast hash
 * @returns {Promise<Object>} Cast object with engagement data
 */
export const getCastByHash = async (castHash) => {
  try {
    const client = getFarcasterClient();
    const response = await client.lookUpCastByHashUrl(castHash);
    return response.result?.cast || null;
  } catch (error) {
    console.error(`Failed to fetch cast ${castHash}:`, error);
    throw error;
  }
};

export const farcasterService = {
  publishCast,
  getUserByUsername,
  getUserByFID,
  getUserWalletAddress,
  formatWeatherCast,
  formatSignalCast,
  validateSigner,
  getCastByHash,
};

export default farcasterService;
