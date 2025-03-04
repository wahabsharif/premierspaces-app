import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Header from "../components/Header";
import AppLockToggle from "../components/AppLockToggle";

const SettingScreen = () => {
  return (
    <View style={styles.container}>
      <Header />
      <Text style={styles.title}>Settings</Text>
      <AppLockToggle />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    marginLeft: 20,
    marginVertical: 20,
    fontWeight: "bold",
  },
});

export default SettingScreen;
