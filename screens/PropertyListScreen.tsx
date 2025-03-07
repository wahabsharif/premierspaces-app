import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Common/Header";
import { propertyListData } from "../data/propertyListData";
import { RootStackParamList } from "../types";

const PropertyListScreen = () => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(
    null
  );

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const handlePress = async (item: { id: number; address: string }) => {
    try {
      await AsyncStorage.setItem("selectedProperty", JSON.stringify(item));
      setSelectedPropertyId(item.id);
    } catch (error) {
      console.error("Error storing property:", error);
    }
  };

  const handleNavigate = () => {
    const selectedProperty = propertyListData.find(
      (item) => item.id === selectedPropertyId
    );

    if (selectedProperty) {
      navigation.navigate("CategoryScreen", {
        paramKey: selectedProperty.address,
      });
    } else {
      console.warn("No property selected");
    }
  };

  const renderItem = ({ item }: { item: { id: number; address: string } }) => (
    <TouchableOpacity
      style={[
        styles.item,
        selectedPropertyId === item.id && styles.selectedItem,
      ]}
      onPress={() => handlePress(item)}
    >
      <Text
        style={[
          styles.address,
          selectedPropertyId === item.id && { color: "#fff" }, // change text color when selected
        ]}
      >
        {item.address}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <Header />
      <View style={styles.container}>
        <Text style={styles.heading}>Property List</Text>
        <FlatList
          data={propertyListData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
        />
      </View>
      <TouchableOpacity style={styles.floatingIcon} onPress={handleNavigate}>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>
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
    backgroundColor: "#fff",
  },
  heading: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  selectedItem: {
    backgroundColor: "#347ab8",
    borderRadius: 5,
  },
  address: {
    fontSize: 16,
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

export default PropertyListScreen;
