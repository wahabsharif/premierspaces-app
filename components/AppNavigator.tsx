// AppNavigator.tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Import your screens
import SearchPropertyScreen from "../screens/SearchPropertyScreen";
import PropertyListScreen from "../screens/PropertyListScreen";
import CategoryScreen from "../screens/CategoryScreen";
import UploadScreen from "../screens/UploadScreen";
import SettingScreen from "../screens/SettingScreen";

export type AppNavigatorProps = {
  setIsPickingImage: (value: boolean) => void;
};

const Stack = createNativeStackNavigator();

export const AppNavigator = ({
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
    <Stack.Screen name="SettingScreen" component={SettingScreen} />
  </Stack.Navigator>
);
