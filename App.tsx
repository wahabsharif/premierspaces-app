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
        }
      } catch (error) {
        console.error("Error checking login status:", error);
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
        }
      } catch (error) {
        console.error("Error handling app state change:", error);
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
    <ImageBackground source={backgroundImage} style={styles.background}>
      <SafeAreaView style={styles.container}>
        {isUnlocked ? (
          <NavigationContainer>
            {isLoggedIn ? (
              <AppNavigator setIsPickingImage={setIsPickingImage} />
            ) : (
              <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />
            )}
          </NavigationContainer>
        ) : (
          <LockScreen onUnlock={() => setIsUnlocked(true)} />
        )}
      </SafeAreaView>
    </ImageBackground>
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
