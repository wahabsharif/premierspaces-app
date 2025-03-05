// ChangeAppPinScreen.tsx
import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Card, Text } from "react-native-paper";
import * as SecureStore from "expo-secure-store";
import PinInput from "../../components/PinInput";

interface ChangeAppPinScreenProps {
  navigation: any;
}

const ChangeAppPinScreen: React.FC<ChangeAppPinScreenProps> = ({
  navigation,
}) => {
  // Step 1: Verify current PIN, Step 2: Enter new PIN, Step 3: Confirm new PIN
  const [step, setStep] = useState<number>(1);
  const [newPin, setNewPin] = useState<string>("");
  const [pinError, setPinError] = useState<boolean>(false);
  const [pinSuccess, setPinSuccess] = useState<boolean>(false);

  const handlePinSubmit = async (pin: string) => {
    if (step === 1) {
      // Verify the current PIN
      const storedPin = await SecureStore.getItemAsync("app_pin");
      if (pin === storedPin) {
        setStep(2);
      } else {
        setPinError(true);
        setTimeout(() => setPinError(false), 500);
      }
    } else if (step === 2) {
      // Store new PIN temporarily and move to confirmation step
      setNewPin(pin);
      setStep(3);
    } else if (step === 3) {
      // Confirm the new PIN matches the previously entered value
      if (pin === newPin) {
        await SecureStore.setItemAsync("app_pin", newPin);
        setPinSuccess(true);
        Alert.alert("Success", "Your PIN has been updated successfully!", [
          {
            text: "OK",
            onPress: () => {
              if (navigation) {
                navigation.goBack(); // return to AppLockSettingScreen
              }
            },
          },
        ]);
      } else {
        setPinError(true);
        Alert.alert("Error", "PINs do not match. Please try again.");
        setStep(2);
        setTimeout(() => setPinError(false), 500);
      }
    }
  };

  // Update the title and subtitle based on the current step
  let title = "";
  let subtitle = "";
  if (step === 1) {
    title = "Verify Current PIN";
    subtitle = "Enter your current 4-digit PIN";
  } else if (step === 2) {
    title = "Enter New PIN";
    subtitle = "Enter a new 4-digit PIN";
  } else if (step === 3) {
    title = "Confirm New PIN";
    subtitle = "Re-enter your new 4-digit PIN";
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <PinInput
            onSubmit={handlePinSubmit}
            error={pinError}
            success={pinSuccess}
          />
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

export default ChangeAppPinScreen;
