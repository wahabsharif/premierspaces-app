/**
 * API Control utilities to manage API request behavior
 */
import { enableApiThrottling, resetApiThrottling } from "./apiThrottler";

// Global flag to track if background updates are enabled
let backgroundUpdatesEnabled = false;

// Initialize with throttling enabled by default
enableApiThrottling();

/**
 * Disables all background API updates across the app
 */
export const disableBackgroundUpdates = () => {
  backgroundUpdatesEnabled = false;
  console.log("[apiControl] Background updates disabled");
};

/**
 * Enables background API updates across the app
 */
export const enableBackgroundUpdates = () => {
  backgroundUpdatesEnabled = true;
  console.log("[apiControl] Background updates enabled");
};

/**
 * Returns the current background update state
 */
export const getBackgroundUpdateState = () => {
  return backgroundUpdatesEnabled;
};

/**
 * Returns fetch parameters with background updates disabled for jobs slice
 * @param baseParams - Base parameters for the fetch call
 */
export const withoutBackgroundUpdates = (
  baseParams: Record<string, any> = {}
) => {
  // Reset API throttling registry to ensure we can make fresh initial calls
  resetApiThrottling();

  // Only include valid properties for each slice
  return {
    ...baseParams,
    // These properties will be used by the jobSlice only
    force: true,
    // Include a timestamp to ensure the request is treated as unique
    _timestamp: Date.now(),
  };
};

/**
 * Get the current controls state for debugging
 */
export const getApiControlDebugState = () => {
  return {
    backgroundUpdatesEnabled,
    timestamp: Date.now(),
  };
};
