import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "./screens/LoginScreen";
import CategoryScreen from "./screens/CategoryScreen";
import UploadScreen from "./screens/UploadScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LoginScreen">
        <Stack.Screen
          name="LoginScreen"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
        <Stack.Screen name="UploadScreen" component={UploadScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
