import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { NavigationContainer } from "@react-navigation/native";
import axios from "axios";
import * as Application from "expo-application";
import { SQLiteProvider } from "expo-sqlite";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  ImageBackground,
  LogBox,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { Provider as ReduxProvider } from "react-redux";
import ToastManager, { Toast } from "toastify-react-native";
import NetworkStatus from "./components/Common/NetworkStatus";
import { BASE_API_URL, JOB_TYPES_CACHE_KEY } from "./Constants/env";
import { fontSize } from "./Constants/theme";
import { AppNavigator } from "./navigation/AppNavigator";
import LockScreen from "./screens/LockScreen";
import LoginScreen from "./screens/LoginScreen";
import { store } from "./store";
import { fetchJobTypes } from "./store/jobSlice";

LogBox.ignoreLogs(["useInsertionEffect must not schedule updates"]);
// LogBox.ignoreAllLogs();

// Cache utility functions
const saveToCache = async (key: string, data: any) => {
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.error("Error saving to cache:", error);
  }
};

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Prefetch job types when app loads
  interface JobType {
    id: string;
    name: string;
    [key: string]: any; // Add additional fields if necessary
  }

  interface PrefetchJobTypesResponse {
    payload: JobType[];
  }

  const prefetchJobTypes = async (userId: string): Promise<void> => {
    if (!userId) return;

    try {
      const cacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;
      const isConnected = await NetInfo.fetch().then(
        (state) => state.isConnected
      );

      if (isConnected) {
        const resp = await axios.get<PrefetchJobTypesResponse>(
          `${BASE_API_URL}/jobtypes.php?userid=${userId}`
        );
        const jobTypes = resp.data.payload;

        if (jobTypes && Array.isArray(jobTypes)) {
          await saveToCache(cacheKey, jobTypes);
          console.log(
            "Job types cached successfully during app initialization"
          );

          // Also dispatch to Redux store to keep it in sync
          store.dispatch(fetchJobTypes({ userId }));
        }
      } else {
        console.log("Offline during initialization, will use existing cache");
      }
    } catch (error) {
      console.error("Error prefetching job types:", error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const [userData, appLockEnabled, storedVersion] = await Promise.all([
          AsyncStorage.getItem("userData"),
          AsyncStorage.getItem("app_lock_enabled"),
          AsyncStorage.getItem("app_version"),
        ]);

        if (userData) {
          setIsLoggedIn(true);
          Toast.success("Welcome back!");

          // Get userId and prefetch job types
          const userObj = JSON.parse(userData);
          const userId = userObj.payload?.userid ?? userObj.userid;
          if (userId) {
            prefetchJobTypes(userId);
          }
        } else {
          setIsLoggedIn(false);
        }

        setIsUnlocked(appLockEnabled === "false" || appLockEnabled === null);

        const currentVersion = Application.nativeApplicationVersion || "0.0.0";
        if (storedVersion !== currentVersion) {
          await AsyncStorage.removeItem("userData");
          setIsLoggedIn(false);
          Toast.info("App updated, please log in again.");
          await AsyncStorage.setItem("app_version", currentVersion);
        }
      } catch (error) {
        Toast.error("Failed to initialize app");
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (
      nextAppState: AppStateStatus
    ): Promise<void> => {
      try {
        const appLockEnabled = await AsyncStorage.getItem("app_lock_enabled");
        if (
          nextAppState === "background" &&
          appLockEnabled === "true" &&
          !isPickingImage
        ) {
          setIsUnlocked(false);
          Toast.info("App locked for security");
        }

        // Refresh job types when app comes to foreground
        if (nextAppState === "active" && isLoggedIn) {
          const userData = await AsyncStorage.getItem("userData");
          if (userData) {
            const userObj = JSON.parse(userData);
            const userId = userObj.payload?.userid ?? userObj.userid;
            if (userId) {
              prefetchJobTypes(userId);
            }
          }
        }
      } catch (error) {
        Toast.error("Error handling app state");
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, [isPickingImage, isLoggedIn]);

  const backgroundImage = require("./assets/background.jpg");

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#347ab8" />
      </SafeAreaView>
    );
  }

  return (
    <PaperProvider>
      <SQLiteProvider databaseName="premierDatabase.db">
        <ReduxProvider store={store}>
          <SafeAreaView style={styles.container}>
            <NetworkStatus />
            <ToastManager
              position="bottom"
              style={{
                flexDirection: "column-reverse",
                justifyContent: "flex-end",
                fontSize: fontSize.xs,
                width: "100%",
                padding: 10,
              }}
            />

            <ImageBackground source={backgroundImage} style={styles.background}>
              <NavigationContainer>
                {isUnlocked ? (
                  isLoggedIn ? (
                    <AppNavigator setIsPickingImage={setIsPickingImage} />
                  ) : (
                    <LoginScreen
                      onLoginSuccess={() => {
                        setIsLoggedIn(true);
                        Toast.success("Login successful!");
                      }}
                    />
                  )
                ) : (
                  <LockScreen
                    onUnlock={() => {
                      setIsUnlocked(true);
                      Toast.success("Unlocked!");
                    }}
                  />
                )}
              </NavigationContainer>
            </ImageBackground>
          </SafeAreaView>
        </ReduxProvider>
      </SQLiteProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "cover",
  },
  container: {
    flex: 1,
    paddingTop: 25,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
});
