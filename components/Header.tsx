import Octicons from "@expo/vector-icons/Octicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import React, { useEffect, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import styles from "../Constants/styles";
import { RootStackParamList } from "../types";
import { fontSize } from "../Constants/theme";

type HeaderNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SearchPropertyScreen"
>;

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
          if (userData?.payload?.name) {
            setUserName(userData.payload.name);
          }
        }
      } catch (error) {
        // // console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, []);

  const dropdownOptions = ["Home", "Settings", "Pending Data", "Logout"];

  const handleDropdownPress = () => {
    setDropdownVisible((prev) => !prev);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();

      navigation.reset({
        index: 0,
        routes: [{ name: "LoginScreen" }],
      });
    } catch (error) {
      // // console.error("Error during logout:", error);
    }
  };

  const handleOptionSelect = (option: string) => {
    setDropdownVisible(false);
    if (option === "Settings") {
      navigation.navigate("SettingScreen");
    } else if (option === "Home") {
      navigation.navigate("SearchPropertyScreen");
    } else if (option === "Pending Data") {
      navigation.navigate("PendingDataScreen");
    } else if (option === "Logout") {
      handleLogout();
    }
  };

  return (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.headerTextContainer}>
          <Text
            style={styles.headerText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {userName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerLogoContainer}
          onPress={() => navigation.navigate("SearchPropertyScreen")}
          activeOpacity={0.7}
        >
          <Image
            source={require("../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDropdownPress}>
          <Octicons name="three-bars" size={fontSize.large} color="black" />
        </TouchableOpacity>
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

export default Header;
