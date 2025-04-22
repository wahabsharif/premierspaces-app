import Constants from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState, useCallback } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Button, Card, Dialog, Portal } from "react-native-paper";
import PinInput from "../components/AppLock/PinInput";
import styles from "../Constants/styles";
import { color } from "../Constants/theme";

interface LockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [isPinSet, setIsPinSet] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertCallback, setAlertCallback] = useState<(() => void) | null>(null);

  // Create a memoized version of the biometric authentication function
  const attemptBiometricAuth = useCallback(async () => {
    try {
      console.log("Starting biometric authentication...");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock with Fingerprint or Face ID",
        fallbackLabel: "Use PIN",
        disableDeviceFallback: false,
      });
      console.log("Biometric auth result:", result);
      if (result.success) {
        console.log("Biometric auth successful");
        onUnlock();
      } else {
        console.log("Biometric auth failed:", result.error);
        showAlert(
          "Authentication Failed",
          "Biometric authentication didn’t work. Please enter your PIN."
        );
      }
    } catch (error) {
      console.error("Biometric authentication error:", error);
      showAlert(
        "Error",
        "Biometric authentication failed. Please try again or use PIN."
      );
    }
  }, [onUnlock]);

  const isBiometricSupported = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    return hasHardware && supportedTypes.length > 0;
  }, []);

  // Main initialization effect
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        console.log("Initializing authentication...");
        const storedPin = await SecureStore.getItemAsync("app_pin");

        if (!isMounted) return;

        if (storedPin) {
          setIsPinSet(true);
          const biometricsEnabled = await SecureStore.getItemAsync(
            "biometrics_enabled"
          );
          const isBiometricAvailable = await isBiometricSupported();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          console.log(
            "PIN set, biometrics enabled:",
            biometricsEnabled,
            "available:",
            isBiometricAvailable,
            "enrolled:",
            isEnrolled
          );

          if (!isMounted) return;

          if (
            biometricsEnabled === "true" &&
            isBiometricAvailable &&
            isEnrolled
          ) {
            setIsBiometricsEnabled(true);
            console.log("Scheduling biometric auth");
            setTimeout(() => {
              if (isMounted) {
                console.log("Attempting biometric auth now");
                attemptBiometricAuth();
              }
            }, 1000);
          }
        } else {
          setIsSettingPin(true);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (isMounted) {
          setIsSettingPin(true);
        }
      }
    };

    initializeAuth();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [isBiometricSupported, attemptBiometricAuth]);

  const handlePinSubmit = async (pin: string) => {
    if (isSettingPin) {
      await SecureStore.setItemAsync("app_pin", pin);
      setIsPinSet(true);
      setIsSettingPin(false);

      if (await isBiometricSupported()) {
        showAlert(
          "Enable Biometrics?",
          "Would you like to use fingerprint or Face ID?",
          async () => {
            await SecureStore.setItemAsync("biometrics_enabled", "true");
            setIsBiometricsEnabled(true);
            // Try to trigger biometric auth right after enabling
            setTimeout(() => attemptBiometricAuth(), 300);
          }
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

  // Custom Alert Function
  const showAlert = (title: string, message: string, callback?: () => void) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertCallback(() => callback || null);
    setAlertVisible(true);
  };

  return (
    <View style={styles.pinContainer}>
      <Image
        source={require("../assets/logo.png")}
        style={styles.pinLogo}
        resizeMode="contain"
      />
      <Text style={localStyles.versionText}>
        Version: {Constants.expoConfig?.version || "N/A"}
      </Text>

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

      <Portal>
        <Dialog visible={alertVisible} onDismiss={() => setAlertVisible(false)}>
          <Dialog.Title>{alertTitle}</Dialog.Title>
          <Dialog.Content>
            <Text>{alertMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setAlertVisible(false);
                if (alertCallback) alertCallback();
              }}
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const localStyles = StyleSheet.create({
  versionText: {
    fontSize: 14,
    color: color.gray,
    textAlign: "center",
    marginBottom: 20,
  },
});

export default LockScreen;
