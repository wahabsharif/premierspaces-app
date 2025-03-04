import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import PinInput from "../components/PinInput";

interface LockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [isPinSet, setIsPinSet] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

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
        setIsSettingPin(true);
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

  const handlePinSubmit = async (pin: string) => {
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
        setPinSuccess(true);
        setTimeout(() => {
          onUnlock();
          setPinSuccess(false);
        }, 500);
      } else {
        setPinError(true);
        setTimeout(() => setPinError(false), 500);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          {isSettingPin ? (
            <>
              <Text style={styles.title}>Setup Lock</Text>
              <Text style={styles.subtitle}>Please set a 4-digit PIN</Text>
              <PinInput
                onSubmit={handlePinSubmit}
                error={pinError}
                success={pinSuccess}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter Your PIN</Text>
              <PinInput
                onSubmit={handlePinSubmit}
                onBiometric={attemptBiometricAuth}
                error={pinError}
                success={pinSuccess}
              />
            </>
          )}
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "85%",
    padding: 25,
    elevation: 8,
    borderRadius: 15,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
  },
});

export default LockScreen;
