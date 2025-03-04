import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownOptions = ["Home", "Settings", "Logout"];

  const handleDropdownPress = () => {
    setDropdownVisible((prev) => !prev);
  };

  const handleOptionSelect = (option: string) => {
    setDropdownVisible(false);
  };

  return (
    <>
      <View style={styles.headerContainer}>
        {/* Left Side - Hamburger Icon */}
        <TouchableOpacity onPress={handleDropdownPress} style={styles.left}>
          <MaterialCommunityIcons name="menu" size={24} color="black" />
        </TouchableOpacity>

        {/* Center - Logo */}
        <View style={styles.center}>
          <Image
            source={require("../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Right Side - Text */}
        <View style={styles.right}>
          <Text style={styles.rightText}>Profile</Text>
        </View>
      </View>

      {/* Dropdown List */}
      {dropdownVisible && (
        <View style={styles.dropdownContainer}>
          {dropdownOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.dropdownItem}
              onPress={() => handleOptionSelect(option)}
            >
              <Text style={styles.dropdownItemText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    // marginTop: 30,
    height: 60,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    justifyContent: "space-between",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  left: {
    flex: 1,
    justifyContent: "center",
  },
  center: {
    flex: 2,
    alignItems: "center",
  },
  logo: {
    width: 100,
    height: 40,
  },
  right: {
    flex: 1,
    alignItems: "flex-end",
  },
  rightText: {
    fontSize: 16,
    color: "#333",
  },
  dropdownContainer: {
    position: "absolute",
    top: 90, // Header's marginTop (30) + height (60)
    left: 10,
    width: 150,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
  },
});

export default Header;
