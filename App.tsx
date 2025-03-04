import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  ImageBackground,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CategoryScreen from "./screens/CategoryScreen";
import LockScreen from "./screens/LockScreen";
import LoginScreen from "./screens/LoginScreen";
import PropertyListScreen from "./screens/PropertyListScreen";
import SearchPropertyScreen from "./screens/SearchPropertyScreen";
import UploadScreen from "./screens/UploadScreen";

const Stack = createNativeStackNavigator();

const AppNavigator = ({
  setIsPickingImage,
}: {
  setIsPickingImage: (value: boolean) => void;
}) => (
  <Stack.Navigator
    screenOptions={{ headerShown: false }}
    screenListeners={({
      route,
    }: {
      route: { params?: { isPickingImage?: boolean } };
    }) => ({
      state: (e) => {
        // Update isPickingImage based on route params
        const currentParams = route.params;
        if (currentParams?.isPickingImage !== undefined) {
          setIsPickingImage(currentParams.isPickingImage);
        }
      },
    })}
  >
    <Stack.Screen
      name="SearchPropertyScreen"
      component={SearchPropertyScreen}
    />
    <Stack.Screen name="PropertyListScreen" component={PropertyListScreen} />
    <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
    <Stack.Screen name="UploadScreen" component={UploadScreen} />
  </Stack.Navigator>
);

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
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === "background" && !isPickingImage) {
        setIsUnlocked(false);
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
              <LoginScreen />
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
