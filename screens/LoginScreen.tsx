// screens/LoginScreen.tsx
import Constants from "expo-constants";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import styles from "../Constants/styles";
import { fontSize } from "../Constants/theme";
import { AppDispatch, RootState } from "../store";
import { login } from "../store/authSlice";

type LoginScreenProps = {
  navigation?: any;
  onLoginSuccess?: () => void;
};

const LoginScreen = ({ navigation, onLoginSuccess }: LoginScreenProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const [initials, setInitials] = useState("");
  const [pin, setPin] = useState("");
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const handleLogin = () => {
    dispatch(login({ initials, pin }))
      .unwrap()
      .then(() => {
        if (onLoginSuccess) {
          // Called when used from App.js
          onLoginSuccess();
        } else if (navigation) {
          // Called when used from within navigation stack
          navigation.reset({
            index: 0,
            routes: [{ name: "SearchPropertyScreen" }],
          });
        }
      })
      .catch((err) => {
        setAlertMessage(err.toString());
        setAlertVisible(true);
      });
  };

  return (
    <SafeAreaView style={styles.screenContainer}>
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
          {loading ? (
            <ActivityIndicator color="#fff" />
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
    </SafeAreaView>
  );
};

export default LoginScreen;
