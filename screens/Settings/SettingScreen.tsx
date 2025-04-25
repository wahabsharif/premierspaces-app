import { NavigationProp, useNavigation } from "@react-navigation/native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Header from "../../components/Common/Header";
import styles from "../../Constants/styles";
import { fontSize } from "../../Constants/theme";
import { RootStackParamList } from "../../types";

type SettingScreenNavigationProp = NavigationProp<
  RootStackParamList,
  "SettingScreen"
>;

const SettingScreen = () => {
  const navigation = useNavigation<SettingScreenNavigationProp>();

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <Text style={styles.heading}>Settings</Text>
        <TouchableOpacity
          style={{
            padding: 15,
            borderBottomWidth: 2,
            borderBottomColor: "#ddd",
            width: "100%",
          }}
          onPress={() => navigation.navigate("AppLockSettingScreen")}
        >
          <Text style={{ fontSize: fontSize.medium }}>App Lock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SettingScreen;
