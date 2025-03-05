import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
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
  const navigation = useNavigation<SearchPropertyScreenNavigationProp>();

  const handleNavigate = () => {
    navigation.navigate("PropertyListScreen", { door_num });
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
              onChangeText={setdoor_num}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.floatingIcon} onPress={handleNavigate}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
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
  inputWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
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
  },
});

export default SearchPropertyScreen;
