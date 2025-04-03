import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Common/Header";
import { RootStackParamList } from "../types";
import styles from "../Constants/styles";
import { baseApiUrl } from "../Constants/env";
import { color, fontSize } from "../Constants/theme";

type SearchPropertyScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SearchPropertyScreen"
>;

const SearchPropertyScreen: React.FC = () => {
  const [door_num, setdoor_num] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const navigation = useNavigation<SearchPropertyScreenNavigationProp>();

  const handleSearch = async () => {
    setError("");
    setLoading(true);
    setSelectedId(null);
    try {
      // Retrieve userid from AsyncStorage
      const userDataJson = await AsyncStorage.getItem("userData");
      const userData = userDataJson ? JSON.parse(userDataJson) : null;
      const userid = userData?.payload?.userid;

      if (!userid) {
        setError("User ID not found. Please log in again.");
        setLoading(false);
        return;
      }

      const url = `${baseApiUrl}/searchproperty.php?userid=${userid}&door_num=${door_num}`;
      const response = await axios.get(url);
      const data = response.data;

      // Check for session expiration and show a custom modal
      if (data.status === 0 && data.payload?.message === "Session expired") {
        setShowSessionExpired(true);
        setLoading(false);
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
      if (err.response) {
        console.error("Error response data:", err.response.data);
        if (err.response.status === 503) {
          setError(
            "Service is temporarily unavailable. Please try again later."
          );
        } else {
          setError(`No property found with ( ${door_num} )`);
        }
      } else {
        setError("An error occurred while searching properties.");
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProperty = async (item: any) => {
    console.log("handleSelectProperty called with item:", item);
    setSelectedId(item.id);
    try {
      await AsyncStorage.setItem("selectedProperty", JSON.stringify(item));
      console.log("Property saved to AsyncStorage:", item);
    } catch (error) {
      console.error("Error saving property:", error);
    }
  };

  const handleNavigate = () => {
    const selectedProperty = results.find((item) => item.id === selectedId);
    if (selectedProperty) {
      navigation.navigate("CategoryScreen", {
        paramKey: selectedProperty.address,
      });
    } else {
      console.warn("No property selected");
    }
  };

  const renderResultItem = ({ item }: { item: any }) => {
    const isSelected = item.id === selectedId;
    return (
      <TouchableOpacity
        style={[styles.resultItem, isSelected && styles.selectedItem]}
        onPress={() => handleSelectProperty(item)}
      >
        <Text style={[styles.resultText, isSelected && styles.selectedText]}>
          {item.address}
        </Text>
        <Text style={styles.resultCompany}>{item.company}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <Header />
      <View style={styles.container}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Search Properties</Text>
        </View>
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>DOOR NO.</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter door number (e.g., 33, 32B)"
              value={door_num}
              onChangeText={(text) => setdoor_num(text)}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        <TouchableOpacity style={styles.floatingIcon} onPress={handleSearch}>
          {loading ? (
            <ActivityIndicator color={color.white} />
          ) : (
            <Ionicons name="search" size={24} color={color.white} />
          )}
        </TouchableOpacity>
        {results.length > 0 && (
          <View style={styles.list}>
            <Text style={styles.subHeading}>Property List</Text>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderResultItem}
              contentContainerStyle={styles.resultsContainer}
            />
          </View>
        )}
        {selectedId && (
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={handleNavigate}
          >
            <Ionicons name="arrow-forward" size={24} color={color.white} />
          </TouchableOpacity>
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
        <View style={modalStyles.centeredView}>
          <View style={modalStyles.modalView}>
            <Text style={modalStyles.modalText}>
              Session expired. Please log in again.
            </Text>
            <TouchableOpacity
              style={[modalStyles.button, modalStyles.buttonClose]}
              onPress={() => {
                setShowSessionExpired(false);
                navigation.navigate("LoginScreen");
              }}
            >
              <Text style={modalStyles.textStyle}>LOGIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    margin: 20,
    backgroundColor: color.white,
    borderRadius: 15,
    padding: 35,
    alignItems: "center",
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  button: {
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 30,
    elevation: 2,
  },
  buttonClose: {
    backgroundColor: color.primary,
    marginTop: 30,
  },
  textStyle: {
    color: color.white,
    fontWeight: "bold",
    textAlign: "center",
    fontSize: fontSize.medium,
  },
  modalText: {
    marginVertical: 15,
    textAlign: "center",
    fontSize: fontSize.large,
    fontWeight: "bold",
  },
});

export default SearchPropertyScreen;
