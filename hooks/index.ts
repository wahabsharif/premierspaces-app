import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";

/**
 * Custom hook to run a callback when screen comes into focus,
 * with proper controls to prevent duplicate calls
 */
export const useReloadOnFocus = (
  callback: () => void | Promise<void>,
  dependencies: any[] = [],
  forceReload = false
) => {
  const navigation = useNavigation();
  const hasRunInitialRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastDepsRef = useRef<any[]>(dependencies);

  // Check if dependencies have changed
  const depsChanged = () => {
    if (dependencies.length !== lastDepsRef.current.length) return true;

    return dependencies.some((dep, i) => dep !== lastDepsRef.current[i]);
  };

  useEffect(() => {
    // Update the last deps reference
    lastDepsRef.current = dependencies;

    // Initial load - only run once
    const runCallback = async () => {
      if (!hasRunInitialRef.current && isMountedRef.current) {
        hasRunInitialRef.current = true;
        await callback();
      }
    };

    runCallback();

    // Setup focus listener
    const unsubscribe = navigation.addListener("focus", async () => {
      // Only reload on focus if:
      // 1. forceReload is true, OR
      // 2. dependencies have changed since last run
      if ((forceReload || depsChanged()) && isMountedRef.current) {
        await callback();
        lastDepsRef.current = dependencies;
      }
    });

    // Cleanup
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [navigation, callback, ...dependencies, forceReload]);
};
