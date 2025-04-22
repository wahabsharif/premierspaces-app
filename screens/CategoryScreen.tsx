import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
} from "react-native";
import Header from "../components/Common/Header";
import { color, fontSize } from "../Constants/theme";
import commonStyles from "../Constants/styles";
import { baseApiUrl } from "../Constants/env";

interface SubCategory {
  id: number;
  sub_category: string;
}

interface Category {
  id: number;
  category: string;
  sub_categories: SubCategory[];
}

const STORAGE_KEYS = {
  USER: "userData",
  PROPERTY: "selectedProperty",
  SELECTED: "selectedData",
};

const CategoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [property, setProperty] = useState<{
    address: string;
    company: string;
  } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const showError = useCallback((title: string, message: string) => {
    setModalVisible(true);
    // Optionally store title/message in state if needed
  }, []);

  const loadUserAndCategories = useCallback(async () => {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const user = userJson ? JSON.parse(userJson) : null;
      const userId = user?.payload?.userid;
      if (!userId) {
        showError("Error", "User ID missing. Please log in.");
        return;
      }
      const { data } = await axios.get<{ status: number; payload: Category[] }>(
        `${baseApiUrl}/fileuploadcats.php?userid=${userId}`
      );
      if (data.status === 1) setCategories(data.payload);
      else showError("Error", "Failed to load categories");
    } catch (err) {
      console.error(err);
      showError("Error", "Unable to fetch categories.");
    }
  }, [showError]);

  const loadProperty = useCallback(async () => {
    try {
      const propJson = await AsyncStorage.getItem(STORAGE_KEYS.PROPERTY);
      if (propJson) setProperty(JSON.parse(propJson));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadUserAndCategories();
    loadProperty();
  }, [loadUserAndCategories, loadProperty]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const onSubCategoryPress = useCallback(
    async (category: Category, sub: SubCategory) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SELECTED,
          JSON.stringify({ category, subCategory: sub })
        );
        navigation.navigate("UploadScreen", { category, subCategory: sub });
      } catch (err) {
        console.error(err);
      }
    },
    [navigation]
  );

  const renderSubCategory = useCallback(
    ({ item: sub }: { item: SubCategory }) => (
      <TouchableOpacity
        onPress={() =>
          onSubCategoryPress(categories.find((c) => c.id === expandedId)!, sub)
        }
        style={styles.subCategoryItem}
      >
        <Text style={styles.subCategoryText}>{sub.sub_category}</Text>
        <Ionicons name="arrow-forward" size={16} color={color.primary} />
      </TouchableOpacity>
    ),
    [expandedId, onSubCategoryPress, categories]
  );

  const renderCategory = useCallback(
    ({ item: cat }: { item: Category }) => {
      const isOpen = expandedId === cat.id;
      return (
        <View>
          <TouchableOpacity
            style={styles.categoryHeader}
            onPress={() => toggleExpand(cat.id)}
          >
            <Text style={styles.categoryText}>{cat.category}</Text>
            <Ionicons
              name={isOpen ? "chevron-down" : "chevron-forward"}
              size={20}
              color={color.primary}
            />
          </TouchableOpacity>
          {isOpen && (
            <FlatList
              data={cat.sub_categories}
              keyExtractor={(s) => s.id.toString()}
              renderItem={renderSubCategory}
              contentContainerStyle={styles.subList}
            />
          )}
        </View>
      );
    },
    [expandedId, toggleExpand, renderSubCategory]
  );

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.content}>
        <Text style={commonStyles.heading}>Select a Category To Upload</Text>
        {property && (
          <View style={styles.propertyBox}>
            <Text style={styles.propertyLabel}>Selected Property:</Text>
            <Text>{property.address}</Text>
            <Text>{property.company}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.jobsButton}
          onPress={() => navigation.navigate("JobsScreen")}
        >
          <Text style={styles.jobsText}>Go To Jobs</Text>
        </TouchableOpacity>
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id.toString()}
          renderItem={renderCategory}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>

      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.reportText}>Report A Problem</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reporting A Problem</Text>
            <Text style={styles.modalMessage}>
              To report a problem, please open a new job or find an existing job
              and upload files from Job Details.
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, { marginRight: 10 }]}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate("JobsScreen");
                }}
              >
                <Text style={styles.modalButtonText}>Go To Jobs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, flex: 1 },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
  },
  categoryText: { fontSize: fontSize.large, color: color.primary },
  subCategoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  subCategoryText: { fontSize: fontSize.medium, color: color.primary },
  subList: { paddingLeft: 20 },
  separator: { height: 1, backgroundColor: color.secondary },
  jobsButton: {
    backgroundColor: color.primary,
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    marginVertical: 15,
  },
  jobsText: { color: color.white, fontWeight: "600" },
  reportButton: {
    backgroundColor: color.primary,
    padding: 15,
    borderRadius: 5,
    margin: 20,
    alignItems: "center",
  },
  reportText: { color: color.white, fontWeight: "600" },
  propertyBox: {
    backgroundColor: color.white,
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  propertyLabel: {
    fontWeight: "600",
    marginBottom: 5,
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
    color: color.black,
  },
  modalMessage: {
    fontSize: fontSize.medium,
    textAlign: "center",
    marginBottom: 20,
    color: color.gray,
  },
  modalButtonsRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  modalButton: {
    backgroundColor: color.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  modalButtonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "600",
  },
});

export default CategoryScreen;
