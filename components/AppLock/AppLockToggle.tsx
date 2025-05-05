import React, { useEffect, useState } from "react";
import { View, Switch, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { color, fontSize } from "../../Constants/theme";
import styles from "../../Constants/styles";

interface AppLockToggleProps {
  onLockEnable?: () => void;
}

const AppLockToggle: React.FC<AppLockToggleProps> = ({ onLockEnable }) => {
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);

  useEffect(() => {
    const fetchAppLockStatus = async () => {
      try {
        const value = await AsyncStorage.getItem("app_lock_enabled");
        if (value !== null) {
          setIsAppLockEnabled(value === "true");
        }
      } catch (error) {
        // // console.error("Error fetching app lock status:", error);
      }
    };

    fetchAppLockStatus();
  }, []);

  const toggleSwitch = async () => {
    try {
      const newValue = !isAppLockEnabled;
      setIsAppLockEnabled(newValue);
      await AsyncStorage.setItem("app_lock_enabled", newValue.toString());
      if (newValue && onLockEnable) {
        onLockEnable();
      }
    } catch (error) {
      // // console.error("Error saving app lock status:", error);
    }
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 10,
        justifyContent: "space-between",
        width: "100%",
        borderBottomColor: color.secondary,
        borderBottomWidth: 1,
      }}
    >
      <Text style={styles.label}>Enable App Lock</Text>
      <Switch onValueChange={toggleSwitch} value={isAppLockEnabled} />
    </View>
  );
};

export default AppLockToggle;
