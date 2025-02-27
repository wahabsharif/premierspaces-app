import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { categories } from "../data/categories";

const CategoryScreen = ({ navigation }: any) => {
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>Select a Category</Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ padding: 15, borderBottomWidth: 1 }}
            onPress={() =>
              navigation.navigate("UploadScreen", { category: item })
            }
          >
            <Text style={{ fontSize: 18 }}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default CategoryScreen;
