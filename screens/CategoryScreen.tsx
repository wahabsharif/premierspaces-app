import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";

const categories = ["Nature", "Events", "Family", "Travel"];

const CategoryScreen = ({ navigation }: any) => {
  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        backgroundColor: "#f8f9fa",
        alignItems: "center",
      }}
    >
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
      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#ccc",
              width: "100%",
              alignItems: "center",
              backgroundColor: "#fff",
              borderRadius: 10,
              marginBottom: 10,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
            onPress={() =>
              navigation.navigate("UploadScreen", { category: item })
            }
          >
            <Text style={{ fontSize: 18, fontWeight: "500", color: "#007bff" }}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default CategoryScreen;
