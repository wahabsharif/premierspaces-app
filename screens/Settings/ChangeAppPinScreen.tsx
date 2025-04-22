import * as SecureStore from "expo-secure-store";
import React, { useState } from "react";
import { Image, View } from "react-native";
import { Button, Card, Dialog, Portal, Text } from "react-native-paper";
import PinInput from "../../components/AppLock/PinInput";
import styles from "../../Constants/styles";
import { ChangeAppPinScreenProps } from "../../types";
const ChangeAppPinScreen: React.FC<ChangeAppPinScreenProps> = ({
  navigation,
}) => {
  const [step, setStep] = useState<number>(1);
  const [newPin, setNewPin] = useState<string>("");
  const [pinError, setPinError] = useState<boolean>(false);
  const [pinSuccess, setPinSuccess] = useState<boolean>(false);

  const [dialogVisible, setDialogVisible] = useState<boolean>(false);
  const [dialogTitle, setDialogTitle] = useState<string>("");
  const [dialogMessage, setDialogMessage] = useState<string>("");
  const [dialogOnOk, setDialogOnOk] = useState<() => void>(() => {});

  const showDialog = (title: string, message: string, onOk: () => void) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogOnOk(() => onOk);
    setDialogVisible(true);
  };

  const handlePinSubmit = async (pin: string) => {
    if (step === 1) {
      const storedPin = await SecureStore.getItemAsync("app_pin");
      if (pin === storedPin) {
        setStep(2);
      } else {
        setPinError(true);
        setTimeout(() => setPinError(false), 500);
      }
    } else if (step === 2) {
      setNewPin(pin);
      setStep(3);
    } else if (step === 3) {
      if (pin === newPin) {
        await SecureStore.setItemAsync("app_pin", newPin);
        setPinSuccess(true);
        showDialog("Success", "Your PIN has been updated successfully!", () => {
          if (navigation) {
            navigation.goBack();
          }
          setDialogVisible(false);
        });
      } else {
        setPinError(true);
        showDialog("Error", "PINs do not match. Please try again.", () => {
          setStep(2);
          setDialogVisible(false);
        });
        setTimeout(() => setPinError(false), 500);
      }
    }
  };

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
    <View style={styles.pinContainer}>
      <Image
        source={require("../../assets/logo.png")}
        style={styles.pinLogo}
        resizeMode="contain"
      />
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

      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
        >
          <Dialog.Title>{dialogTitle}</Dialog.Title>
          <Dialog.Content>
            <Text>{dialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={dialogOnOk}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

export default ChangeAppPinScreen;
