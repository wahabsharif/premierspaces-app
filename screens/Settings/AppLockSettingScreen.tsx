import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import React, { useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import AppLockToggle from "../../components/AppLock/AppLockToggle";
import Header from "../../components/Common/Header";
import styles from "../../Constants/styles";
import LockScreen from "../../screens/LockScreen";
import { RootStackParamList } from "../../types";

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
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <Text style={styles.heading}>App Lock Settings</Text>
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
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("ChangeAppPinScreen")}
        >
          <Text style={styles.buttonText}>Change App PIN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AppLockSettingScreen;
