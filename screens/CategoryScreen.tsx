// screens/CategoryScreen.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Header from "../components/Common/Header";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { AppDispatch, RootState } from "../store";
import {
  Category,
  loadCategories,
  selectCategories,
  selectCategoryError,
  selectCategoryLoading,
  SubCategory,
} from "../store/categorySlice";

const STORAGE_KEYS = {
  PROPERTY: "selectedProperty",
  SELECTED: "selectedData",
};

const CategoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector((s: RootState) => selectCategories(s));
  const loading = useSelector((s: RootState) => selectCategoryLoading(s));
  const error = useSelector((s: RootState) => selectCategoryError(s));

  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [property, setProperty] = React.useState<{
    address: string;
    company: string;
  } | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);

  // Load categories (online → cache → offline)
  useEffect(() => {
    dispatch(loadCategories());
  }, [dispatch]);

  // Load selected property
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.PROPERTY).then((json) => {
      if (json) setProperty(JSON.parse(json));
    });
    // .catch(// console.error);
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const onSubCategoryPress = useCallback(
    async (category: Category, sub: SubCategory) => {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SELECTED,
        JSON.stringify({ category, subCategory: sub })
      );
      navigation.navigate("UploadScreen", { category, subCategory: sub });
    },
    [navigation]
  );

  const renderSubCategory = useCallback(
    ({ item: sub }: { item: SubCategory }) => (
      <TouchableOpacity
        onPress={() => {
          const cat = categories.find((c) => c.id === expandedId)!;
          onSubCategoryPress(cat, sub);
        }}
        style={innerStyles.subCategoryItem}
      >
        <Text style={innerStyles.subCategoryText}>{sub.sub_category}</Text>
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
            style={innerStyles.categoryHeader}
            onPress={() => toggleExpand(cat.id)}
          >
            <Text style={innerStyles.categoryText}>{cat.category}</Text>
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
              contentContainerStyle={innerStyles.subList}
            />
          )}
        </View>
      );
    },
    [expandedId, toggleExpand, renderSubCategory]
  );

  // UI states
  if (loading) {
    return (
      <View style={[styles.screenContainer]}>
        <ActivityIndicator size="large" color={color.primary} />
      </View>
    );
  }

  if (error && categories.length === 0) {
    return (
      <View style={[styles.screenContainer]}>
        <Text style={{ color: color.red, fontSize: fontSize.medium }}>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => dispatch(loadCategories())}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Select a Category To Upload</Text>
        </View>

        {property && (
          <View style={styles.screenBanner}>
            <Text style={styles.bannerLabel}>Selected Property:</Text>
            <Text style={styles.bannerText}>{property.address}</Text>
            <Text style={styles.extraSmallText}>{property.company}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("JobsScreen")}
        >
          <Text style={styles.buttonText}>Go To Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("FilesScreen")}
        >
          <Text style={styles.buttonText}>Go To Files</Text>
        </TouchableOpacity>

        <FlatList
          data={categories}
          keyExtractor={(c) => c.id.toString()}
          renderItem={renderCategory}
          style={{ width: "100%" }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: color.secondary }} />
          )}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>Report A Problem</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Reporting A Problem</Text>
            <Text style={styles.modalText}>
              To report a problem, please open a new job or find an existing job
              and upload files from Job Details.
            </Text>
            <View style={styles.modalButtonsContainer}>
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
                style={styles.modalButtonClose}
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

const innerStyles = StyleSheet.create({
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
});

export default CategoryScreen;
