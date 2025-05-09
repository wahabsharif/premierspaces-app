// export const BASE_API_URL = "http://easyhomz.co.uk/mapp";

export const BASE_API_URL = "http://192.168.1.15:8000/api/mapp";

export const JOB_TYPES_CACHE_KEY = "jobTypesCache";

export const JOB_TYPES_CACHE_EXPIRY = 3600000; // 1 hour in milliseconds

export const SYNC_EVENTS = {
  SYNC_STARTED: "sync_started",
  SYNC_COMPLETED: "sync_completed",
  SYNC_FAILED: "sync_failed",
  PENDING_COUNT_UPDATED: "pending_count_updated",
};
