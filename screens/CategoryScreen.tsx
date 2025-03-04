import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { categories } from "../data/categoryData";
import Header from "../components/Header";

const CategoryScreen = ({ navigation }: any) => {
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  // Toggle the expanded/collapsed state for a category
  const toggleCategory = (id: number) => {
    if (expandedCategory === id) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(id);
    }
  };

  // Render subcategories as a dropdown list with selection highlight
  const renderSubCategories = (subCategories: any, category: any) => (
    <View style={{ marginTop: 10, paddingLeft: 20 }}>
      {subCategories.map((subCategory: any) => {
        const isSelected =
          selectedSubCategory && selectedSubCategory.id === subCategory.id;
        return (
          <TouchableOpacity
            key={subCategory.id}
            onPress={() => {
              setSelectedSubCategory(subCategory);
              setSelectedCategory(category);
              console.log("Selected Subcategory:", subCategory);
              console.log("From Category:", category);
            }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 5,
              marginBottom: 5,
              backgroundColor: isSelected ? "#d1c4e9" : "transparent",
              borderWidth: isSelected ? 1 : 0,
              borderColor: isSelected ? "#7e57c2" : "transparent",
            }}
          >
            <Text style={{ fontSize: 16, color: "#00796b" }}>
              {subCategory.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const handleNavigate = async () => {
    if (!selectedCategory || !selectedSubCategory) {
      Alert.alert("Selection Required", "Please select a subcategory");
      return;
    }
    console.log("Navigating with selected data:", {
      category: selectedCategory,
      subCategory: selectedSubCategory,
    });
    // Store selected data in AsyncStorage
    try {
      await AsyncStorage.setItem(
        "selectedData",
        JSON.stringify({
          category: selectedCategory,
          subCategory: selectedSubCategory,
        })
      );
      console.log("Selected data stored in AsyncStorage");
    } catch (error) {
      console.error("Error storing selected data", error);
    }
    navigation.navigate("UploadScreen", {
      category: selectedCategory,
      subCategory: selectedSubCategory,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <Header />
      <View style={{ padding: 20 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            marginBottom: 20,
            color: "#333",
          }}
        >
          Select a Category
        </Text>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            onPress={() => toggleCategory(category.id)}
            style={{
              paddingVertical: 15,
              paddingHorizontal: 10,
              borderBottomWidth: 1,
              borderBottomColor: "#ccc",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 18, color: "#347ab8" }}>
                {category.category}
              </Text>
              <Text style={{ fontSize: 18, color: "#347ab8" }}>
                {expandedCategory === category.id ? "▼" : "▶"}
              </Text>
            </View>
            {expandedCategory === category.id &&
              renderSubCategories(category.sub_categories, category)}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.floatingIcon} onPress={handleNavigate}>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingIcon: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#347ab8",
    padding: 15,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default CategoryScreen;
