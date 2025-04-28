import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SearchPropertyScreen from "../../screens/SearchPropertyScreen";
import CategoryScreen from "../../screens/CategoryScreen";
import UploadScreen from "../../screens/UploadScreen";
import SettingScreen from "../../screens/Settings/SettingScreen";
import AppLockSettingScreen from "../../screens/Settings/AppLockSettingScreen";
import ChangeAppPinScreen from "../../screens/Settings/ChangeAppPinScreen";
import LoginScreen from "../../screens/LoginScreen";
import JobsScreen from "../../screens/JobsScreen";
import OpenNewJobScreen from "../../screens/OpenNewJobScreen";
import JobDetailScreen from "../../screens/JobDetailScreen";
import MediaPreviewScreen from "../../screens/MediaPreviewScreen";

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
    <Stack.Screen name="LoginScreen" component={LoginScreen} />
    <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
    <Stack.Screen name="UploadScreen" component={UploadScreen} />
    <Stack.Screen name="SettingScreen" component={SettingScreen} />
    <Stack.Screen
      name="AppLockSettingScreen"
      component={AppLockSettingScreen}
    />
    <Stack.Screen name="ChangeAppPinScreen" component={ChangeAppPinScreen} />
    <Stack.Screen
      name="JobsScreen"
      component={JobsScreen as React.ComponentType<any>}
    />
    <Stack.Screen
      name="OpenNewJobScreen"
      component={OpenNewJobScreen as React.ComponentType<any>}
    />
    <Stack.Screen
      name="JobDetailScreen"
      component={JobDetailScreen as React.ComponentType<any>}
    />
    <Stack.Screen
      name="MediaPreviewScreen"
      component={MediaPreviewScreen as React.ComponentType<any>}
    />
  </Stack.Navigator>
);
