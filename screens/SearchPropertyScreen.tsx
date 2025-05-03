import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Common/Header";
import { baseApiUrl } from "../Constants/env";
import styles from "../Constants/styles";
import { color } from "../Constants/theme";
import { RootStackParamList } from "../types";

type SearchPropertyScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SearchPropertyScreen"
>;

const SearchPropertyScreen: React.FC = () => {
  const [door_num, setdoor_num] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const navigation = useNavigation<SearchPropertyScreenNavigationProp>();

  const handleSearch = async () => {
    setError("");
    setLoading(true);
    try {
      const userDataJson = await AsyncStorage.getItem("userData");
      const userData = userDataJson ? JSON.parse(userDataJson) : null;
      const userid = userData?.payload?.userid;

      if (!userid) {
        setError("User ID not found. Please log in again.");
        setResults([]);
        return;
      }

      const url = `${baseApiUrl}/searchproperty.php?userid=${userid}&door_num=${door_num}`;
      const response = await axios.get(url);
      const data = response.data;

      if (data.status === 0 && data.payload?.message === "Session expired") {
        setShowSessionExpired(true);
        setResults([]);
        return;
      }

      if (data.status === 1 && data.payload && data.payload.length > 0) {
        setResults(data.payload);
      } else {
        setError(`No property found with ( ${door_num} )`);
        setResults([]);
      }
    } catch (err: any) {
      console.error("Error occurred during fetch:", err);
      if (err.response?.status === 503) {
        setError("Service is temporarily unavailable. Please try again later.");
      } else {
        setError(`No property found with ( ${door_num} )`);
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (door_num.trim() === "") {
      setResults([]);
      setError("");
      return;
    }
    debounceRef.current = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [door_num]);

  const handleSelectAndNavigate = async (item: any) => {
    try {
      await AsyncStorage.setItem("selectedProperty", JSON.stringify(item));
      console.log("Property saved to AsyncStorage:", item);
      navigation.navigate("CategoryScreen", {
        paramKey: item.address,
      });
    } catch (error) {
      console.error("Error saving property:", error);
    }
  };

  const renderResultItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleSelectAndNavigate(item)}
      >
        <Text style={styles.smallText}>{item.address}</Text>
        <Text style={styles.extraSmallText}>{item.company}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Search Properties</Text>
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Door No.</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter door number..."
            value={door_num}
            onChangeText={setdoor_num}
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading && <ActivityIndicator color={color.primary} />}

        {results.length > 0 && (
          <View style={styles.list}>
            <Text style={styles.subHeading}>Property List</Text>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderResultItem}
              contentContainerStyle={{ paddingVertical: 10 }}
            />
          </View>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showSessionExpired}
        onRequestClose={() => {
          setShowSessionExpired(false);
          navigation.navigate("LoginScreen");
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>
              Session expired! Please log in again.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSessionExpired(false);
                navigation.navigate("LoginScreen");
              }}
            >
              <Text style={styles.modalButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SearchPropertyScreen;
