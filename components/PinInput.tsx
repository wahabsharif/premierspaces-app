import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, TouchableOpacity, Animated } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { color } from "../Constants/theme";

interface PinInputProps {
  onSubmit: (pin: string) => void;
  onBiometric?: () => void;
  error?: boolean;
  success?: boolean;
}

const PinInput: React.FC<PinInputProps> = ({
  onSubmit,
  onBiometric,
  error,
  success,
}) => {
  const [pin, setPin] = useState("");
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [error, shakeAnimation]);

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        // Slight delay for visual feedback before submitting.
        setTimeout(() => {
          onSubmit(newPin);
          setPin("");
        }, 200);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pinDisplay,
          { transform: [{ translateX: shakeAnimation }] },
        ]}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.pinDot,
              {
                backgroundColor: success
                  ? "#008000"
                  : error
                  ? "#FF0000"
                  : pin.length > i
                  ? "#347ab8"
                  : "#ccc",
              },
            ]}
          />
        ))}
      </Animated.View>
      {/* Custom numeric keypad */}
      <View style={styles.numpad}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numpadRow}>
            {row.map((digit) => (
              <TouchableOpacity
                key={digit}
                style={styles.numpadButton}
                onPress={() => handlePress(digit)}
              >
                <Text style={styles.numpadButtonText}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.numpadRow}>
          {/* Fingerprint icon button (blue) */}
          <TouchableOpacity
            style={styles.numpadButton}
            onPress={() => onBiometric && onBiometric()}
          >
            <MaterialCommunityIcons
              name="fingerprint"
              size={30}
              color="#347ab8"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numpadButton}
            onPress={() => handlePress("0")}
          >
            <Text style={styles.numpadButtonText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numpadButton}
            onPress={handleBackspace}
          >
            <Text style={styles.numpadButtonText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  pinDisplay: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "60%",
    marginBottom: 30,
  },
  pinDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: color.secondary,
    marginHorizontal: 10,
  },
  numpad: {
    width: "100%",
  },
  numpadRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },
  numpadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.secondary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  numpadButtonText: {
    fontSize: 24,
    color: color.gray,
  },
});

export default PinInput;
