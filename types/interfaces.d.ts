// Common TypeScript interfaces and types

/**
 * Weather data interface
 */
export interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
    localtime: string;
  };
  current: {
    temp_c: number;
    temp_f: number;
    condition: {
      text: string;
      icon: string;
    };
    humidity: number;
    wind_mph: number;
    feelslike_f: number;
    vis_miles: number;
  };
  rateLimited?: boolean;
}

/**
 * Market data interface
 */
export interface Market {
  marketID: string;
  platform: string;
  title: string;
  description: string;
  location?: string;
  currentOdds: {
    yes: number;
    no: number;
  };
  volume24h?: number;
  liquidity?: number;
  tags?: string[];
  resolutionDate?: string;
  eventType?: string;
  teams?: string[];
  edgeScore?: number;
  confidence?: string;
  isWeatherSensitive?: boolean;
}

/**
 * Signal data interface
 */
export interface Signal {
  id: string;
  event_id: string;
  market_title: string;
  venue?: string;
  event_time?: number;
  market_snapshot_hash: string;
  ai_digest: string;
  confidence: string;
  odds_efficiency: number;
  author_address?: string;
  tx_hash?: string;
  timestamp: number;
}

/**
 * API Response interfaces
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

/**
 * User profile interface
 */
export interface UserProfile {
  address: string;
  username?: string;
  avatar?: string;
  reputation?: number;
  total_signals?: number;
  accuracy?: number;
}