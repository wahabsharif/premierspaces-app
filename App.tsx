import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  ImageBackground,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Provider as PaperProvider } from "react-native-paper";
import ToastManager, { Toast } from "toastify-react-native";

import { AppNavigator } from "./components/Common/AppNavigator";
import LockScreen from "./screens/LockScreen";
import LoginScreen from "./screens/LoginScreen";

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userData = await AsyncStorage.getItem("userData");
        if (userData) {
          setIsLoggedIn(true);
          Toast.success("Welcome back!");
        }
      } catch (error) {
        console.error("Error checking login status:", error);
        Toast.error("Failed to check login status");
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  useEffect(() => {
    const checkAppLockStatus = async () => {
      try {
        const appLockEnabled = await AsyncStorage.getItem("app_lock_enabled");
        if (appLockEnabled === "false" || appLockEnabled === null) {
          setIsUnlocked(true);
        }
      } catch (error) {
        console.error("Error checking app lock status:", error);
        Toast.error("Failed to check app lock status");
      }
    };
    checkAppLockStatus();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
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
      <ToastManager />
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
