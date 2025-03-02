import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppState, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LoginScreen from "./screens/LoginScreen";
import CategoryScreen from "./screens/CategoryScreen";
import UploadScreen from "./screens/UploadScreen";
import LockScreen from "./screens/LockScreen";

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <Stack.Navigator
    initialRouteName="LoginScreen"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="LoginScreen" component={LoginScreen} />
    <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
    <Stack.Screen name="UploadScreen" component={UploadScreen} />
  </Stack.Navigator>
);

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false); // Track image selection

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

  return (
    <SafeAreaView style={styles.container}>
      {isUnlocked ? (
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      ) : (
        <LockScreen onUnlock={() => setIsUnlocked(true)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
