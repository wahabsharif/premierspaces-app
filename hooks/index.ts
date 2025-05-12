import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

/**
 * Custom hook that executes a reload function whenever the screen comes into focus
 * with debounce protection and improved error handling
 *
 * @param reloadFn - Function to execute when the screen comes into focus
 * @param dependencies - Optional array of dependencies that should trigger reloading
 */
export function useReloadOnFocus(
  reloadFn: () => Promise<any>,
  dependencies: any[] = []
) {
  // Use a ref to track if we're currently loading data
  const isLoadingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadData = async () => {
        // Prevent multiple simultaneous calls
        if (isLoadingRef.current) return;

        try {
          isLoadingRef.current = true;

          if (active) {
            await reloadFn();
          }
        } catch (error) {
          console.error("Error in useReloadOnFocus:", error);
        } finally {
          isLoadingRef.current = false;
        }
      };

      loadData();

      return () => {
        active = false;
      };
    }, [reloadFn, ...dependencies])
  );
}
