import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import * as Application from "expo-application";
import { SQLiteProvider } from "expo-sqlite";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  ImageBackground,
  LogBox,
  StyleSheet,
  StatusBar,
} from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { Provider as ReduxProvider } from "react-redux";
import ToastManager, { Toast } from "toastify-react-native";
import { CacheService, DataSyncManager, NetworkStatus } from "./components";
import { fontSize } from "./Constants/theme";
import { AppNavigator } from "./navigation/AppNavigator";
import LockScreen from "./screens/LockScreen";
import LoginScreen from "./screens/LoginScreen";
import { store } from "./store";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

LogBox.ignoreLogs(["useInsertionEffect must not schedule updates"]);

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const insets = useSafeAreaInsets();

  // Initialization: check login, lock, version
  useEffect(() => {
    const init = async () => {
      try {
        const [userData, lockEnabled, storedVersion] = await Promise.all([
          AsyncStorage.getItem("userData"),
          AsyncStorage.getItem("app_lock_enabled"),
          AsyncStorage.getItem("app_version"),
        ]);

        if (userData) {
          setIsLoggedIn(true);
          Toast.success("Welcome back!");
        }
        setIsUnlocked(lockEnabled !== "true");

        const currentVersion = Application.nativeApplicationVersion || "0.0.0";
        if (storedVersion !== currentVersion) {
          await AsyncStorage.removeItem("userData");
          setIsLoggedIn(false);
          Toast.info("App updated, please log in again.");
          await AsyncStorage.setItem("app_version", currentVersion);
        }
      } catch (err) {
        Toast.error("Initialization failed");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Lock app on background if needed
  useEffect(() => {
    const onChange = async (nextState: AppStateStatus) => {
      const lockEnabled = await AsyncStorage.getItem("app_lock_enabled");
      if (
        nextState === "background" &&
        lockEnabled === "true" &&
        !isPickingImage
      ) {
        setIsUnlocked(false);
        Toast.info("App locked for security");
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [isPickingImage]);

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
          <CacheService isLoggedIn={isLoggedIn}>
            <DataSyncManager>
              <StatusBar
                barStyle="dark-content"
                backgroundColor="transparent"
                translucent
              />

              <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
                <NetworkStatus />
                <ToastManager
                  position="bottom"
                  style={{
                    flexDirection: "column-reverse",
                    justifyContent: "flex-end",
                    width: "100%",
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                  }}
                  textStyle={{
                    fontSize: fontSize.xs,
                    lineHeight: fontSize.xs * 1.4,
                    flexWrap: "wrap",
                    includeFontPadding: false,
                  }}
                />
                <ImageBackground
                  source={require("./assets/background.jpg")}
                  style={styles.background}
                >
                  <NavigationContainer>
                    {isUnlocked ? (
                      isLoggedIn ? (
                        <AppNavigator setIsPickingImage={setIsPickingImage} />
                      ) : (
                        <LoginScreen
                          onLoginSuccess={() => setIsLoggedIn(true)}
                        />
                      )
                    ) : (
                      <LockScreen onUnlock={() => setIsUnlocked(true)} />
                    )}
                  </NavigationContainer>
                </ImageBackground>
              </SafeAreaView>
            </DataSyncManager>
          </CacheService>
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
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
});
