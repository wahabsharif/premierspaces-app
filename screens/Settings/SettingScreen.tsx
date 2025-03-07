import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import Header from "../../components/Common/Header";
import { RootStackParamList } from "../../types";

type SettingScreenNavigationProp = NavigationProp<
  RootStackParamList,
  "SettingScreen"
>;

const SettingScreen = () => {
  const navigation = useNavigation<SettingScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <Header />
      <Text style={styles.title}>Settings</Text>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate("AppLockSettingScreen")}
      >
        <Text style={styles.menuText}>App Lock</Text>
      </TouchableOpacity>
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
  menuItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  menuText: {
    fontSize: 18,
  },
});

export default SettingScreen;
