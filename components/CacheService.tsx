import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import React, { ReactNode, useEffect, useState } from "react";
import { BASE_API_URL, JOB_TYPES_CACHE_KEY } from "../Constants/env";
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
        if (userData) {
          const userObj = JSON.parse(userData);
          const userId = userObj.payload?.userid ?? userObj.userid;
          if (userId) {
            const cacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;
            const resp = await axios.get<PrefetchResponse>(
              `${BASE_API_URL}/jobtypes.php?userid=${userId}`
            );
            const jobTypes = resp.data.payload;
            if (Array.isArray(jobTypes)) {
              await AsyncStorage.setItem(
                cacheKey,
                JSON.stringify({ timestamp: Date.now(), data: jobTypes })
              );
              store.dispatch(fetchJobTypes({ userId }));
            }
          }
        }
      } catch (err) {
        console.error("CacheService: error fetching data", err);
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
