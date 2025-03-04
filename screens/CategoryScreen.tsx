import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { categories } from "../data/categoryData";
import Header from "../components/Header";

const CategoryScreen = ({ navigation }: any) => {
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const toggleCategory = (id: number) => {
    if (expandedCategory === id) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(id);
    }
  };

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
            }}
            style={[
              styles.subCategoryItem,
              isSelected && styles.selectedSubCategoryItem,
            ]}
          >
            <Text
              style={[styles.subCategoryText, isSelected && { color: "#fff" }]}
            >
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

    try {
      await AsyncStorage.setItem(
        "selectedData",
        JSON.stringify({
          category: selectedCategory,
          subCategory: selectedSubCategory,
        })
      );
    } catch (error) {
      console.error("Error storing selected data", error);
    }
    navigation.navigate("UploadScreen", {
      category: selectedCategory,
      subCategory: selectedSubCategory,
    });
  };

  // Handlers for the modal
  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const handleOpenNewJob = () => {
    closeModal();
    // navigation.navigate("NewJobScreen");
  };

  const handleGoToJobs = () => {
    closeModal();
    // navigation.navigate("JobsScreen");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <Header />
      <View style={{ padding: 20 }}>
        <Text style={styles.titleText}>Select a Category</Text>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            onPress={() => toggleCategory(category.id)}
            style={styles.categoryContainer}
          >
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryText}>{category.category}</Text>
              <Text style={styles.categoryText}>
                {expandedCategory === category.id ? "▼" : "▶"}
              </Text>
            </View>
            {expandedCategory === category.id &&
              renderSubCategories(category.sub_categories, category)}
          </TouchableOpacity>
        ))}
      </View>

      {/* Floating button to proceed */}
      <TouchableOpacity style={styles.floatingIcon} onPress={handleNavigate}>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>

      {/* "Report A Problem" button at bottom */}
      <TouchableOpacity style={styles.reportButton} onPress={openModal}>
        <Text style={styles.reportButtonText}>Report A Problem</Text>
      </TouchableOpacity>

      {/* Modal for "Report A Problem" */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reporting A Problem</Text>
            <Text style={styles.modalMessage}>
              To report a problem, please open a new job or find existing job
              and upload files from job-detail view
            </Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, { marginRight: 10 }]}
                onPress={handleOpenNewJob}
              >
                <Text style={styles.modalButtonText}>Open New Job</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleGoToJobs}
              >
                <Text style={styles.modalButtonText}>Go To Jobs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  titleText: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  categoryContainer: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryText: {
    fontSize: 18,
    color: "#347ab8",
  },
  subCategoryItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  selectedSubCategoryItem: {
    backgroundColor: "#347ab8",
    borderWidth: 1,
    borderColor: "#7e57c2",
    color: "white",
  },
  subCategoryText: {
    fontSize: 16,
    color: "#347ab8",
  },
  floatingIcon: {
    position: "absolute",
    bottom: 80,
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
  reportButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#347ab8",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  reportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
  },
  modalButtonRow: {
    flexDirection: "row",
  },
  modalButton: {
    backgroundColor: "#347ab8",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default CategoryScreen;
