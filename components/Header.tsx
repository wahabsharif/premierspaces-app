import Octicons from "@expo/vector-icons/Octicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import React, { useEffect, useState } from "react";
import { Image, Text, TouchableOpacity, View, DevSettings } from "react-native";
import * as Updates from "expo-updates";
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
        if (userDataJson) {
          const userData = JSON.parse(userDataJson);
          if (userData?.payload?.name) {
            setUserName(userData.payload.name);
          }
        }
      } catch {
        // silent
      }
    };
    fetchUserData();
  }, []);

  const dropdownOptions = ["Home", "Settings", "Pending Data", "Logout"];
  const handleOptionSelect = (option: string) => {
    setDropdownVisible(false);
    switch (option) {
      case "Settings":
        navigation.navigate("SettingScreen");
        break;
      case "Home":
        navigation.navigate("SearchPropertyScreen");
        break;
      case "Pending Data":
        navigation.navigate("PendingDataScreen");
        break;
      case "Logout":
        AsyncStorage.clear().then(() =>
          navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] })
        );
        break;
    }
  };

  const handleReload = async () => {
    try {
      if (Updates.reloadAsync) {
        await Updates.reloadAsync();
        return;
      }
    } catch (e) {
      console.warn("expo-updates failed:", e);
    }
    if (__DEV__ && DevSettings.reload) {
      DevSettings.reload();
    } else {
      // console.error("Unable to reload programmatically.");
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

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={handleReload}
            style={{ paddingHorizontal: 10 }}
          >
            <Octicons name="sync" size={fontSize.large} color="black" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDropdownVisible((p) => !p)}
            style={{ paddingHorizontal: 10 }}
          >
            <Octicons name="three-bars" size={fontSize.large} color="black" />
          </TouchableOpacity>
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

export default Header;
