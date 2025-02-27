import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, TextInput } from "react-native-paper";

interface PinInputProps {
  onSubmit: (pin: string) => void;
}

const PinInput: React.FC<PinInputProps> = ({ onSubmit }) => {
  const [pin, setPin] = useState("");

  const handleSubmit = () => {
    if (pin.length === 4) {
      onSubmit(pin);
      setPin("");
    } else {
      alert("Please enter a 4-digit PIN.");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        label="Enter PIN"
        value={pin}
        onChangeText={setPin}
        keyboardType="numeric"
        maxLength={4}
        secureTextEntry
        style={styles.input}
      />
      <Button mode="contained" onPress={handleSubmit} style={styles.button}>
        Submit
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: "100%", alignItems: "center" },
  input: {
    width: "80%",
    marginBottom: 20,
  },
  button: {
    width: "80%",
  },
});

export default PinInput;
