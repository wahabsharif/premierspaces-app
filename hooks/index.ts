import { useFocusEffect } from "@react-navigation/native";
import React from "react";

export function useReloadOnFocus(reloadFn: () => Promise<void>) {
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      // reloadFn().catch(// console.error);
      return () => {
        active = false;
      };
    }, [reloadFn])
  );
}
