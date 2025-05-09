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
} from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

import { BASE_API_URL, JOB_TYPES_CACHE_KEY } from "../Constants/env";
import styles from "../Constants/styles";
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
  const [cacheComplete, setCacheComplete] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const navigation = useNavigation();

  // Any 401 error triggers session-expired modal
  const handleError = (err: any) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      if (!isLoginScreen) {
        setShowSessionExpired(true);
      }
    }
    throw err;
  };

  const prefetchAll = useCallback(
    async (force = false) => {
      if (loading || (cacheComplete && !force)) return;
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
        await prefetchUserData(userId);
      } catch (error) {
        console.error("[CacheService] Prefetch error:", error);
      } finally {
        setLoading(false);
      }
    },
    [loading, cacheComplete, navigation, isLoginScreen]
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

  // Kick off or cancel prefetch on login/logout
  useEffect(() => {
    if (isLoggedIn) {
      setCacheComplete(false);
      debouncedPrefetch();
    } else {
      setCacheComplete(false);
      debouncedPrefetch.cancel?.();
    }
  }, [isLoggedIn, debouncedPrefetch]);

  // Retry on reconnect
  useEffect(() => {
    let first = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (first) {
        first = false;
        return;
      }
      if (state.isConnected && isLoggedIn) {
        debouncedPrefetch(true);
      }
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

  // Orchestrate all four fetches in parallel
  const prefetchUserData = async (userId: string) => {
    try {
      const results = await Promise.allSettled([
        prefetchJobTypes(userId).catch(handleError),
        prefetchJobs(userId).catch(handleError),
        prefetchCategories(userId).catch(handleError),
        prefetchFiles(userId).catch(handleError),
      ]);

      if (results.every((r) => r.status === "fulfilled")) {
        setCacheComplete(true);
      } else {
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
    const { data } = await axios.get(
      `${BASE_API_URL}/jobtypes.php?userid=${userId}`
    );
    if (!Array.isArray(data.payload)) {
      throw new Error("Invalid job types data");
    }
    await setCache(key, data.payload);
    store.dispatch(fetchJobTypes({ userId }));
  };

  const prefetchJobs = async (userId: string) => {
    const key = `getJobsCache_${userId}`;
    const { data } = await axios.get(
      `${BASE_API_URL}/getjobs.php?userid=${userId}`
    );
    if (data.status !== 1 || !Array.isArray(data.payload)) {
      throw new Error("Invalid jobs data");
    }
    await setCache(key, data.payload);
  };

  const prefetchCategories = async (userId: string) => {
    const key = `categoryCache_${userId}`;
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
  };

  const prefetchFiles = async (userId: string) => {
    const key = `filesCache_${userId}`;
    const { data } = await axios.get(
      `${BASE_API_URL}/get-files.php?userid=${userId}`
    );
    if (data.status !== 1 || !Array.isArray(data.payload)) {
      throw new Error("Invalid files data");
    }
    await setCache(key, data.payload);
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
