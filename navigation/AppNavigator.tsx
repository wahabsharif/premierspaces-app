import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";

import SearchPropertyScreen from "../screens/SearchPropertyScreen";
import CategoryScreen from "../screens/CategoryScreen";
import UploadScreen from "../screens/UploadScreen";
import SettingScreen from "../screens/Settings/SettingScreen";
import AppLockSettingScreen from "../screens/Settings/AppLockSettingScreen";
import ChangeAppPinScreen from "../screens/Settings/ChangeAppPinScreen";
import PendingDataScreen from "../screens/Pendings/PendingDataScreen";
import LoginScreen from "../screens/LoginScreen";
import JobsScreen from "../screens/JobsScreen";
import OpenNewJobScreen from "../screens/OpenNewJobScreen";
import JobDetailScreen from "../screens/JobDetailScreen";
import MediaPreviewScreen from "../screens/MediaPreviewScreen";
import FilesScreen from "../screens/FilesScreen";

export type AppNavigatorProps = {
  setIsPickingImage: (value: boolean) => void;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = ({ setIsPickingImage }: AppNavigatorProps) => (
  <Stack.Navigator
    initialRouteName="SearchPropertyScreen"
    screenOptions={{ headerShown: false }}
    screenListeners={() => ({
      state: (e) => {
        const route = e.data.state.routes[e.data.state.index];
        const currentParams = route.params as
          | { isPickingImage?: boolean }
          | undefined;
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
    <Stack.Screen name="JobsScreen" component={JobsScreen} />
    <Stack.Screen name="OpenNewJobScreen" component={OpenNewJobScreen} />
    <Stack.Screen name="JobDetailScreen" component={JobDetailScreen} />
    <Stack.Screen name="MediaPreviewScreen" component={MediaPreviewScreen} />
    <Stack.Screen name="FilesScreen" component={FilesScreen} />
    <Stack.Screen name="PendingDataScreen" component={PendingDataScreen} />
  </Stack.Navigator>
);
