// screens/CategoryScreen.tsx

import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "../components";
import SkeletonLoader from "../components/SkeletonLoader";
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

  // Render skeleton loading UI
  const renderSkeletonUI = () => {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <View style={styles.container}>
          <View style={styles.headingContainer}>
            <SkeletonLoader.Line
              width="80%"
              height={24}
              style={skeletonStyles.headingSkeleton}
            />
          </View>

          {/* Property banner skeleton */}
          <View style={skeletonStyles.propertyBanner}>
            <SkeletonLoader.Line
              width="40%"
              height={16}
              style={skeletonStyles.marginBottom}
            />
            <SkeletonLoader.Line width="70%" height={20} />
            <SkeletonLoader.Line
              width="50%"
              height={14}
              style={skeletonStyles.marginTop}
            />
          </View>

          {/* Button skeletons */}
          <SkeletonLoader.Line
            width="100%"
            height={48}
            style={skeletonStyles.buttonSkeleton}
          />
          <SkeletonLoader.Line
            width="100%"
            height={48}
            style={skeletonStyles.buttonSkeleton}
          />

          {/* Category skeletons */}
          <View style={skeletonStyles.categoryList}>
            {Array.from({ length: 6 }).map((_, index) => (
              <View key={`category-skeleton-${index}`}>
                <SkeletonLoader.Row
                  labelWidth="70%"
                  contentWidth="10%"
                  height={20}
                  style={skeletonStyles.categorySkeleton}
                />
                {index === 0 && (
                  <View style={skeletonStyles.subCategoryList}>
                    {Array.from({ length: 3 }).map((_, subIndex) => (
                      <SkeletonLoader.Row
                        key={`subcategory-skeleton-${subIndex}`}
                        labelWidth="60%"
                        contentWidth="10%"
                        height={16}
                        style={skeletonStyles.subCategorySkeleton}
                      />
                    ))}
                  </View>
                )}
                <View style={skeletonStyles.separator} />
              </View>
            ))}
          </View>

          {/* Report problem button skeleton */}
          <SkeletonLoader.Line
            width="100%"
            height={48}
            style={skeletonStyles.buttonSkeleton}
          />
        </View>
      </View>
    );
  };

  // UI states
  if (loading) {
    return renderSkeletonUI();
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
            <TouchableOpacity
              style={styles.modalButtonClose}
              onPress={() => setModalVisible(false)}
            >
              <FontAwesome name="times" size={24} color={color.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reporting A Problem</Text>
            <Text style={styles.modalText}>
              To report a problem, please open a new job or find an existing job
              and upload files from Job Details.
            </Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate("JobsScreen");
                }}
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

// Skeleton loader styles
const skeletonStyles = StyleSheet.create({
  headingSkeleton: {
    marginVertical: 12,
  },
  propertyBanner: {
    width: "100%",
    padding: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginBottom: 16,
  },
  marginBottom: {
    marginBottom: 8,
  },
  marginTop: {
    marginTop: 6,
  },
  buttonSkeleton: {
    borderRadius: 8,
    marginVertical: 8,
  },
  categoryList: {
    width: "100%",
    marginTop: 16,
    marginBottom: 16,
  },
  categorySkeleton: {
    padding: 10,
  },
  subCategoryList: {
    paddingLeft: 20,
  },
  subCategorySkeleton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  separator: {
    height: 1,
    backgroundColor: color.secondary,
    marginVertical: 4,
  },
});

export default CategoryScreen;
