import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";
import { baseApiUrl } from "../Constants/env";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";

const LoginScreen = ({ navigation, onLoginSuccess, route }: any) => {
  const [initials, setInitials] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const handleLogin = async () => {
    setIsLoading(true);
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
          userId: data.userId,
        };
        await AsyncStorage.setItem("userData", JSON.stringify(userInfo));
        await AsyncStorage.setItem("userData", JSON.stringify(data));

        console.log("Latest userData Stored in Storage:", data);

        if (onLoginSuccess) {
          onLoginSuccess();
        } else if (navigation) {
          navigation.reset({
            index: 0,
            routes: [{ name: "SearchPropertyScreen" }],
          });
        }
      } else {
        console.log("Login failed:", data);
        showError("Invalid Credentials", "Unable to login, please try again.");
      }
    } catch (error) {
      console.error("Login Error:", error);
      showError("An unexpected error occurred.", "Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const showError = (message: string, p0: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  };

  return (
    <View style={styles.screenContainer}>
      <View style={[styles.container, { justifyContent: "center" }]}>
        <View
          style={{
            marginBottom: 20,
            alignItems: "center",
          }}
        >
          <Image
            source={require("../assets/logo.png")}
            style={styles.image}
            resizeMode="contain"
          />
          <Text style={styles.extraSmallText}>
            Version: {Constants.expoConfig?.version || "N/A"}
          </Text>
        </View>
        <View style={styles.inputContainer}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                width: "20%",
                marginRight: 8,
                fontSize: fontSize.large,
                fontWeight: "600",
              }}
            >
              Initials:
            </Text>
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
            <Text
              style={{
                width: "20%",
                marginRight: 8,
                fontSize: fontSize.large,
                fontWeight: "600",
              }}
            >
              Pin:
            </Text>
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

        <TouchableOpacity onPress={handleLogin} style={styles.primaryButton}>
          {isLoading ? (
            <ActivityIndicator size="small" color={color.white} />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <Portal>
          <Dialog
            visible={alertVisible}
            onDismiss={() => setAlertVisible(false)}
          >
            <Dialog.Title>Error</Dialog.Title>
            <Dialog.Content>
              <Text>{alertMessage}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setAlertVisible(false)}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </View>
  );
};

export default LoginScreen;
