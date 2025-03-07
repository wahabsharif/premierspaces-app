import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Button, Card, Dialog, Portal, Text } from "react-native-paper";
import PinInput from "../components/Common/PinInput";
import styles from "../Constants/styles";
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
      showAlert("Error", "Biometric authentication failed.");
    }
  };

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
            attemptBiometricAuth();
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
        source={require("../assets/icon.png")}
        style={styles.pinLogo}
        resizeMode="contain"
      />
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

      {/* Custom Alert Dialog */}
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

export default LockScreen;
