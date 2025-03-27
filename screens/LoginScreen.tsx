import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";
import styles from "../Constants/styles";
import { fontSize } from "../Constants/theme";
import axios from "axios";
import { baseApiUrl } from "../Constants/env";

const LoginScreen = ({ navigation, onLoginSuccess, route }: any) => {
  const [initials, setInitials] = useState("");
  const [pin, setPin] = useState("");
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertCallback, setAlertCallback] = useState<(() => void) | null>(null);

  const handleLogin = async () => {
    try {
      const response = await axios.post(
        `${baseApiUrl}/login.php`,
        {
          userid: 0,
          payload: {
            initials: initials,
            pin: pin,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;

      if (data.status === 1) {
        const userInfo = {
          token: data.token,
          userId: data.userId, // or whatever field uniquely identifies the user
        };
        await AsyncStorage.setItem("userData", JSON.stringify(userInfo));

        // Store latest user data
        await AsyncStorage.setItem("userData", JSON.stringify(data));

        console.log("Latest userData Stored in Storage:", data);

        if (onLoginSuccess) {
          showAlert("Success", "You are logged in!", onLoginSuccess);
        } else if (navigation) {
          showAlert("Success", "You are logged in!", () => {
            navigation.reset({
              index: 0,
              routes: [{ name: "SearchPropertyScreen" }],
            });
          });
        }
      } else {
        console.log("Login failed:", data);
        showAlert("Invalid Credentials", "Unable to login, please try again.");
      }
    } catch (error) {
      console.error("Login Error:", error);
      showAlert(
        "Error",
        "An unexpected error occurred. Please try again later."
      );
    }
  };

  const showAlert = (title: string, message: string, callback?: () => void) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertCallback(() => callback || null);
    setAlertVisible(true);
  };

  return (
    <View style={internalstyles.container}>
      <Image
        source={require("../assets/logo.png")}
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
          <Text style={internalstyles.label}>Initials:</Text>
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
          <Text style={internalstyles.label}>Pin:</Text>
          <TextInput
            placeholder="Enter Pin"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="numeric"
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

const internalstyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    width: "20%",
    marginRight: 8,
    fontSize: fontSize.large,
    fontWeight: "600",
  },
});

export default LoginScreen;
