// Application-wide constants
export const APP_NAME = 'Fourcast';
export const VERSION = '0.1.0';

// API Configuration
export const API_TIMEOUT = 10000; // 10 seconds
export const DEFAULT_PAGE_SIZE = 20;

// Cache Durations (milliseconds)
export const SHORT_CACHE = 5 * 60 * 1000; // 5 minutes
export const MEDIUM_CACHE = 30 * 60 * 1000; // 30 minutes
export const LONG_CACHE = 24 * 60 * 60 * 1000; // 24 hours

// Weather Constants
export const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';
export const DEFAULT_LOCATION = 'Nairobi';

// Market Constants
export const MIN_VOLUME_THRESHOLD = 50000;
export const MAX_DAYS_TO_RESOLUTION = 14;

// Confidence Levels
export const CONFIDENCE_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

// Event Types
export const EVENT_TYPES = {
  SPORTS: 'Sports',
  WEATHER: 'Weather',
  POLITICS: 'Politics',
  ECONOMICS: 'Economics',
  ALL: 'all'
};