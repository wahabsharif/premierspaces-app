import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import Header from "../../components/Common/Header";
import { RootStackParamList } from "../../types";
import { fontSize } from "../../Constants/theme";

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
  },
  title: {
    fontSize: fontSize.xl,
    marginLeft: 20,
    marginVertical: 20,
    fontWeight: "600",
  },
  menuItem: {
    padding: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#ddd",
  },
  menuText: {
    fontSize: fontSize.medium,
  },
});

export default SettingScreen;
