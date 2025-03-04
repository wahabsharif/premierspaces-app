import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { AppState, ImageBackground, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CategoryScreen from "./screens/CategoryScreen";
import LockScreen from "./screens/LockScreen";
import LoginScreen from "./screens/LoginScreen";
import SearchPropertyScreen from "./screens/SearchPropertyScreen";
import UploadScreen from "./screens/UploadScreen";
import PropertyListScreen from "./screens/PropertyListScreen";

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <Stack.Navigator
    initialRouteName="LoginScreen"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="LoginScreen" component={LoginScreen} />
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
  const [isPickingImage, setIsPickingImage] = useState(false);

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

  // Make sure to adjust the path to your background image accordingly
  const backgroundImage = require("./assets/background.jpg");

  return (
    <ImageBackground source={backgroundImage} style={styles.background}>
      <SafeAreaView style={styles.container}>
        {isUnlocked ? (
          <NavigationContainer>
            <AppNavigator />
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
});
