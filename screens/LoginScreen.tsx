import React, { useState } from "react";
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";

const LoginScreen = ({ navigation }: any) => {
  const [initials, setInitials] = useState("");
  const [pin, setPin] = useState("");

  const handleLogin = () => {
    if (initials === "admin" && pin === "1234") {
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
            onChangeText={(text) => setInitials(text.toLowerCase())}
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
    </View>
  );
};

export default LoginScreen;
