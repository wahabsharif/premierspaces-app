import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

import {
  BASE_API_URL,
  JOB_TYPES_CACHE_KEY,
  CACHE_CONFIG,
} from "../Constants/env";
import styles from "../Constants/styles";
import {
  deleteCache,
  getAllCache,
  getCache,
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

  // Track when last prefetch occurred to avoid excessive API calls
  const lastPrefetchTime = useRef<number>(0);
  // Track individual data type fetch timestamps
  const lastFetchTimes = useRef<Record<string, number>>({
    jobTypes: 0,
    jobs: 0,
    categories: 0,
    files: 0,
  });

  // Any 401 error triggers session-expired modal
  const handleError = (err: any) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      if (!isLoginScreen) {
        setShowSessionExpired(true);
      }
    }
    throw err;
  };

  // Check if data is stale and needs refreshing
  const isDataStale = (
    cacheType: keyof typeof CACHE_CONFIG.FRESHNESS_DURATION,
    lastUpdated: number
  ): boolean => {
    const freshnessDuration = CACHE_CONFIG.FRESHNESS_DURATION[cacheType];
    return Date.now() - lastUpdated > freshnessDuration;
  };

  // Determine if we can prefetch (throttle check)
  const canPrefetch = (): boolean => {
    const now = Date.now();
    // If first fetch or enough time has passed since last prefetch
    return (
      lastPrefetchTime.current === 0 ||
      now - lastPrefetchTime.current > CACHE_CONFIG.THROTTLE_INTERVAL
    );
  };

  const prefetchAll = useCallback(
    async (force = false) => {
      // Don't prefetch if already loading, or if throttled (unless force=true)
      if (loading || (!force && !canPrefetch())) return;

      // Update last prefetch time
      lastPrefetchTime.current = Date.now();
      setLoading(true);

      try {
        // Skip if offline
        if (!(await isOnline())) {
          setLoading(false);
          return;
        }

        // 1) ensure userData exists
        const userData = await AsyncStorage.getItem("userData");
        if (!userData) {
          setLoading(false);
          if (!isLoginScreen) {
            navigation.navigate("LoginScreen" as never);
          }
          return;
        }

        // 2) parse userId
        const userObj = JSON.parse(userData);
        const userId = userObj.payload?.userid ?? userObj.userid;
        if (!userId) {
          setLoading(false);
          if (!isLoginScreen) {
            navigation.navigate("LoginScreen" as never);
          }
          return;
        }

        // 3) clean stale cache and prefetch
        await cleanupUserCache(userId);
        await prefetchUserData(userId, force);
      } catch (error) {
        console.error("[CacheService] Prefetch error:", error);
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

  // Hide session-expired modal when on login screen
  useEffect(() => {
    if (isLoginScreen && showSessionExpired) {
      setShowSessionExpired(false);
    }
  }, [isLoginScreen, showSessionExpired]);

  // Initial load with delay to allow app to render first
  useEffect(() => {
    let initialFetchTimer: NodeJS.Timeout | null = null;

    if (isLoggedIn) {
      initialFetchTimer = setTimeout(() => {
        debouncedPrefetch(false);
      }, CACHE_CONFIG.INITIAL_PREFETCH_DELAY);
    }

    return () => {
      if (initialFetchTimer) {
        clearTimeout(initialFetchTimer);
      }
    };
  }, [isLoggedIn, debouncedPrefetch]);

  // Retry on reconnect, but only if we've been offline for a while
  useEffect(() => {
    let wasOffline = false;
    let lastConnectivityChange = 0;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const now = Date.now();

      // If we're coming back online after being offline
      if (state.isConnected && !wasOffline) {
        wasOffline = false;

        // Only trigger a refresh if we've been offline for a significant time
        if (
          now - lastConnectivityChange > CACHE_CONFIG.THROTTLE_INTERVAL &&
          isLoggedIn
        ) {
          debouncedPrefetch(false);
        }
      } else if (!state.isConnected) {
        wasOffline = true;
      }

      lastConnectivityChange = now;
    });

    return () => {
      unsubscribe();
      debouncedPrefetch.cancel?.();
    };
  }, [debouncedPrefetch, isLoggedIn]);

  // Remove caches belonging to other users
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

  // Orchestrate all fetches, but check staleness first
  const prefetchUserData = async (userId: string, force = false) => {
    try {
      // Only fetch if forced or stale
      const fetchPromises = [];

      // Check each data type and only fetch if stale or forced
      if (force || isDataStale("JOB_TYPES", lastFetchTimes.current.jobTypes)) {
        fetchPromises.push(prefetchJobTypes(userId).catch(handleError));
      }

      if (force || isDataStale("JOBS", lastFetchTimes.current.jobs)) {
        fetchPromises.push(prefetchJobs(userId).catch(handleError));
      }

      if (
        force ||
        isDataStale("CATEGORIES", lastFetchTimes.current.categories)
      ) {
        fetchPromises.push(prefetchCategories(userId).catch(handleError));
      }

      if (force || isDataStale("FILES", lastFetchTimes.current.files)) {
        fetchPromises.push(prefetchFiles(userId).catch(handleError));
      }

      // Only run Promise.allSettled if we have promises to await
      if (fetchPromises.length > 0) {
        const results = await Promise.allSettled(fetchPromises);

        const has401Error = results.some(
          (r) =>
            r.status === "rejected" &&
            axios.isAxiosError(r.reason) &&
            r.reason.response?.status === 401
        );

        if (has401Error && !isLoginScreen) {
          setShowSessionExpired(true);
        }
      }
    } catch (error) {
      console.error("[CacheService] Error in prefetchUserData:", error);
    }
  };

  const prefetchJobTypes = async (userId: string) => {
    const key = `${JOB_TYPES_CACHE_KEY}_${userId}`;

    // First check if we have unexpired cache
    const cacheEntry = await getCache(key);
    const now = Date.now();

    // If cache exists and is fresh, skip the fetch
    if (
      cacheEntry &&
      cacheEntry.payload &&
      now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.JOB_TYPES
    ) {
      // Use cached data
      store.dispatch(fetchJobTypes({ userId }));
      return;
    }

    // Cache is stale or doesn't exist - fetch fresh data
    const { data } = await axios.get(
      `${BASE_API_URL}/jobtypes.php?userid=${userId}`
    );
    if (!Array.isArray(data.payload)) {
      throw new Error("Invalid job types data");
    }
    await setCache(key, data.payload);
    store.dispatch(fetchJobTypes({ userId }));
    lastFetchTimes.current.jobTypes = now;
  };

  const prefetchJobs = async (userId: string) => {
    const key = `getJobsCache_${userId}`;

    // Check cache first
    const cacheEntry = await getCache(key);
    const now = Date.now();

    // If cache exists and is fresh, skip the fetch
    if (
      cacheEntry &&
      cacheEntry.payload &&
      now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.JOBS
    ) {
      // Cache is fresh enough
      return;
    }

    // Cache is stale or doesn't exist - fetch fresh data
    const { data } = await axios.get(
      `${BASE_API_URL}/getjobs.php?userid=${userId}`
    );
    if (data.status !== 1 || !Array.isArray(data.payload)) {
      throw new Error("Invalid jobs data");
    }
    await setCache(key, data.payload);
    lastFetchTimes.current.jobs = now;
  };

  const prefetchCategories = async (userId: string) => {
    const key = `categoryCache_${userId}`;

    // Check cache first
    const cacheEntry = await getCache(key);
    const now = Date.now();

    // If cache exists and is fresh, skip the fetch
    if (
      cacheEntry &&
      cacheEntry.payload &&
      now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.CATEGORIES
    ) {
      // Use cached data
      store.dispatch(loadCategories());
      const { categoryMap, subCategoryMap } = createCategoryMappings(
        cacheEntry.payload.payload
      );
      store.dispatch(setCategoryMappings({ categoryMap, subCategoryMap }));
      return;
    }

    // Cache is stale or doesn't exist - fetch fresh data
    const { data } = await axios.get(
      `${BASE_API_URL}/fileuploadcats.php?userid=${userId}`
    );
    if (data.status !== 1 || !Array.isArray(data.payload)) {
      throw new Error("Invalid categories data");
    }
    await setCache(key, data.payload);
    store.dispatch(loadCategories());
    const { categoryMap, subCategoryMap } = createCategoryMappings(
      data.payload
    );
    store.dispatch(setCategoryMappings({ categoryMap, subCategoryMap }));
    lastFetchTimes.current.categories = now;
  };

  const prefetchFiles = async (userId: string) => {
    const key = `filesCache_${userId}`;

    // Check cache first
    const cacheEntry = await getCache(key);
    const now = Date.now();

    // If cache exists and is fresh, skip the fetch
    if (
      cacheEntry &&
      cacheEntry.payload &&
      now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.FILES
    ) {
      // Cache is fresh enough
      return;
    }

    // Cache is stale or doesn't exist - fetch fresh data
    const { data } = await axios.get(
      `${BASE_API_URL}/get-files.php?userid=${userId}`
    );
    if (data.status !== 1 || !Array.isArray(data.payload)) {
      throw new Error("Invalid files data");
    }
    await setCache(key, data.payload);
    lastFetchTimes.current.files = now;
  };

  const shouldShowModal = showSessionExpired && !isLoginScreen;

  return (
    <>
      {children}

      <Modal
        animationType="fade"
        transparent={true}
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
