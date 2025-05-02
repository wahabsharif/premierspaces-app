import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import * as Application from "expo-application";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  ImageBackground,
  StyleSheet,
} from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import ToastManager, { Toast } from "toastify-react-native";

import { AppNavigator } from "./components/Common/AppNavigator";
import NetworkStatus from "./components/Common/NetworkStatus";
import LockScreen from "./screens/LockScreen";
import LoginScreen from "./screens/LoginScreen";

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
          console.log("Latest User Data Stored in Storage:", userData);
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
        console.error("Error initializing app:", error);
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
      } catch (error) {
        console.error("Error handling app state change:", error);
        Toast.error("Error handling app state");
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, [isPickingImage]);

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
      <NetworkStatus />
      <ToastManager
        position="bottom"
        style={{ flexDirection: "column-reverse", justifyContent: "flex-end" }}
      />

      <ImageBackground source={backgroundImage} style={styles.background}>
        <SafeAreaView style={styles.container}>
          {isUnlocked ? (
            <NavigationContainer>
              {isLoggedIn ? (
                <AppNavigator setIsPickingImage={setIsPickingImage} />
              ) : (
                <LoginScreen
                  onLoginSuccess={() => {
                    setIsLoggedIn(true);
                    Toast.success("Login successful!");
                  }}
                />
              )}
            </NavigationContainer>
          ) : (
            <LockScreen
              onUnlock={() => {
                setIsUnlocked(true);
                Toast.success("Unlocked!");
              }}
            />
          )}
        </SafeAreaView>
      </ImageBackground>
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
