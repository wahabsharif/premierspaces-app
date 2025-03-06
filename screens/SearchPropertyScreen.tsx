import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Common/Header";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigation = useNavigation<SearchPropertyScreenNavigationProp>();

  const handleSearch = async () => {
    setError("");
    setLoading(true);
    setSelectedId(null);
    try {
      const url = `http://premierspaces.uk/mapp/searchproperty.php?userid=1&door_num=${door_num}`;
      const response = await axios.get(url);
      const data = response.data;

      if (data.status === 1 && data.payload && data.payload.length > 0) {
        setResults(data.payload);
      } else {
        setError(`No property found with ( ${door_num} )`);
        setResults([]);
      }
    } catch (err: any) {
      console.error("Error occurred during fetch:", err);
      if (err.response) {
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
    setSelectedId(item.id);
    try {
      await AsyncStorage.setItem("selectedProperty", JSON.stringify(item));
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="search" size={24} color="#fff" />
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
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    position: "relative",
  },
  headingContainer: {
    alignItems: "flex-start",
    marginTop: 16,
  },
  heading: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "left",
  },
  subHeading: {
    fontSize: 24,
    fontWeight: "bold",
    marginVertical: 12,
    textAlign: "center",
  },
  inputWrapper: {
    flex: 0,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  label: {
    marginRight: 8,
    fontSize: 20,
    fontWeight: "bold",
  },
  input: {
    flex: 1,
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  floatingIcon: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#347ab8",
    padding: 16,
    borderRadius: 50,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },
  navigateButton: {
    position: "absolute",
    bottom: 90,
    right: 20,
    backgroundColor: "#347ab8",
    padding: 16,
    borderRadius: 50,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },
  errorText: {
    color: "red",
    marginTop: 10,
    fontSize: 16,
  },
  resultsContainer: {
    paddingVertical: 20,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  selectedItem: {
    backgroundColor: "#347ab8",
    borderRadius: 5,
  },
  resultText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  selectedText: {
    color: "#fff",
  },
  resultCompany: {
    fontSize: 14,
    color: "#555",
  },
  list: {
    flex: 1,
    marginTop: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderTopWidth: 4,
    borderTopColor: "#ccc",
  },
});

export default SearchPropertyScreen;
