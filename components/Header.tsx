import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Octicons from "@expo/vector-icons/Octicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import * as Updates from "expo-updates";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  DevSettings,
  Image,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import styles from "../Constants/styles";
import { fontSize } from "../Constants/theme";
import { RootStackParamList } from "../types";

type HeaderNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SearchPropertyScreen"
>;

const Header = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [userName, setUserName] = useState("Profile");
  const [isConnected, setIsConnected] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;
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

    // Add internet connectivity listener
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected || false);
    });

    // Add navigation listener to close dropdown when navigating
    const unsubscribe = navigation.addListener("state", () => {
      setDropdownVisible(false);
    });

    return () => {
      unsubscribe();
      unsubscribeNetInfo();
    };
  }, [navigation]);

  // Animation effect for offline banner
  useEffect(() => {
    if (!isConnected) {
      // Show the banner with animation
      Animated.timing(slideAnim, {
        toValue: 20, // Height when visible
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      // Hide the banner with animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [isConnected, slideAnim]);

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
      <Animated.View
        style={{
          backgroundColor: "red",
          width: "100%",
          height: slideAnim,
          overflow: "hidden",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 10,
            fontWeight: "bold",
          }}
        >
          Offline
        </Text>
      </Animated.View>

      <View style={[styles.headerContainer, { height: "auto" }]}>
        <View style={styles.headerTextContainer}>
          <Text
            style={styles.headerText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {userName}
          </Text>
        </View>

        <View style={styles.headerLogoContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate("SearchPropertyScreen")}
            activeOpacity={0.7}
          >
            <Image
              source={require("../assets/logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={handleReload}
            style={{
              padding: 12,
            }}
          >
            <Octicons name="sync" size={fontSize.medium} color="black" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDropdownVisible((p) => !p)}
            style={{
              padding: 12,
            }}
          >
            <MaterialCommunityIcons
              name="dots-vertical-circle-outline"
              size={fontSize.large}
              color="black"
            />
          </TouchableOpacity>
        </View>
      </View>

      {dropdownVisible && (
        <>
          <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
            <View style={styles.dropdownOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.dropdownContainer}>
            {dropdownOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={{ padding: 10 }}
                onPress={() => handleOptionSelect(option)}
              >
                <Text style={styles.dropdownItemText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </>
  );
};

export default Header;
