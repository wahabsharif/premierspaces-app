import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BASE_API_URL, JOB_TYPES_CACHE_KEY } from "../Constants/env";
import {
  deleteCache,
  getAllCache,
  isOnline,
  setCache,
} from "../services/cacheService";
import { store } from "../store";
import { loadCategories } from "../store/categorySlice";
import {
  createCategoryMappings,
  setCategoryMappings,
} from "../store/filesSlice";
import { fetchJobTypes } from "../store/jobSlice";

interface CacheServiceProps {
  children: ReactNode;
  isLoggedIn: boolean;
}

const STORAGE_KEYS = {
  USER: "userData",
};

function debounce<F extends (...args: any[]) => any>(func: F, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };
  return debounced;
}

const CacheService: React.FC<CacheServiceProps> = ({
  children,
  isLoggedIn,
}) => {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [cacheComplete, setCacheComplete] = useState(false);

  const prefetchAll = useCallback(
    async (force = false) => {
      if (loading || !isLoggedIn || (cacheComplete && !force)) return;
      setLoading(true);

      try {
        if (!(await isOnline())) {
          console.log("[CacheService] Offline, skipping prefetch");
          setReady(true);
          return;
        }

        const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (!userData) {
          console.warn("[CacheService] No userData in storage");
          setReady(true);
          return;
        }

        const userObj = JSON.parse(userData);
        const userId = userObj.payload?.userid ?? userObj.userid;
        if (!userId) {
          console.warn("[CacheService] Could not determine userId");
          setReady(true);
          return;
        }

        await cleanupUserCache(userId);
        await prefetchUserData(userId);
      } catch (error) {
        console.error("[CacheService] Prefetch error:", error);
      } finally {
        setLoading(false);
        setReady(true);
      }
    },
    [loading, isLoggedIn, cacheComplete]
  );

  const debouncedPrefetch = useMemo(
    () => debounce(prefetchAll, 300),
    [prefetchAll]
  );

  useEffect(() => {
    if (isLoggedIn) {
      debouncedPrefetch();
    }
  }, [isLoggedIn, debouncedPrefetch]);

  useEffect(() => {
    let first = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (first) {
        first = false;
        return;
      }
      if (state.isConnected && isLoggedIn) {
        debouncedPrefetch(true); // Force prefetch on reconnect
      }
    });
    return () => {
      unsubscribe();
      debouncedPrefetch.cancel?.();
    };
  }, [debouncedPrefetch, isLoggedIn]);

  const cleanupUserCache = async (currentUserId: string) => {
    try {
      const allCacheEntries = await getAllCache();
      const staleKeys = allCacheEntries
        .filter(
          (entry) =>
            (entry.table_key.startsWith(JOB_TYPES_CACHE_KEY) ||
              entry.table_key.startsWith("getJobsCache_") ||
              entry.table_key.startsWith("categoryCache_") ||
              entry.table_key.startsWith("filesCache_")) &&
            !entry.table_key.includes(`_${currentUserId}`)
        )
        .map((e) => e.table_key);

      for (let i = 0; i < staleKeys.length; i += 20) {
        const batch = staleKeys.slice(i, i + 20);
        await Promise.all(batch.map((key) => deleteCache(key)));
      }
    } catch (err) {
      console.error("[CacheService] Error cleaning up user cache:", err);
    }
  };

  const prefetchUserData = async (userId: string) => {
    const results = await Promise.allSettled([
      prefetchJobTypes(userId),
      prefetchJobs(userId),
      prefetchCategories(userId),
      prefetchFiles(userId),
    ]);
    const allSuccessful = results.every(
      (result) => result.status === "fulfilled"
    );
    if (allSuccessful) {
      setCacheComplete(true); // Set cacheComplete only if all prefetch operations succeed
    }
  };

  const prefetchJobTypes = async (userId: string) => {
    const key = `${JOB_TYPES_CACHE_KEY}_${userId}`;
    try {
      const { data } = await axios.get(
        `${BASE_API_URL}/jobtypes.php?userid=${userId}`
      );
      if (Array.isArray(data.payload)) {
        await setCache(key, data.payload);
        store.dispatch(fetchJobTypes({ userId }));
      } else {
        throw new Error("Invalid job types data");
      }
    } catch (err: any) {
      if (!err.__CANCEL__)
        console.error("[CacheService] Job types fetch failed:", err);
      throw err;
    }
  };

  const prefetchJobs = async (userId: string) => {
    const key = `getJobsCache_${userId}`;
    try {
      const { data } = await axios.get(
        `${BASE_API_URL}/getjobs.php?userid=${userId}`
      );
      if (data.status === 1 && Array.isArray(data.payload)) {
        await setCache(key, data.payload);
      } else {
        console.warn(
          `[CacheService] getjobs API returned status ${data.status}`
        );
        throw new Error("Invalid jobs data");
      }
    } catch (err: any) {
      if (!err.__CANCEL__)
        console.error("[CacheService] Jobs fetch failed:", err);
      throw err;
    }
  };

  const prefetchCategories = async (userId: string) => {
    const key = `categoryCache_${userId}`;
    try {
      const { data } = await axios.get(
        `${BASE_API_URL}/fileuploadcats.php?userid=${userId}`
      );
      if (data.status === 1 && Array.isArray(data.payload)) {
        await setCache(key, data.payload);
        store.dispatch(loadCategories());
        const { categoryMap, subCategoryMap } = createCategoryMappings(
          data.payload
        );
        store.dispatch(setCategoryMappings({ categoryMap, subCategoryMap }));
      } else {
        console.warn(
          `[CacheService] Categories API returned status ${data.status}`
        );
        throw new Error("Invalid categories data");
      }
    } catch (err: any) {
      if (!err.__CANCEL__)
        console.error("[CacheService] Categories fetch failed:", err);
      throw err;
    }
  };

  const prefetchFiles = async (userId: string) => {
    const key = `filesCache_${userId}`;
    try {
      const { data } = await axios.get(
        `${BASE_API_URL}/get-files.php?userid=${userId}`
      );
      if (data.status === 1 && Array.isArray(data.payload)) {
        await setCache(key, data.payload);
      } else {
        console.warn(
          `[CacheService] Files API returned status ${data.status} for user ${userId}`
        );
        throw new Error("Invalid files data");
      }
    } catch (err: any) {
      if (!err.__CANCEL__)
        console.error(
          `[CacheService] Files fetch failed for user ${userId}:`,
          err
        );
      throw err;
    }
  };

  return <>{children}</>;
};

export default CacheService;
