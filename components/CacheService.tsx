import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import React, { ReactNode, useEffect, useState } from "react";
import { BASE_API_URL, JOB_TYPES_CACHE_KEY } from "../Constants/env";
import { deleteCache, getAllCache, setCache } from "../services/cacheService";
import { store } from "../store";
import { fetchJobTypes } from "../store/jobSlice";
import { loadCategories } from "../store/categorySlice";

interface CacheServiceProps {
  children: ReactNode;
  isLoggedIn: boolean;
}

interface JobType {
  id: string;
  name: string;
  [key: string]: any;
}

interface PrefetchResponse<T> {
  payload: T[];
}

/**
 * Helper: returns `true` if device is online, `false` otherwise.
 */
const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
};

// Install Axios interceptor once, at module load time:
axios.interceptors.request.use(
  async (config) => {
    const online = await isOnline();
    if (!online) {
      // Cancel the request entirely if offline
      return Promise.reject({ message: "Offline", __CANCEL__: true });
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const CacheService: React.FC<CacheServiceProps> = ({
  children,
  isLoggedIn,
}) => {
  const [ready, setReady] = useState(false);

  /**
   * 1) Always bail out early if offline.
   * 2) Clean up stale caches for other users.
   * 3) Fetch & cache fresh job types, jobs, and categories when online.
   */
  const prefetchAll = async () => {
    try {
      if (!(await isOnline())) {
        console.log("[CacheService] Offline — skipping prefetch");
        return;
      }

      const userData = await AsyncStorage.getItem("userData");
      if (!userData) {
        console.warn("[CacheService] No userData in storage");
        return;
      }

      const userObj = JSON.parse(userData);
      const userId = userObj.payload?.userid ?? userObj.userid;
      if (!userId) {
        console.warn("[CacheService] Could not determine userId");
        return;
      }

      // Clean up stale caches for other users
      await cleanupUserCache(userId);

      // Fetch & cache fresh data
      await prefetchUserData(userId);
    } catch (error) {
      console.error("[CacheService] prefetchAll error:", error);
    } finally {
      setReady(true);
    }
  };

  // Run once on mount
  useEffect(() => {
    prefetchAll();
  }, []);

  // Re-run on connectivity regained
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        prefetchAll();
      }
    });
    return () => unsubscribe();
  }, []);

  // Re-run on login
  useEffect(() => {
    if (isLoggedIn) {
      prefetchAll();
    }
  }, [isLoggedIn]);

  /**
   * Remove any cached entries for other users
   */
  const cleanupUserCache = async (currentUserId: string) => {
    try {
      const allCacheEntries = await getAllCache();

      const stale = allCacheEntries.filter(
        (entry) =>
          (entry.table_key.startsWith(JOB_TYPES_CACHE_KEY) ||
            entry.table_key.startsWith("getJobsCache_") ||
            entry.table_key.startsWith(`categoryCache_`)) &&
          !entry.table_key.endsWith(`_${currentUserId}`)
      );

      for (const entry of stale) {
        await deleteCache(entry.table_key);
      }
    } catch (error) {
      console.error("[CacheService] Error cleaning up user cache:", error);
    }
  };

  /**
   * Fetch fresh job types, jobs, and categories, then cache them.
   */
  const prefetchUserData = async (userId: string) => {
    // Job types
    const jobTypesCacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;
    try {
      const resp = await axios.get<PrefetchResponse<JobType>>(
        `${BASE_API_URL}/jobtypes.php?userid=${userId}`
      );
      const jobTypes = resp.data.payload;
      if (Array.isArray(jobTypes)) {
        await setCache(jobTypesCacheKey, {
          created_at: Date.now(),
          payload: jobTypes,
        });
        store.dispatch(fetchJobTypes({ userId }));
      }
    } catch (error: any) {
      if (!error.__CANCEL__) {
        console.error("[CacheService] Failed to fetch job types:", error);
      }
    }

    // Jobs
    const jobsCacheKey = `getJobsCache_${userId}`;
    try {
      const jobsResp = await axios.get(
        `${BASE_API_URL}/getjobs.php?userid=${userId}`
      );
      if (jobsResp.data?.status === 1 && Array.isArray(jobsResp.data.payload)) {
        const sortedJobs = jobsResp.data.payload.sort(
          (a: any, b: any) =>
            new Date(b.date_created).getTime() -
            new Date(a.date_created).getTime()
        );
        await setCache(jobsCacheKey, {
          created_at: Date.now(),
          payload: sortedJobs,
        });
      }
    } catch (error: any) {
      if (!error.__CANCEL__) {
        console.error("[CacheService] Failed to fetch jobs:", error);
      }
    }

    // Categories
    const categoriesCacheKey = `categoryCache_${userId}`;
    try {
      const catResp = await axios.get<{ status: number; payload: any[] }>(
        `${BASE_API_URL}/fileuploadcats.php?userid=${userId}`
      );
      if (catResp.data.status === 1 && Array.isArray(catResp.data.payload)) {
        await setCache(categoriesCacheKey, {
          created_at: Date.now(),
          payload: catResp.data.payload,
        });
        store.dispatch(loadCategories());
      }
    } catch (error: any) {
      if (!error.__CANCEL__) {
        console.error("[CacheService] Failed to fetch categories:", error);
      }
    }
  };

  if (!ready) {
    // Optionally render a loading indicator
    return null;
  }

  return <>{children}</>;
};

export default CacheService;
