import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

/**
 * Custom hook that executes a reload function whenever the screen comes into focus
 *
 * @param reloadFn - Function to execute when the screen comes into focus
 */
export function useReloadOnFocus(reloadFn: () => Promise<any>) {
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadData = async () => {
        try {
          if (active) {
            await reloadFn();
          }
        } catch (error) {
          console.error("Error in useReloadOnFocus:", error);
        }
      };

      loadData();

      return () => {
        active = false;
      };
    }, [reloadFn])
  );
}
