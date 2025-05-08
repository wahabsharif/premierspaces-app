import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import React, { ReactNode, useEffect, useState } from "react";
import { BASE_API_URL, JOB_TYPES_CACHE_KEY } from "../Constants/env";
import { deleteCache, getAllCache, setCache } from "../services/cacheService";
import { store } from "../store";
import { fetchJobTypes } from "../store/jobSlice";

interface CacheServiceProps {
  children: ReactNode;
  isLoggedIn: boolean;
}

interface JobType {
  id: string;
  name: string;
  [key: string]: any;
}

interface PrefetchResponse {
  payload: JobType[];
}

const CacheService: React.FC<CacheServiceProps> = ({
  children,
  isLoggedIn,
}) => {
  const [ready, setReady] = useState(false);

  // Prefetch logic extracted
  const prefetchAll = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
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

      // Clean up stale caches
      await cleanupUserCache(userId);
      // Fetch & store fresh data
      await prefetchUserData(userId);
    } catch (error) {
      console.error("[CacheService] prefetchAll error:", error);
    } finally {
      setReady(true);
    }
  };

  // 1. Run on mount
  useEffect(() => {
    prefetchAll();
  }, []);

  // 2. Re-run whenever connectivity is regained
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        prefetchAll();
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. Run when user logs in (userData becomes available)
  useEffect(() => {
    if (isLoggedIn) {
      prefetchAll();
    }
  }, [isLoggedIn]);

  // Clean up existing user data in cache, if different from current user
  const cleanupUserCache = async (currentUserId: string) => {
    try {
      const allCacheEntries = await getAllCache();

      const otherUserJobTypesCaches = allCacheEntries.filter(
        (entry) =>
          entry.table_key.startsWith(JOB_TYPES_CACHE_KEY) &&
          entry.table_key !== `${JOB_TYPES_CACHE_KEY}_${currentUserId}`
      );

      const otherUserJobsCaches = allCacheEntries.filter(
        (entry) =>
          entry.table_key.startsWith("getJobsCache_") &&
          entry.table_key !== `getJobsCache_${currentUserId}`
      );

      for (const entry of [
        ...otherUserJobTypesCaches,
        ...otherUserJobsCaches,
      ]) {
        await deleteCache(entry.table_key);
      }
    } catch (error) {
      console.error("[CacheService] Error cleaning up user cache:", error);
    }
  };

  // Fetch and cache data for a specific user
  const prefetchUserData = async (userId: string) => {
    try {
      const jobTypesCacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;
      const jobsCacheKey = `getJobsCache_${userId}`;

      try {
        const resp = await axios.get<PrefetchResponse>(
          `${BASE_API_URL}/jobtypes.php?userid=${userId}`
        );

        const jobTypes = resp.data.payload;
        if (Array.isArray(jobTypes)) {
          await setCache(jobTypesCacheKey, {
            created_at: Date.now(),
            payload: jobTypes,
          });

          store.dispatch(fetchJobTypes({ userId }));
        } else {
          console.warn(
            "[CacheService] Unexpected payload format for job types:",
            jobTypes
          );
        }
      } catch (error) {
        console.error("[CacheService] Failed to fetch job types:", error);
      }

      try {
        const jobsResp = await axios.get(
          `${BASE_API_URL}/getjobs.php?userid=${userId}`
        );

        if (jobsResp.data.status === 1) {
          const sortedJobs = jobsResp.data.payload.sort(
            (a: any, b: any) =>
              new Date(b.date_created).getTime() -
              new Date(a.date_created).getTime()
          );

          await setCache(jobsCacheKey, {
            created_at: Date.now(),
            payload: sortedJobs,
          });
        } else {
          console.warn(
            "[CacheService] Jobs API returned non-success status:",
            jobsResp.data
          );
        }
      } catch (error) {
        console.error("[CacheService] Failed to fetch jobs:", error);
      }
    } catch (error) {
      console.error("[CacheService] Error in prefetchUserData:", error);
    }
  };

  if (!ready) return null;
  return <>{children}</>;
};

export default CacheService;
