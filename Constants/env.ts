// export const BASE_API_URL = "http://easyhomz.co.uk/mapp";

export const BASE_API_URL = "http://192.168.1.17:8000/api/mapp";

export const JOB_TYPES_CACHE_KEY = "jobTypesCache";

export const JOB_TYPES_CACHE_EXPIRY = 3600000; // 1 hour in milliseconds

export const SYNC_EVENTS = {
  SYNC_STARTED: "sync_started",
  SYNC_COMPLETED: "sync_completed",
  SYNC_FAILED: "sync_failed",
  PENDING_COUNT_UPDATED: "pending_count_updated",
};

// Cache control constants
export const CACHE_CONFIG = {
  // How long each cache type is considered fresh (in milliseconds)
  FRESHNESS_DURATION: {
    JOB_TYPES: 15 * 60 * 1000, // 15 minutes
    JOBS: 5 * 60 * 1000, // 5 minutes
    CATEGORIES: 30 * 60 * 1000, // 30 minutes
    FILES: 10 * 60 * 1000, // 10 minutes
  },
  // Initial delay before prefetching data
  INITIAL_PREFETCH_DELAY: 1000, // 1 second
  // Minimum time between prefetch attempts
  THROTTLE_INTERVAL: 10000, // 10 seconds
};
