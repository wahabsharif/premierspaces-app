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

import {
  BASE_API_URL,
  CACHE_CONFIG,
  CONTRACTOR_CACHE_KEY,
  JOB_TYPES_CACHE_KEY,
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
import { loadCategories, setCategories } from "../store/categorySlice";
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
  const fetchInProgress = useRef<Record<string, boolean>>({
    jobTypes: false,
    jobs: false,
    categories: false,
    files: false,
    contractors: false,
  });

  const lastPrefetchTime = useRef<number>(0);
  const lastFetchTimes = useRef<Record<string, number>>({
    jobTypes: 0,
    jobs: 0,
    categories: 0,
    files: 0,
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

  const handleError = (err: any, dataType: string) => {
    console.error(`[CacheService] Error fetching ${dataType}:`, err);
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      if (!isLoginScreen) {
        setShowSessionExpired(true);
      }
    }
    throw err;
  };

  const isDataStale = (
    cacheType: keyof typeof CACHE_CONFIG.FRESHNESS_DURATION,
    lastUpdated: number
  ): boolean => {
    const freshnessDuration = CACHE_CONFIG.FRESHNESS_DURATION[cacheType];
    return Date.now() - lastUpdated > freshnessDuration;
  };

  const canPrefetch = (): boolean => {
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
          setLoading(false);
          if (!isLoginScreen) navigation.navigate("LoginScreen" as never);
          return;
        }
        const userObj = JSON.parse(userData);
        const userId = userObj.payload?.userid ?? userObj.userid;
        if (!userId) {
          setLoading(false);
          if (!isLoginScreen) navigation.navigate("LoginScreen" as never);
          return;
        }
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

  useEffect(() => {
    if (isLoginScreen && showSessionExpired) {
      setShowSessionExpired(false);
    }
  }, [isLoginScreen, showSessionExpired]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLoggedIn) {
      timer = setTimeout(
        () => prefetchAll(true),
        CACHE_CONFIG.INITIAL_PREFETCH_DELAY
      );
    }
    return () => {
      if (timer) clearTimeout(timer);
      debouncedPrefetch.cancel?.();
    };
  }, [isLoggedIn, prefetchAll, debouncedPrefetch]);

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
  }, [debouncedPrefetch, isLoggedIn, prefetchAll]);

  const cleanupUserCache = async (currentUserId: string) => {
    try {
      const allCache = await getAllCache();
      const staleKeys = allCache
        .filter(
          (entry) =>
            (entry.table_key.startsWith(JOB_TYPES_CACHE_KEY) ||
              entry.table_key.startsWith("getJobsCache_") ||
              entry.table_key.startsWith("categoryCache_") ||
              entry.table_key.startsWith("filesCache_") ||
              entry.table_key.startsWith(CONTRACTOR_CACHE_KEY)) &&
            !entry.table_key.includes(`_${currentUserId}`)
        )
        .map((e) => e.table_key);
      for (let i = 0; i < staleKeys.length; i += 20) {
        await Promise.all(staleKeys.slice(i, i + 20).map(deleteCache));
      }
    } catch (err) {
      console.error("[CacheService] Error cleaning up user cache:", err);
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
        errorHandler: (err: any) => handleError(err, "categories"),
      },
      JOB_TYPES: {
        shouldFetch: () =>
          force || isDataStale("JOB_TYPES", lastFetchTimes.current.jobTypes),
        fn: () => prefetchJobTypes(userId),
        inProgressKey: "jobTypes",
        errorHandler: (err: any) => handleError(err, "job types"),
      },
      JOBS: {
        shouldFetch: () =>
          force || isDataStale("JOBS", lastFetchTimes.current.jobs),
        fn: () => prefetchJobs(userId),
        inProgressKey: "jobs",
        errorHandler: (err: any) => handleError(err, "jobs"),
      },
      FILES: {
        shouldFetch: () =>
          force || isDataStale("FILES", lastFetchTimes.current.files),
        fn: () => prefetchFiles(userId),
        inProgressKey: "files",
        errorHandler: (err: any) => handleError(err, "files"),
      },
      CONTRACTORS: {
        shouldFetch: () =>
          force ||
          isDataStale("CONTRACTORS", lastFetchTimes.current.contractors),
        fn: () => prefetchActiveJobContractors(userId),
        inProgressKey: "contractors",
        errorHandler: (err: any) => handleError(err, "contractors"),
      },
    };

    for (const key of Object.keys(map) as Array<keyof typeof map>) {
      const { shouldFetch, fn, inProgressKey, errorHandler } = map[key];
      if (!fetchInProgress.current[inProgressKey] && shouldFetch()) {
        tasks.push(fn().catch(errorHandler));
      }
    }

    await Promise.all(tasks);
  };

  // --------------------------
  // prefetchCategories now uses setCategories
  const prefetchJobTypes = async (userId: string) => {
    const key = `${JOB_TYPES_CACHE_KEY}_${userId}`;

    // Prevent duplicate fetches
    if (fetchInProgress.current.jobTypes) return;
    fetchInProgress.current.jobTypes = true;

    try {
      // First check if we have unexpired cache
      const cacheEntry = await getCache(key);
      const now = Date.now();

      // If cache exists and is fresh, use cached data
      if (
        cacheEntry &&
        cacheEntry.payload &&
        now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.JOB_TYPES
      ) {
        store.dispatch(fetchJobTypes({ userId }));
        lastFetchTimes.current.jobTypes = cacheEntry.updated_at;
        return;
      }

      const { data } = await axios.get(
        `${BASE_API_URL}/jobtypes.php?userid=${userId}`
      );

      if (!data) {
        throw new Error("No data received for job types");
      }

      if (data.status !== 1) {
        console.warn(
          `[CacheService] Job types API returned status: ${data.status}`
        );
      }

      if (!Array.isArray(data.payload)) {
        throw new Error("Invalid job types data structure");
      }

      await setCache(key, data.payload);
      store.dispatch(fetchJobTypes({ userId }));
      lastFetchTimes.current.jobTypes = now;
    } catch (error) {
      console.error("[CacheService] Error fetching job types:", error);
      throw error; // Re-throw for the parent handler
    } finally {
      fetchInProgress.current.jobTypes = false;
    }
  };

  const prefetchJobs = async (userId: string) => {
    const key = `getJobsCache_${userId}`;

    // Prevent duplicate fetches
    if (fetchInProgress.current.jobs) return;
    fetchInProgress.current.jobs = true;

    try {
      // Check cache first
      const cacheEntry = await getCache(key);
      const now = Date.now();

      // If cache exists and is fresh, skip the fetch
      if (
        cacheEntry &&
        cacheEntry.payload &&
        now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.JOBS
      ) {
        lastFetchTimes.current.jobs = cacheEntry.updated_at;
        return;
      }
      const { data } = await axios.get(
        `${BASE_API_URL}/getjobs.php?userid=${userId}`
      );

      if (!data) {
        throw new Error("No data received for jobs");
      }

      if (data.status !== 1) {
        console.warn(`[CacheService] Jobs API returned status: ${data.status}`);
      }

      if (!Array.isArray(data.payload)) {
        throw new Error("Invalid jobs data structure");
      }

      await setCache(key, data.payload);
      lastFetchTimes.current.jobs = now;
    } catch (error) {
      console.error("[CacheService] Error fetching jobs:", error);
      throw error; // Re-throw for the parent handler
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
        const { data } = await axios.get<{
          status: number;
          payload: any[];
        }>(`${BASE_API_URL}/fileuploadcats.php?userid=${userId}`);
        if (data.status !== 1) {
          console.warn(
            `[CacheService] Categories API returned status ${data.status}`
          );
        }
        await setCache(key, data.payload);
        store.dispatch(loadCategories()); // now only when truly fetching fresh
        const { categoryMap, subCategoryMap } = createCategoryMappings(
          data.payload
        );
        store.dispatch(setCategoryMappings({ categoryMap, subCategoryMap }));
        lastFetchTimes.current.categories = now;
      }
    } finally {
      fetchInProgress.current.categories = false;
    }
  };

  const prefetchFiles = async (userId: string) => {
    const key = `filesCache_${userId}`;

    // Prevent duplicate fetches
    if (fetchInProgress.current.files) return;
    fetchInProgress.current.files = true;

    try {
      // Check cache first
      const cacheEntry = await getCache(key);
      const now = Date.now();

      // If cache exists and is fresh, skip the fetch
      if (
        cacheEntry &&
        cacheEntry.payload &&
        now - cacheEntry.updated_at < CACHE_CONFIG.FRESHNESS_DURATION.FILES
      ) {
        lastFetchTimes.current.files = cacheEntry.updated_at;
        return;
      }
      const { data } = await axios.get(
        `${BASE_API_URL}/get-files.php?userid=${userId}`
      );

      if (!data) {
        throw new Error("No data received for files");
      }

      if (data.status !== 1) {
        console.warn(
          `[CacheService] Files API returned status: ${data.status}`
        );
      }

      if (!Array.isArray(data.payload)) {
        throw new Error("Invalid files data structure");
      }

      await setCache(key, data.payload);
      lastFetchTimes.current.files = now;
    } catch (error) {
      console.error("[CacheService] Error fetching files:", error);
      throw error; // Re-throw for the parent handler
    } finally {
      fetchInProgress.current.files = false;
    }
  };

  const prefetchActiveJobContractors = async (userId: string) => {
    const key = `${CONTRACTOR_CACHE_KEY}_${userId}`;

    // Prevent duplicate fetches
    if (fetchInProgress.current.contractors) return;
    fetchInProgress.current.contractors = true;

    try {
      // 1) Try reading the existing cache
      const cacheEntry = await getCache(key);
      const now = Date.now();

      if (
        cacheEntry &&
        cacheEntry.payload &&
        now - cacheEntry.updated_at <
          CACHE_CONFIG.FRESHNESS_DURATION.CONTRACTORS
      ) {
        lastFetchTimes.current.contractors = cacheEntry.updated_at;
        return;
      }
      const { data } = await axios.get(
        `${BASE_API_URL}/contractor.php?userid=${userId}`
      );

      if (!data) {
        throw new Error("No data received for contractors");
      }

      // 3) Normalize to an array
      let contractors: any[] = [];
      if (data.status === 1) {
        if (Array.isArray(data.payload)) {
          contractors = data.payload;
        } else if (data.payload) {
          contractors = [data.payload];
        }
      } else {
        console.warn(
          `[CacheService] Contractors API returned status: ${data.status}`
        );
        contractors = [];
      }

      // 4) Save back into cache, update timestamp
      await setCache(key, contractors);
      lastFetchTimes.current.contractors = now;

      // 5) (optional) dispatch into your store if you need it in Redux
      // store.dispatch(setContractors(contractors));
    } catch (error) {
      console.error("[CacheService] Error fetching contractors:", error);
      throw error; // Re-throw for the parent handler
    } finally {
      fetchInProgress.current.contractors = false;
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
