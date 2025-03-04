import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

// Define your route types.
type RootStackParamList = {
  Home: undefined;
  SettingScreen: undefined;
  // add other routes if necessary
};

// Optionally, define a specific navigation prop type for this component.
type HeaderNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [userName, setUserName] = useState("Profile");
  // Use the generic type to type the navigation object.
  const navigation = useNavigation<HeaderNavigationProp>();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDataJson = await AsyncStorage.getItem("userData");
        if (userDataJson !== null) {
          const userData = JSON.parse(userDataJson);
          if (userData.name) {
            setUserName(userData.name);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, []);

  const dropdownOptions = ["Home", "Settings", "Logout"];

  const handleDropdownPress = () => {
    setDropdownVisible((prev) => !prev);
  };

  const handleOptionSelect = (option: string) => {
    setDropdownVisible(false);
    if (option === "Settings") {
      // This now works because the navigation type is properly defined.
      navigation.navigate("SettingScreen");
    }
    // Add navigation logic for other options as needed.
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

        {/* Right Side - Username */}
        <View style={styles.right}>
          <Text style={styles.rightText}>{userName}</Text>
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
    fontWeight: "bold",
    flexShrink: 1,
    textAlign: "right",
  },
  dropdownContainer: {
    position: "absolute",
    top: 90,
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
