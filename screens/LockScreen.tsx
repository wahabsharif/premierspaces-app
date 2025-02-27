import React, { useState, useEffect } from "react";
import { View, Button, Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import PinInput from "../components/PinInput";

interface LockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [isPinSet, setIsPinSet] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedPin = await SecureStore.getItemAsync("app_pin");
      if (storedPin) {
        setIsPinSet(true);
        const biometricsEnabled = await SecureStore.getItemAsync(
          "biometrics_enabled"
        );
        if (biometricsEnabled === "true" && (await isBiometricSupported())) {
          setIsBiometricsEnabled(true);
          attemptBiometricAuth();
        }
      } else {
        setIsSettingPin(true); // Prompt to set PIN
      }
    };
    initializeAuth();
  }, []);

  const isBiometricSupported = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    return hasHardware && supportedTypes.length > 0;
  };

  const attemptBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock with Fingerprint or Face ID",
        fallbackLabel: "Use PIN",
      });
      if (result.success) {
        onUnlock();
      }
    } catch (error) {
      Alert.alert("Error", "Biometric authentication failed.");
    }
  };

  interface PinSubmitHandler {
    (pin: string): Promise<void>;
  }

  const handlePinSubmit: PinSubmitHandler = async (pin) => {
    if (isSettingPin) {
      await SecureStore.setItemAsync("app_pin", pin);
      setIsPinSet(true);
      setIsSettingPin(false);
      if (await isBiometricSupported()) {
        Alert.alert(
          "Enable Biometrics?",
          "Would you like to use fingerprint or Face ID?",
          [
            { text: "No", style: "cancel" },
            {
              text: "Yes",
              onPress: async () => {
                await SecureStore.setItemAsync("biometrics_enabled", "true");
                setIsBiometricsEnabled(true);
                attemptBiometricAuth();
              },
            },
          ]
        );
      } else {
        onUnlock();
      }
    } else {
      const storedPin = await SecureStore.getItemAsync("app_pin");
      if (pin === storedPin) {
        onUnlock();
      } else {
        Alert.alert("Error", "Incorrect PIN");
      }
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <PinInput
        onSubmit={handlePinSubmit}
        title={isSettingPin ? "Set a 4-Digit PIN" : "Enter Your PIN"}
      />
      {isPinSet && !isSettingPin && (
        <Button
          title="Use Fingerprint/Face ID"
          onPress={attemptBiometricAuth}
        />
      )}
    </View>
  );
};

export default LockScreen;
