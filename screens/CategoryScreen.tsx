import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";
import Header from "../components/Common/Header";
import { color, fontSize } from "../Constants/theme";
import commonStyles from "../Constants/styles";

const CategoryScreen = ({ navigation }: any) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [propertyData, setPropertyData] = useState<{
    address: string;
    company: string;
  } | null>(null);

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Retrieve user data from AsyncStorage
        const userDataJson = await AsyncStorage.getItem("userData");
        const userData = userDataJson ? JSON.parse(userDataJson) : null;
        const userid = userData?.userid;

        if (!userid) {
          showAlert("Error", "User ID not found. Please log in again.");
          return;
        }

        // Call the API using the retrieved userid
        const url = `http://easyhomz.co.uk/mapp/fileuploadcats.php?userid=${userid}`;
        const response = await axios.get(url);
        if (response.data.status === 1) {
          setCategories(response.data.payload);
        } else {
          showAlert("Error", "Failed to load categories");
        }
      } catch (error) {
        console.error("Error fetching categories", error);
        showAlert("Error", "An error occurred while fetching categories");
      }
    };

    fetchCategories();
  }, []);
  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem("selectedProperty");
        if (storedProperty) {
          setPropertyData(JSON.parse(storedProperty));
        }
      } catch (error) {
        console.error("Error retrieving property data", error);
      }
    };

    fetchPropertyData();
  }, []);

  const toggleCategory = (id: number) => {
    setExpandedCategory((prev) => (prev === id ? null : id));
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
              {subCategory.sub_category}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const handleNavigate = async () => {
    if (!selectedCategory || !selectedSubCategory) {
      showAlert("Selection Required", "Please select a subcategory");
      return;
    }
    try {
      const dataToStore = JSON.stringify({
        category: {
          id: selectedCategory.id,
          category: selectedCategory.category,
        },
        subCategory: selectedSubCategory,
      });

      console.log("Data being stored in AsyncStorage:", dataToStore);
      await AsyncStorage.setItem("selectedData", dataToStore);

      // Verify the stored data
      const storedData = await AsyncStorage.getItem("selectedData");
      console.log("Data retrieved from AsyncStorage:", storedData);

      if (storedData !== dataToStore) {
        console.warn("Stored data doesn't match the original data");
      }
    } catch (error) {
      console.error("Error storing or retrieving selected data", error);
    }
    navigation.navigate("UploadScreen", {
      category: selectedCategory,
      subCategory: selectedSubCategory,
    });
  };

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const handleGoToJobsDirectly = () => {
    navigation.navigate("JobsScreen");
  };

  const handleOpenNewJob = () => {
    closeModal();
    // navigation.navigate("NewJobsScreen");
  };

  const handleGoToJobs = () => {
    closeModal();
    // navigation.navigate("JobsScreen");
  };

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <View style={{ padding: 20 }}>
        <View style={commonStyles.headingContainer}>
          <Text style={commonStyles.heading}>Select a Category To Upload</Text>
        </View>
        {propertyData && (
          <View style={styles.propertyContainer}>
            <Text style={styles.propertyLabel}>Selected Property:</Text>
            <View style={styles.propertyDetails}>
              <Text style={styles.propertyItem}>{propertyData.address}</Text>
              <Text style={styles.propertyItem}>{propertyData.company}</Text>
            </View>
          </View>
        )}
        <View style={styles.uploadSection}>
          <Text style={styles.uploadSectionTitle}>Upload for A Job</Text>
          <TouchableOpacity
            style={styles.uploadSectionButton}
            onPress={handleGoToJobsDirectly}
          >
            <Text style={styles.uploadSectionButtonText}>Go To Jobs</Text>
          </TouchableOpacity>
        </View>
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
      <TouchableOpacity style={styles.floatingIcon} onPress={handleNavigate}>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.reportButton} onPress={openModal}>
        <Text style={styles.reportButtonText}>Report A Problem</Text>
      </TouchableOpacity>
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
              To report a problem, please open a new job or find an existing job
              and upload files from job-detail view.
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
      <Portal>
        <Dialog visible={alertVisible} onDismiss={() => setAlertVisible(false)}>
          <Dialog.Title>{alertTitle}</Dialog.Title>
          <Dialog.Content>
            <Text>{alertMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAlertVisible(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  uploadSection: {
    marginBottom: 30,
    alignItems: "center",
    width: "100%",
    alignSelf: "center",
  },
  uploadSectionTitle: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    marginBottom: 5,
    color: color.gray,
    textAlign: "center",
  },
  uploadSectionButton: {
    backgroundColor: color.primary,
    paddingHorizontal: 10,
    width: "60%",
    paddingVertical: 10,
    borderRadius: 5,
  },
  uploadSectionButtonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "600",
    textAlign: "center",
  },
  categoryContainer: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: color.secondary,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryText: {
    fontSize: fontSize.large,
    color: color.primary,
  },
  subCategoryItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  selectedSubCategoryItem: {
    backgroundColor: color.primary,
    borderWidth: 1,
    borderColor: color.secondary,
  },
  subCategoryText: {
    fontSize: fontSize.medium,
    color: color.primary,
  },
  floatingIcon: {
    position: "absolute",
    bottom: 80,
    right: 20,
    backgroundColor: color.primary,
    padding: 15,
    borderRadius: 30,
    shadowColor: color.black,
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
    backgroundColor: color.primary,
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  reportButtonText: {
    color: color.white,
    fontSize: fontSize.medium,
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
    backgroundColor: color.white,
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 10,
    color: color.gray,
  },
  modalMessage: {
    fontSize: fontSize.medium,
    textAlign: "center",
    marginBottom: 20,
    color: color.gray,
  },
  modalButtonRow: {
    flexDirection: "row",
  },
  modalButton: {
    backgroundColor: color.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  modalButtonText: {
    color: color.white,
    fontSize: fontSize.small,
    fontWeight: "600",
  },
  propertyContainer: {
    backgroundColor: color.white,
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: color.secondary,
  },

  propertyLabel: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    color: color.black,
    marginBottom: 5,
  },

  propertyDetails: {
    paddingLeft: 10,
  },

  propertyItem: {
    fontSize: fontSize.medium,
    color: color.gray,
  },
});

export default CategoryScreen;
