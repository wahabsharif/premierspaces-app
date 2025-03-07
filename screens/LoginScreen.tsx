import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";
import styles from "../Constants/styles";
import { loginUser } from "../data/userLoginData";

const LoginScreen = ({ navigation, onLoginSuccess }: any) => {
  const [initials, setInitials] = useState("");
  const [pin, setPin] = useState("");
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertCallback, setAlertCallback] = useState<(() => void) | null>(null);

  const handleLogin = async () => {
    const response = await loginUser(initials.toLowerCase(), pin);
    if (response.status === 1) {
      try {
        await AsyncStorage.setItem(
          "userData",
          JSON.stringify(response.payload)
        );
      } catch (error) {
        console.error("Error storing user data:", error);
      }
      showAlert("Success", "You are logged in!", onLoginSuccess);
    } else {
      const message =
        "message" in response.payload
          ? response.payload.message
          : "Unknown error occurred";
      showAlert("Invalid Credentials", message);
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
    <View style={styles.container}>
      <Image
        source={require("../assets/icon.png")}
        style={styles.image}
        resizeMode="contain"
      />
      <View style={styles.inputContainer}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Text style={styles.label}>Initials:</Text>
          <TextInput
            placeholder="Enter Initials"
            value={initials}
            autoCapitalize="none"
            onChangeText={setInitials}
            style={styles.input}
          />
        </View>
      </View>
      <View style={styles.inputContainer}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text style={styles.label}>Pin:</Text>
          <TextInput
            placeholder="Enter Pin"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            style={styles.input}
          />
        </View>
      </View>
      <TouchableOpacity onPress={handleLogin} style={styles.button}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

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

export default LoginScreen;
