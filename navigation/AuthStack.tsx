import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";
import SearchPropertyScreen from "../screens/SearchPropertyScreen";

export type AuthStackParamList = {
  Login: undefined;
  SearchProperty: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="SearchProperty" component={SearchPropertyScreen} />
    </Stack.Navigator>
  );
}
