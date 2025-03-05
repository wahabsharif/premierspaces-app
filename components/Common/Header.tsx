import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RootStackParamList } from "../../types";

type HeaderNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [userName, setUserName] = useState("Profile");
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
      navigation.navigate("SettingScreen");
    }
  };

  return (
    <>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleDropdownPress} style={styles.left}>
          <MaterialCommunityIcons name="menu" size={24} color="black" />
        </TouchableOpacity>

        <View style={styles.center}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.right}>
          <Text style={styles.rightText}>{userName}</Text>
        </View>
      </View>

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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
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
