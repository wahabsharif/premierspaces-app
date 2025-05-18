import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";
import styles from "../Constants/styles";
import {
  deleteCache,
  getAllCache,
  getCache,
  isOnline,
  setCache,
} from "../services/cacheService";
import { store } from "../store";
import { loadCategories, setCategories } from "../store/categorySlice";
import {
  createCategoryMappings,
  setCategoryMappings,
} from "../store/filesSlice";
import { fetchJobs as fetchJobsThunk, fetchJobTypes } from "../store/jobSlice";

interface CacheServiceProps {
  children: ReactNode;
  isLoggedIn: boolean;
  isLoginScreen: boolean;
}

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
  isLoginScreen,
}) => {
  const [loading, setLoading] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const navigation = useNavigation();
  const fetchInProgress = useRef<Record<string, boolean>>({
    jobTypes: false,
    jobs: false,
    categories: false,
    files: false,
    costs: false,
    contractors: false,
  });
  const abortController = useRef<AbortController>(new AbortController());

  const lastPrefetchTime = useRef<number>(0);
  const lastFetchTimes = useRef<Record<string, number>>({
    jobTypes: 0,
    jobs: 0,
    categories: 0,
    files: 0,
    costs: 0,
    contractors: 0,
  });

  const networkState = useRef<{
    wasOffline: boolean;
    pendingRefresh: boolean;
    lastConnectivityChange: number;
  }>({
    wasOffline: false,
    pendingRefresh: false,
    lastConnectivityChange: 0,
  });

  const handleSessionExpired = () => {
    if (!isLoginScreen) {
      setShowSessionExpired(true);
      abortController.current.abort();
      Object.keys(fetchInProgress.current).forEach(
        (key) => (fetchInProgress.current[key] = false)
      );
    }
  };

  const fetchWithSessionCheck = async (url: string) => {
    try {
      const response = await axios.get(url, {
        signal: abortController.current.signal,
        timeout: 10000, // Add timeout to prevent hanging requests
      });

      // Check for session expiration regardless of status code
      if (response.data && response.data.message === "Session expired") {
        handleSessionExpired();
        return null;
      }

      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request canceled:", url);
      } else {
        console.warn(`API request failed for ${url}:`, error);

        // Also check for session expired in error responses
        if (
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          (error as any).response?.data?.message === "Session expired"
        ) {
          console.log("Session expired detected in error response");
          handleSessionExpired();
          return null;
        }

        // Return a special value to indicate we should use cache
        return { useCache: true };
      }
      return null;
    }
  };

  const isDataStale = (
    cacheType: keyof typeof CACHE_CONFIG.FRESHNESS_DURATION,
    lastUpdated: number
  ) => {
    const freshnessDuration = CACHE_CONFIG.FRESHNESS_DURATION[cacheType];
    return Date.now() - lastUpdated > freshnessDuration;
  };

  const canPrefetch = () => {
    const now = Date.now();
    return (
      lastPrefetchTime.current === 0 ||
      now - lastPrefetchTime.current > CACHE_CONFIG.THROTTLE_INTERVAL
    );
  };

  const prefetchAll = useCallback(
    async (force = false) => {
      if (loading || (!force && !canPrefetch())) return;
      lastPrefetchTime.current = Date.now();
      setLoading(true);
      try {
        if (!(await isOnline())) {
          networkState.current.wasOffline = true;
          networkState.current.pendingRefresh = true;
          return;
        }
        const userData = await AsyncStorage.getItem("userData");
        if (!userData) {
          if (!isLoginScreen) navigation.navigate("LoginScreen" as never);
          return;
        }
        const { payload, userid } = JSON.parse(userData);
        const userId = payload?.userid ?? userid;
        if (!userId) {
          if (!isLoginScreen) navigation.navigate("LoginScreen" as never);
          return;
        }
        await cleanupUserCache(userId);
        await prefetchUserData(userId, force);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    },
    [loading, navigation, isLoginScreen]
  );

  const debouncedPrefetch = useMemo(
    () => debounce(prefetchAll, 300),
    [prefetchAll]
  );

  useEffect(() => {
    if (isLoginScreen && showSessionExpired) {
      setShowSessionExpired(false);
    }
  }, [isLoginScreen]);

  useEffect(() => {
    if (isLoggedIn) {
      const timer = setTimeout(
        () => prefetchAll(true),
        CACHE_CONFIG.INITIAL_PREFETCH_DELAY
      );
      return () => {
        clearTimeout(timer);
        debouncedPrefetch.cancel?.();
      };
    }
  }, [isLoggedIn, prefetchAll, debouncedPrefetch]);

  useEffect(() => {
    if (isLoggedIn) abortController.current = new AbortController();
  }, [isLoggedIn]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const now = Date.now();
      const { wasOffline, pendingRefresh, lastConnectivityChange } =
        networkState.current;
      if (state.isConnected && wasOffline) {
        networkState.current.wasOffline = false;
        if (
          (pendingRefresh ||
            now - lastConnectivityChange > CACHE_CONFIG.THROTTLE_INTERVAL) &&
          isLoggedIn
        ) {
          prefetchAll(true);
        }
      } else if (!state.isConnected && !wasOffline) {
        networkState.current.wasOffline = true;
        networkState.current.lastConnectivityChange = now;
      }
    });
    return () => unsubscribe();
  }, [prefetchAll, isLoggedIn]);

  const cleanupUserCache = async (currentUserId: string) => {
    try {
      const allCache = await getAllCache();
      const staleKeys = allCache
        .filter(
          (entry) =>
            (entry.table_key.startsWith(CACHE_CONFIG.CACHE_KEYS.JOB_TYPES) ||
              entry.table_key.startsWith("getJobsCache_") ||
              entry.table_key.startsWith("categoryCache_") ||
              entry.table_key.startsWith("filesCache_") ||
              entry.table_key.startsWith(CACHE_CONFIG.CACHE_KEYS.COST) ||
              entry.table_key.startsWith(
                CACHE_CONFIG.CACHE_KEYS.CONTRACTORS
              )) &&
            !entry.table_key.includes(`_${currentUserId}`)
        )
        .map((e) => e.table_key);
      for (let i = 0; i < staleKeys.length; i += 20) {
        await Promise.all(staleKeys.slice(i, i + 20).map(deleteCache));
      }
    } catch (err) {}
  };

  const prefetchContractors = async (userId: string) => {
    const key = `${CACHE_CONFIG.CACHE_KEYS.CONTRACTORS}_${userId}`;
    if (fetchInProgress.current.contractors) return;
    fetchInProgress.current.contractors = true;
    try {
      const cacheEntry = await getCache(key);
      const now = Date.now();
      if (
        cacheEntry?.payload &&
        now - cacheEntry.updated_at <
          CACHE_CONFIG.FRESHNESS_DURATION.CONTRACTORS
      ) {
        lastFetchTimes.current.contractors = cacheEntry.updated_at;
        return;
      }
      const data = await fetchWithSessionCheck(
        `${BASE_API_URL}/contractors.php?userid=${userId}`
      );
      if (!data) return;

      // Check if we need to use cache due to API failure
      if (data.useCache) {
        if (cacheEntry?.payload) {
          // Use existing cache even if stale
          const now = Date.now();
          lastFetchTimes.current.contractors = now; // Update timestamp to prevent repeated attempts
        }
        return;
      }

      if (!Array.isArray(data.payload))
        throw new Error("Invalid contractors data");
      await setCache(key, data.payload);
      lastFetchTimes.current.contractors = now;
    } catch (error) {
      console.error("Error in prefetchContractors:", error);
      // Try to use cache as fallback
      const cacheEntry = await getCache(key);
      if (cacheEntry?.payload) {
        const now = Date.now();
        lastFetchTimes.current.contractors = now; // Update timestamp to prevent repeated attempts
      }
    } finally {
      fetchInProgress.current.contractors = false;
    }
  };

  const prefetchUserData = async (
    userId: string,
    force = false
  ): Promise<void> => {
    const tasks: Array<Promise<void>> = [];
    const map = {
      CATEGORIES: {
        shouldFetch: () =>
          force || isDataStale("CATEGORIES", lastFetchTimes.current.categories),
        fn: () => prefetchCategories(userId),
        inProgressKey: "categories",
      },
      JOB_TYPES: {
        shouldFetch: () =>
          force || isDataStale("JOB_TYPES", lastFetchTimes.current.jobTypes),
        fn: () => prefetchJobTypes(userId),
        inProgressKey: "jobTypes",
      },
      JOBS: {
        shouldFetch: () =>
          force || isDataStale("JOBS", lastFetchTimes.current.jobs),
        fn: () => prefetchJobs(userId),
        inProgressKey: "jobs",
      },
      FILES: {
        shouldFetch: () =>
          force || isDataStale("FILES", lastFetchTimes.current.files),
        fn: () => prefetchFiles(userId),
        inProgressKey: "files",
      },
      COSTS: {
        shouldFetch: () =>
          force || isDataStale("COSTS", lastFetchTimes.current.costs),
        fn: () => prefetchActiveJobCosts(userId),
        inProgressKey: "costs",
      },
      CONTRACTORS: {
        shouldFetch: () =>
          force ||
          isDataStale("CONTRACTORS", lastFetchTimes.current.contractors),
        fn: () => prefetchContractors(userId),
        inProgressKey: "contractors",
      },
    };

    for (const key of Object.keys(map) as Array<keyof typeof map>) {
      const { shouldFetch, fn, inProgressKey } = map[key];
      if (!fetchInProgress.current[inProgressKey] && shouldFetch()) {
        tasks.push(fn());
      }
    }

    await Promise.all(tasks);
  };

  const prefetchJobTypes = async (userId: string) => {
    const key = `${CACHE_CONFIG.CACHE_KEYS.JOB_TYPES}_${userId}`;
    if (fetchInProgress.current.jobTypes) return;
    fetchInProgress.current.jobTypes = true;
    try {
      const cacheEntry = await getCache(key);
      const now = Date.now();
      if (
        cacheEntry?.payload &&
        now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.JOB_TYPES
      ) {
        store.dispatch(fetchJobTypes({ userId }));
        lastFetchTimes.current.jobTypes = cacheEntry.updated_at;
        return;
      }
      const data = await fetchWithSessionCheck(
        `${BASE_API_URL}/jobtypes.php?userid=${userId}`
      );
      if (!data) return;

      // Check if we need to use cache due to API failure
      if (data.useCache) {
        if (cacheEntry?.payload) {
          // Use existing cache even if stale
          store.dispatch(fetchJobTypes({ userId, useCache: true }));
          lastFetchTimes.current.jobTypes = now; // Update timestamp to prevent repeated attempts
        }
        return;
      }

      if (!Array.isArray(data.payload))
        throw new Error("Invalid job types data");
      await setCache(key, data.payload);
      store.dispatch(fetchJobTypes({ userId }));
      lastFetchTimes.current.jobTypes = now;
    } catch (error) {
      console.error("Error in prefetchJobTypes:", error);
      // Try to use cache as fallback
      const cacheEntry = await getCache(key);
      if (cacheEntry?.payload) {
        store.dispatch(fetchJobTypes({ userId, useCache: true }));
      }
    } finally {
      fetchInProgress.current.jobTypes = false;
    }
  };

  const prefetchJobs = async (userId: string) => {
    const key = `getJobsCache_${userId}`;
    if (fetchInProgress.current.jobs) return;
    fetchInProgress.current.jobs = true;

    let retryCount = 0;
    const maxRetries = 2;

    try {
      // Check cache first
      const cacheEntry = await getCache(key);
      const now = Date.now();
      if (
        cacheEntry?.payload &&
        now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.JOBS
      ) {
        lastFetchTimes.current.jobs = cacheEntry.updated_at;
        await store.dispatch(fetchJobsThunk({ userId }));
        return;
      }

      // Attempt to fetch with retries
      while (retryCount <= maxRetries) {
        try {
          const data = await fetchWithSessionCheck(
            `${BASE_API_URL}/getjobs.php?userid=${userId}`
          );

          // Handle no data case
          if (!data) return;

          // If API indicates we should use cache
          if (data.useCache) {
            if (cacheEntry?.payload) {
              await store.dispatch(fetchJobsThunk({ userId, useCache: true }));
              lastFetchTimes.current.jobs = now;
            }
            return;
          }

          // Validate response structure
          if (!data.payload) {
            console.warn(
              "Jobs API returned no payload:",
              JSON.stringify(data).substring(0, 100)
            );
            throw new Error("Jobs API missing payload");
          }

          // More detailed validation
          if (!Array.isArray(data.payload)) {
            console.warn(
              "Jobs data is not an array:",
              typeof data.payload,
              JSON.stringify(data.payload).substring(0, 100)
            );

            // Special case - sometimes the API might return an object with a payload property
            if (
              data.payload &&
              typeof data.payload === "object" &&
              Array.isArray(data.payload.payload)
            ) {
              await setCache(key, data.payload.payload);
              await store.dispatch(fetchJobsThunk({ userId }));
              lastFetchTimes.current.jobs = now;
              return;
            }

            throw new Error("Invalid jobs response format");
          }

          // Success path
          await setCache(key, data.payload);
          await store.dispatch(fetchJobsThunk({ userId }));
          lastFetchTimes.current.jobs = now;
          return;
        } catch (fetchError) {
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`Retrying jobs fetch (${retryCount}/${maxRetries})...`);
            await new Promise((r) => setTimeout(r, 1000 * retryCount)); // Exponential backoff
          } else {
            throw fetchError; // Retries exhausted, propagate error
          }
        }
      }
    } catch (error) {
      console.error("Error in prefetchJobs:", error);

      // Log detailed diagnostics
      if (error instanceof Error) {
        console.error(`Jobs fetch failed: ${error.message}`);
      } else {
        console.error("Jobs fetch failed with non-Error:", error);
      }

      // Fallback to cache if available
      const cacheEntry = await getCache(key);
      if (cacheEntry?.payload) {
        console.log("Using cached jobs data as fallback");
        await store.dispatch(fetchJobsThunk({ userId, useCache: true }));
        lastFetchTimes.current.jobs = Date.now(); // Update to prevent immediate retry
      } else {
        console.warn("No jobs cache available for fallback");
      }
    } finally {
      fetchInProgress.current.jobs = false;
    }
  };

  const prefetchCategories = async (userId: string) => {
    const key = `categoryCache_${userId}`;
    if (fetchInProgress.current.categories) return;
    fetchInProgress.current.categories = true;
    try {
      const cacheEntry = await getCache(key);
      const now = Date.now();
      if (
        cacheEntry?.payload &&
        now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.CATEGORIES
      ) {
        const list: any[] = Array.isArray(cacheEntry.payload)
          ? cacheEntry.payload
          : cacheEntry.payload.payload;
        store.dispatch(setCategories(list));
        const { categoryMap, subCategoryMap } = createCategoryMappings(list);
        store.dispatch(setCategoryMappings({ categoryMap, subCategoryMap }));
        lastFetchTimes.current.categories = cacheEntry.updated_at;
      } else {
        const data = await fetchWithSessionCheck(
          `${BASE_API_URL}/fileuploadcats.php?userid=${userId}`
        );

        // If API failed, use cached data if available
        if (!data || data.useCache) {
          if (cacheEntry?.payload) {
            const list: any[] = Array.isArray(cacheEntry.payload)
              ? cacheEntry.payload
              : cacheEntry.payload.payload;
            store.dispatch(setCategories(list));
            const { categoryMap, subCategoryMap } =
              createCategoryMappings(list);
            store.dispatch(
              setCategoryMappings({ categoryMap, subCategoryMap })
            );
            lastFetchTimes.current.categories = now; // Update to prevent repeated attempts
          }
          return;
        }

        await setCache(key, data.payload);
        store.dispatch(loadCategories());
        const { categoryMap, subCategoryMap } = createCategoryMappings(
          data.payload
        );
        store.dispatch(setCategoryMappings({ categoryMap, subCategoryMap }));
        lastFetchTimes.current.categories = now;
      }
    } catch (error) {
      console.error("Error in prefetchCategories:", error);
      // Try to use cache as fallback
      const cacheEntry = await getCache(key);
      if (cacheEntry?.payload) {
        const list: any[] = Array.isArray(cacheEntry.payload)
          ? cacheEntry.payload
          : cacheEntry.payload.payload;
        store.dispatch(setCategories(list));
        const { categoryMap, subCategoryMap } = createCategoryMappings(list);
        store.dispatch(setCategoryMappings({ categoryMap, subCategoryMap }));
      }
    } finally {
      fetchInProgress.current.categories = false;
    }
  };

  const prefetchFiles = async (userId: string) => {
    const key = `filesCache_${userId}`;
    if (fetchInProgress.current.files) return;
    fetchInProgress.current.files = true;
    try {
      const cacheEntry = await getCache(key);
      const now = Date.now();
      if (
        cacheEntry?.payload &&
        now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.FILES
      ) {
        lastFetchTimes.current.files = cacheEntry.updated_at;
        return;
      }
      const data = await fetchWithSessionCheck(
        `${BASE_API_URL}/get-files.php?userid=${userId}`
      );

      // If API failed, use cached data if available
      if (!data || data.useCache) {
        if (cacheEntry?.payload) {
          lastFetchTimes.current.files = now; // Update to prevent repeated attempts
        }
        return;
      }

      if (!Array.isArray(data.payload))
        throw new Error("Invalid files data structure");
      await setCache(key, data.payload);
      lastFetchTimes.current.files = now;
    } catch (error) {
      console.error("Error in prefetchFiles:", error);
    } finally {
      fetchInProgress.current.files = false;
    }
  };

  const prefetchActiveJobCosts = async (userId: string) => {
    const key = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;
    if (fetchInProgress.current.costs) return;
    fetchInProgress.current.costs = true;

    try {
      const online = await isOnline();
      if (online) {
        // Check if we've fetched costs recently (within the last 2 minutes)
        const now = Date.now();
        const lastCostFetchTime = lastFetchTimes.current.costs || 0;
        const shouldRefreshCosts = now - lastCostFetchTime > 120000;

        if (shouldRefreshCosts) {
          const data = await fetchWithSessionCheck(
            `${BASE_API_URL}/costs.php?userid=${userId}`
          );

          // If API failed, use cached data if available
          if (!data || data.useCache) {
            const cacheEntry = await getCache(key);
            if (cacheEntry?.payload) {
              lastFetchTimes.current.costs = now; // Update to prevent repeated attempts
            }
            return;
          }

          let costs: any[] = Array.isArray(data.payload)
            ? data.payload
            : Array.isArray(data.payload.payload)
            ? data.payload.payload
            : [data.payload];

          // Store costs in cache with no expiration (expiresIn: 0)
          await setCache(key, costs, { expiresIn: 0 });
          lastFetchTimes.current.costs = now;
        } else {
          console.log(
            "[prefetchActiveJobCosts] Skipping refresh, fetched recently"
          );
        }
        return;
      }

      // If offline, we don't need to do anything - the existing cache will be used
      // Just update the last fetch time to avoid repeated attempts
      const cacheEntry = await getCache(key);
      if (cacheEntry?.payload) {
        lastFetchTimes.current.costs = Date.now();
      }
    } catch (error) {
      console.error("[prefetchActiveJobCosts] error:", error);
      // Try to use cache as fallback
      const cacheEntry = await getCache(key);
      if (cacheEntry?.payload) {
        lastFetchTimes.current.costs = Date.now();
      }
    } finally {
      fetchInProgress.current.costs = false;
    }
  };

  const shouldShowModal = showSessionExpired && !isLoginScreen;

  return (
    <>
      {children}
      <Modal
        animationType="fade"
        transparent
        visible={shouldShowModal}
        onRequestClose={() => {
          setShowSessionExpired(false);
          navigation.navigate("LoginScreen" as never);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>
              Session expired! Please log in again.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSessionExpired(false);
                navigation.navigate("LoginScreen" as never);
              }}
            >
              <Text style={styles.modalButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default CacheService;
