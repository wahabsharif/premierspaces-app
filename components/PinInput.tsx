import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";

interface PinInputProps {
  onSubmit: (pin: string) => void;
  title: string;
}

const PinInput: React.FC<PinInputProps> = ({ onSubmit, title }) => {
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
      <Text style={styles.title}>{title}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        maxLength={4}
        value={pin}
        onChangeText={setPin}
        secureTextEntry
      />
      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    width: 100,
    textAlign: "center",
    marginBottom: 20,
  },
});

export default PinInput;
