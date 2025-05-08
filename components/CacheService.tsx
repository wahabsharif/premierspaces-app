import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import React, { ReactNode, useEffect, useState } from "react";
import { BASE_API_URL, JOB_TYPES_CACHE_KEY } from "../Constants/env";
import { getCache, setCache } from "../services/cacheService";
import { store } from "../store";
import { fetchJobTypes } from "../store/jobSlice";

interface CacheServiceProps {
  children: ReactNode;
}

interface JobType {
  id: string;
  name: string;
  [key: string]: any;
}

interface PrefetchResponse {
  payload: JobType[];
}

const CacheService: React.FC<CacheServiceProps> = ({ children }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prefetchAll = async () => {
      try {
        const state = await NetInfo.fetch();
        if (!state.isConnected) {
          setReady(true);
          return;
        }

        const userData = await AsyncStorage.getItem("userData");
        const selectedProperty = await AsyncStorage.getItem("selectedProperty");

        if (userData) {
          const userObj = JSON.parse(userData);
          const userId = userObj.payload?.userid ?? userObj.userid;

          if (userId) {
            const cacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;

            try {
              // Fetch job types
              const resp = await axios.get<PrefetchResponse>(
                `${BASE_API_URL}/jobtypes.php?userid=${userId}`
              );

              const jobTypes = resp.data.payload;
              if (Array.isArray(jobTypes)) {
                // Store job types in SQLite cache
                await setCache(cacheKey, {
                  created_at: Date.now(),
                  payload: jobTypes,
                });

                // Update Redux store with the fetched job types
                store.dispatch(fetchJobTypes({ userId }));
              } else {
                console.warn(
                  "[CacheService] Unexpected payload format:",
                  jobTypes
                );
              }

              // Prefetch all jobs for this user
              const jobsCacheKey = `getJobsCache_${userId}`;

              try {
                // Check if we need to fetch jobs (if cache expired or doesn't exist)
                const cachedJobs = await getCache(jobsCacheKey);
                const isCacheValid =
                  cachedJobs &&
                  cachedJobs.payload &&
                  Date.now() - new Date(cachedJobs.created_at).getTime() <
                    3600000; // 1 hour cache validity

                if (!isCacheValid) {
                  const jobsResp = await axios.get(
                    `${BASE_API_URL}/getjobs.php?userid=${userId}`
                  );

                  if (jobsResp.data.status === 1) {
                    const sortedJobs = jobsResp.data.payload.sort(
                      (a: any, b: any) =>
                        new Date(b.date_created).getTime() -
                        new Date(a.date_created).getTime()
                    );

                    // Store jobs in SQLite cache
                    await setCache(jobsCacheKey, {
                      created_at: Date.now(),
                      payload: sortedJobs,
                    });
                  }
                }
              } catch (error) {
                console.error("[CacheService] Failed to prefetch jobs:", error);
              }
            } catch (error) {
              console.error("[CacheService] Failed to fetch job types:", error);
            }
          } else {
            console.warn("[CacheService] No userId found in userData");
          }
        } else {
          console.warn("[CacheService] No userData found in AsyncStorage");
        }
      } catch (err) {
        console.error("[CacheService] Error in prefetchAll:", err);
      } finally {
        setReady(true);
      }
    };

    prefetchAll();
  }, []);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
};

export default CacheService;
