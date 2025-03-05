// AppLockSettingScreen.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../types";
import AppLockToggle from "../../components/AppLock/AppLockToggle";
import Header from "../../components/Common/Header";

// Define the type for the navigation prop
type AppLockSettingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "AppLockSettingScreen"
>;

const AppLockSettingScreen = () => {
  const navigation = useNavigation<AppLockSettingScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <Header />
      <Text style={styles.title}>App Lock Settings</Text>
      <AppLockToggle />
      <Button
        style={styles.button}
        mode="contained"
        onPress={() => navigation.navigate("ChangeAppPinScreen")}
      >
        Change App PIN
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  title: {
    fontSize: 24,
    margin: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
    textAlign: "left",
  },
  button: {
    margin: 20,
    marginBottom: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#347ab8",
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default AppLockSettingScreen;
