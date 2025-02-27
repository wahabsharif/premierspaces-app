import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const LoginScreen = ({ navigation }: any) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameAnim = useRef(new Animated.Value(1)).current;
  const passwordAnim = useRef(new Animated.Value(1)).current;

  const handleFocus = (animation: Animated.Value) => {
    Animated.timing(animation, {
      toValue: 1.1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleBlur = (animation: Animated.Value) => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = () => {
    if (username === "admin" && password === "1234") {
      navigation.replace("CategoryScreen");
    } else {
      Alert.alert("Invalid Credentials", "Please try again.");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 50,
        backgroundColor: "#f8f9fa",
      }}
    >
      <Text
        style={{
          fontSize: 30,
          fontWeight: "bold",
          marginBottom: 20,
          color: "#333",
          letterSpacing: 3,
        }}
      >
        LOGIN
      </Text>

      <Animated.View
        style={{ transform: [{ scale: usernameAnim }], width: "100%" }}
      >
        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={(text) => setUsername(text.toLowerCase())}
          onFocus={() => handleFocus(usernameAnim)}
          onBlur={() => handleBlur(usernameAnim)}
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            padding: 12,
            borderRadius: 8,
            backgroundColor: "#fff",
            marginBottom: 10,
          }}
        />
      </Animated.View>

      <Animated.View
        style={{ transform: [{ scale: passwordAnim }], width: "100%" }}
      >
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onFocus={() => handleFocus(passwordAnim)}
          onBlur={() => handleBlur(passwordAnim)}
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            padding: 12,
            borderRadius: 8,
            backgroundColor: "#fff",
            marginBottom: 20,
          }}
        />
      </Animated.View>

      <TouchableOpacity
        onPress={handleLogin}
        style={{
          backgroundColor: "#007bff",
          padding: 14,
          borderRadius: 100,
          width: "50%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
          Submit
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;
