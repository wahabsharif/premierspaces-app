// AppLockSettingScreen.tsx
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";
import AppLockToggle from "../../components/AppLock/AppLockToggle";
import Header from "../../components/Common/Header";
import { color, fontSize } from "../../Constants/theme";
import LockScreen from "../../screens/LockScreen";
import { RootStackParamList } from "../../types";
import { Modal } from "react-native";

type AppLockSettingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "AppLockSettingScreen"
>;

const AppLockSettingScreen = () => {
  const navigation = useNavigation<AppLockSettingScreenNavigationProp>();
  const [showSetupLock, setShowSetupLock] = useState(false);

  const handleLockEnable = () => {
    setShowSetupLock(true);
  };

  const handleUnlock = () => {
    setShowSetupLock(false);
  };

  return (
    <View style={styles.container}>
      <Header />
      <Text style={styles.title}>App Lock Settings</Text>
      <AppLockToggle onLockEnable={handleLockEnable} />
      {showSetupLock && (
        <Modal
          transparent={true}
          animationType="fade"
          onRequestClose={handleUnlock}
        >
          <LockScreen onUnlock={handleUnlock} />
        </Modal>
      )}
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
    fontSize: fontSize.xl,
    margin: 20,
    fontWeight: "600",
    marginBottom: 20,
    color: color.gray,
    textAlign: "left",
  },
  button: {
    margin: 20,
    marginBottom: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: color.primary,
    color: color.white,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default AppLockSettingScreen;
