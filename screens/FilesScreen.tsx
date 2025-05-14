import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { Header } from "../components";
import { formatDate } from "../helper";
import { AppDispatch } from "../store"; // Import types from store
import { loadCategories, selectCategories } from "../store/categorySlice";
import {
  createCategoryMappings,
  loadFiles,
  selectCategoryMap,
  selectFilesError,
  selectFilesLoading,
  selectGroupedFiles,
  selectSubCategoryMap,
  setCategoryMappings,
} from "../store/filesSlice";
import { GroupedFiles } from "../types";

const STORAGE_KEYS = {
  USER: "userData",
  PROPERTY: "selectedProperty",
};

export default function FilesScreen({ navigation }: { navigation: any }) {
  // Use Redux hooks
  const dispatch = useDispatch<AppDispatch>();

  // Select from Redux store
  const loading = useSelector(selectFilesLoading);
  const error = useSelector(selectFilesError);
  const groupedFiles = useSelector(selectGroupedFiles);
  const categories = useSelector(selectCategories);
  const categoryMap = useSelector(selectCategoryMap);
  const subCategoryMap = useSelector(selectSubCategoryMap);

  // Keep property in local state since it comes from AsyncStorage
  const [property, setProperty] = useState<{
    id: string;
    address: string;
    company: string;
  } | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });
    return unsubscribe;
  }, []);

  // Fetch property from AsyncStorage
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem(
          STORAGE_KEYS.PROPERTY
        );
        if (storedProperty) setProperty(JSON.parse(storedProperty));
      } catch (error) {
        console.error("Failed to load property:", error);
      }
    };

    fetchProperty();
  }, []);

  // Load categories from Redux and create mappings
  useEffect(() => {
    dispatch(loadCategories());
  }, [dispatch]);

  // Create category mappings when categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      const mappings = createCategoryMappings(categories);
      dispatch(setCategoryMappings(mappings));
    }
  }, [categories, dispatch]);

  // Load files when property is available
  useEffect(() => {
    if (property?.id) {
      dispatch(loadFiles({ propertyId: property.id }));
    }
  }, [property, dispatch]);

  // Refresh files handler
  const handleRefresh = useCallback(() => {
    if (property?.id) {
      dispatch(loadFiles({ propertyId: property.id }));
    }
  }, [property, dispatch]);

  const navigateToFileList = (pathItem: GroupedFiles) => {
    navigation.navigate("MediaPreviewScreen", {
      path: pathItem.path,
      files: pathItem.files,
      formattedPath: pathItem.formattedPath,
      propertyAddress: property?.address,
    });
  };

  const renderPathGroup = ({ item }: { item: GroupedFiles }) => {
    const mainCatId = Number(item.files[0]?.main_category);
    const subCatId = Number(item.files[0]?.sub_category);
    const mainCatName = categoryMap[mainCatId];
    const subCatName = subCategoryMap[subCatId];

    return (
      <TouchableOpacity
        disabled={!isConnected}
        activeOpacity={0.7}
        style={[
          {
            width: "100%",
            marginBottom: 8,
            borderBottomColor: color.secondary,
            borderBottomWidth: 1,
            paddingVertical: 15,
            opacity: isConnected ? 1 : 0.5,
          },
        ]}
        onPress={() => navigateToFileList(item)}
      >
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons
              name="folder-open"
              size={22}
              color={isConnected ? color.darkYellow : color.gray}
            />
            <Text
              style={[
                styles.smallText,
                {
                  fontWeight: "bold",
                  color: isConnected ? color.black : color.gray,
                },
              ]}
            >
              {item.files[0].job_num}
            </Text>

            {mainCatName ? (
              <>
                <Ionicons name="arrow-forward-sharp" size={20} color="black" />
                <Text>{mainCatName}</Text>
              </>
            ) : null}

            {subCatName ? (
              <>
                <Ionicons name="arrow-forward-sharp" size={20} color="black" />
                <Text>{subCatName}</Text>
              </>
            ) : null}
          </View>

          <View
            style={{
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
            }}
          >
            <View
              style={{
                marginLeft: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Ionicons name="calendar" size={20} color={color.primary} />
              <Text>{formatDate(item.files[0]?.date_created)}</Text>
            </View>
            <Ionicons name="arrow-forward-sharp" size={20} color="black" />
            <View style={innerStyles.fileTypesContainer}>
              {item.fileTypeCounts.map((typeCount, index) => (
                <View key={index} style={innerStyles.fileTypeItem}>
                  <Ionicons
                    name={typeCount.icon as any}
                    size={22}
                    color={isConnected ? color.primary : color.gray}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.medium,
                      color: color.gray,
                      marginHorizontal: 2,
                      fontWeight: "bold",
                    }}
                  >
                    {typeCount.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={[styles.container, { width: "100%" }]}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Uploaded Files</Text>
        </View>

        {property ? (
          <View style={styles.screenBanner}>
            <Text style={styles.bannerLabel}>Selected Property:</Text>
            <Text style={styles.bannerText}>{property.address}</Text>
            <Text style={styles.extraSmallText}>{property.company}</Text>
          </View>
        ) : (
          <Text style={styles.extraSmallText}>No property selected.</Text>
        )}
        {loading ? (
          <ActivityIndicator size="large" color={color.primary} />
        ) : error ? (
          <View style={innerStyles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 10 }]}
              onPress={handleRefresh}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : groupedFiles.length === 0 ? (
          <View style={innerStyles.emptyContainer}>
            <Ionicons name="folder-open" size={48} color={color.secondary} />
            <Text style={styles.errorText}>No files found</Text>
            <Text style={innerStyles.emptySubText}>
              Upload files by selecting a category
            </Text>
          </View>
        ) : (
          <FlatList
            data={groupedFiles}
            keyExtractor={(item) => item.path}
            renderItem={renderPathGroup}
            contentContainerStyle={{ width: "100%", paddingBottom: 20 }}
            style={{ width: "100%" }}
          />
        )}
      </View>
    </View>
  );
}

const innerStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptySubText: {
    fontSize: fontSize.small,
    color: color.secondary,
    marginTop: 5,
    textAlign: "center",
  },
  fileTypesContainer: {
    flexDirection: "row",
    gap: 5,
  },
  fileTypeItem: {
    flexDirection: "row",
    alignItems: "center",
  },
});
