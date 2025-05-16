import { useCallback, useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";

/**
 * Simple debounce function to prevent rapid repeated calls
 */
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
};

/**
 * Custom hook to run a callback when screen comes into focus,
 * with optimized performance to show data instantly
 */
export const useReloadOnFocus = (
  callback: () => void | Promise<void>,
  dependencies: any[] = []
) => {
  const navigation = useNavigation();
  const isFirstFocusRef = useRef(true);
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const depsRef = useRef(dependencies);
  const callbackRef = useRef(callback);
  const lastExecutedRef = useRef(0);

  // Update refs when dependencies or callback change
  useEffect(() => {
    depsRef.current = dependencies;
    callbackRef.current = callback;
  }, [dependencies, callback]);

  // Create a stable callback that executes immediately but
  // prevents duplicate calls
  const stableCallback = useCallback(async () => {
    // Skip if we're already loading or unmounted
    if (isLoadingRef.current || !isMountedRef.current) return;

    // Throttle calls to once every 2 seconds
    const now = Date.now();
    if (now - lastExecutedRef.current < 2000 && !isFirstFocusRef.current) {
      console.log("[useReloadOnFocus] Skipping rapid execution");
      return;
    }

    try {
      isLoadingRef.current = true;
      lastExecutedRef.current = now;

      // Execute callback immediately - this should show cached data first
      await callbackRef.current();
    } catch (error) {
      console.error("[useReloadOnFocus] Error:", error);
    } finally {
      if (isMountedRef.current) {
        isLoadingRef.current = false;
      }
    }
  }, []); // Empty dependency array to keep it stable

  // Debounce the focus handler to prevent multiple rapid calls
  const debouncedFocusHandler = useCallback(
    debounce(() => {
      stableCallback();
    }, 500),
    [stableCallback]
  );

  // Setup effect with minimal dependency array
  useEffect(() => {
    isMountedRef.current = true;

    // Initial load - run immediately
    if (isFirstFocusRef.current) {
      isFirstFocusRef.current = false;
      // Use setTimeout with 0 to ensure any initial state is set
      // before attempting data load
      setTimeout(stableCallback, 0);
    }

    // Setup focus listener
    const unsubscribe = navigation.addListener("focus", () => {
      // Use debounced handler to prevent multiple rapid calls
      debouncedFocusHandler();
    });

    // Cleanup
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [navigation, stableCallback, debouncedFocusHandler]);
};
