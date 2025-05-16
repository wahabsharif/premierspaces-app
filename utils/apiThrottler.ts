/**
 * API Throttler - Prevents excessive API calls to the same endpoints
 */

// Store the last time each endpoint was called
const apiCallRegistry: Record<string, number> = {};

// Global settings
const DEFAULT_THROTTLE_MS = 20000; // 20 seconds between same API calls
let globalThrottlingEnabled = true;

/**
 * Determine if an API call should be allowed based on throttling rules
 * @param endpoint - The API endpoint being called
 * @param minInterval - Minimum time in ms between calls to the same endpoint
 * @returns boolean - Whether the call should be allowed
 */
export const shouldAllowApiCall = (
  endpoint: string,
  minInterval: number = DEFAULT_THROTTLE_MS
): boolean => {
  // Always allow if global throttling is disabled
  if (!globalThrottlingEnabled) return true;

  const now = Date.now();
  const lastCallTime = apiCallRegistry[endpoint] || 0;

  // Check if enough time has passed since the last call
  if (now - lastCallTime < minInterval) {
    console.log(`[apiThrottler] Blocking repeated call to ${endpoint}`);
    return false;
  }

  // Update the registry with the current time
  apiCallRegistry[endpoint] = now;
  return true;
};

/**
 * Register an API call that was made
 * @param endpoint - The API endpoint that was called
 */
export const registerApiCall = (endpoint: string): void => {
  apiCallRegistry[endpoint] = Date.now();
};

/**
 * Enable global API throttling
 */
export const enableApiThrottling = (): void => {
  globalThrottlingEnabled = true;
  console.log("[apiThrottler] Global API throttling enabled");
};

/**
 * Disable global API throttling
 */
export const disableApiThrottling = (): void => {
  globalThrottlingEnabled = false;
  console.log("[apiThrottler] Global API throttling disabled");
};

/**
 * Clear all API throttling records - use when you want to allow fresh calls
 */
export const resetApiThrottling = (): void => {
  Object.keys(apiCallRegistry).forEach((key) => {
    delete apiCallRegistry[key];
  });
  console.log("[apiThrottler] API throttling registry reset");
};

/**
 * Create a throttled fetch function that will prevent excessive calls
 * @param fetchFn The original fetch function
 * @returns A throttled version of the fetch function
 */
export const createThrottledFetch = (fetchFn: typeof fetch): typeof fetch => {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    // Get the URL as a string
    const url = typeof input === "string" ? input : input.toString();

    // Check if we should allow this call
    if (!shouldAllowApiCall(url)) {
      console.log(`[apiThrottler] Blocked fetch to: ${url}`);
      // Return a promise that resolves with a fake "throttled" response
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            message: "Request throttled by client",
            throttled: true,
          }),
          {
            status: 429, // Too Many Requests
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    }

    // If allowed, register the call and proceed
    registerApiCall(url);
    return fetchFn(input, init);
  };
};
