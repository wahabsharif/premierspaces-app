import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Portal, Dialog, Button } from "react-native-paper";
import { loginUser } from "../data/userLoginData";

const LoginScreen = ({ navigation, onLoginSuccess }: any) => {
  const [initials, setInitials] = useState("");
  const [pin, setPin] = useState("");

  // Custom Alert State
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
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 50,
      }}
    >
      <Image
        source={require("../assets/icon.png")}
        style={{ width: 200, height: 200, marginBottom: 30 }}
        resizeMode="contain"
      />
      <View style={{ width: "100%" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              width: "30%",
              fontSize: 16,
              fontWeight: "bold",
              color: "#333",
            }}
          >
            Initials:
          </Text>
          <TextInput
            placeholder="Enter Initials"
            value={initials}
            autoCapitalize="none"
            onChangeText={(text) => setInitials(text)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#ccc",
              padding: 12,
              borderRadius: 5,
              backgroundColor: "#fff",
            }}
          />
        </View>
      </View>
      <View style={{ width: "100%" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              width: "30%",
              fontSize: 16,
              fontWeight: "bold",
              color: "#333",
            }}
          >
            Pin:
          </Text>
          <TextInput
            placeholder="Enter Pin"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#ccc",
              padding: 12,
              borderRadius: 5,
              backgroundColor: "#fff",
            }}
          />
        </View>
      </View>
      <TouchableOpacity
        onPress={handleLogin}
        style={{
          backgroundColor: "#347ab8",
          padding: 14,
          borderRadius: 5,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
          Login
        </Text>
      </TouchableOpacity>

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

export default LoginScreen;
