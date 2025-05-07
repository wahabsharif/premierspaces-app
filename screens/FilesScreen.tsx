import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BASE_API_URL } from "../Constants/env";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { Header } from "../components";
import { formatDate } from "../helper";
import { FileItem, FileTypeCount, GroupedFiles } from "../types";

const STORAGE_KEYS = {
  USER: "userData",
  PROPERTY: "selectedProperty",
};

type CategoryMap = Record<number, string>;
type SubCategoryMap = Record<number, string>;

export default function FilesScreen({ navigation }: { navigation: any }) {
  const [property, setProperty] = useState<{
    id: string;
    address: string;
    company: string;
  } | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [groupedFiles, setGroupedFiles] = useState<GroupedFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state for category mappings
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({});
  const [subCategoryMap, setSubCategoryMap] = useState<SubCategoryMap>({});

  // Fetch categories and subcategories
  const fetchCategories = useCallback(async () => {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const user = userJson ? JSON.parse(userJson) : null;
      const userId = user?.payload?.userid;
      if (!userId) return;

      const { data } = await axios.get(
        `${BASE_API_URL}/fileuploadcats.php?userid=${userId}`
      );
      if (data.status === 1 && Array.isArray(data.payload)) {
        const catMap: CategoryMap = {};
        const subMap: SubCategoryMap = {};
        data.payload.forEach((cat: any) => {
          catMap[cat.id] = cat.category;
          cat.sub_categories.forEach((sub: any) => {
            subMap[sub.id] = sub.sub_category;
          });
        });
        setCategoryMap(catMap);
        setSubCategoryMap(subMap);
      }
    } catch (err) {
      // // console.error("Error fetching categories:", err);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const user = userJson ? JSON.parse(userJson) : null;
      const userId = user?.payload?.userid;

      if (!userId || !property?.id) {
        setLoading(false);
        return;
      }

      const { data } = await axios.get(
        `${BASE_API_URL}/get-files.php?userid=${userId}&property_id=${property.id}`
      );

      if (data.status === 1 && data.payload) {
        setFiles(data.payload);
        groupFilesByPath(data.payload);
      } else {
        setError("No files found or error loading files");
      }
    } catch (err) {
      // // console.error("Error fetching files:", err);
      setError("Failed to load files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [property]);

  // Format the path for tree-like display
  const formatPathForTreeView = (path: string) => {
    // Remove trailing slashes
    const cleanPath = path.replace(/\/+$/, "");

    // Split path into segments
    const segments = cleanPath.split("/").filter(Boolean);

    if (segments.length === 0) {
      return "";
    }

    // Return formatted path
    return segments.join(" / ");
  };

  // Determine file type based on file extension
  const getFileType = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase() || "";

    const imageExtensions = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "bmp",
      "webp",
      "svg",
      "tiff",
    ];
    const videoExtensions = ["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm"];
    const docExtensions = [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "txt",
      "rtf",
    ];

    if (imageExtensions.includes(extension)) return "image";
    if (videoExtensions.includes(extension)) return "video";
    if (docExtensions.includes(extension)) return "document";

    return "other";
  };

  // Get icon name based on file type
  const getIconForFileType = (fileType: string): string => {
    switch (fileType) {
      case "image":
        return "image";
      case "video":
        return "videocam";
      case "document":
        return "document-text";
      default:
        return "document";
    }
  };

  // Group files by their paths and count file types
  const groupFilesByPath = (fileList: FileItem[]) => {
    // Create a map to group files by path
    const pathMap: Record<
      string,
      {
        formattedPath: string;
        files: FileItem[];
        typeCounts: Record<string, number>;
      }
    > = {};

    fileList.forEach((file) => {
      const path = file.path || ""; // Use empty string for undefined paths
      const fileType = getFileType(file.file_name);

      if (!pathMap[path]) {
        pathMap[path] = {
          formattedPath: formatPathForTreeView(path),
          files: [],
          typeCounts: {},
        };
      }

      pathMap[path].files.push(file);

      // Increment the count for this file type
      pathMap[path].typeCounts[fileType] =
        (pathMap[path].typeCounts[fileType] || 0) + 1;
    });

    // Convert map to array with file type count information
    const grouped = Object.keys(pathMap).map((path) => {
      const fileTypeCounts: FileTypeCount[] = Object.keys(
        pathMap[path].typeCounts
      ).map((type) => ({
        type,
        count: pathMap[path].typeCounts[type],
        icon: getIconForFileType(type),
      }));

      // Sort file types (images first, then videos, then documents, then others)
      fileTypeCounts.sort((a, b) => {
        const order = { image: 0, video: 1, document: 2, other: 3 };
        return (
          (order[a.type as keyof typeof order] || 999) -
          (order[b.type as keyof typeof order] || 999)
        );
      });

      return {
        path,
        formattedPath: pathMap[path].formattedPath,
        files: pathMap[path].files,
        fileTypeCounts,
      };
    });

    // Sort groups by path
    grouped.sort((a, b) => a.path.localeCompare(b.path));

    setGroupedFiles(grouped);
  };

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem(
          STORAGE_KEYS.PROPERTY
        );
        if (storedProperty) setProperty(JSON.parse(storedProperty));
      } catch (error) {
        // // console.error("Failed to load property:", error);
        setError("Failed to load property information");
      }
    };

    fetchProperty();
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (property?.id) fetchFiles();
  }, [property, fetchFiles]);

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
        style={{
          width: "100%",
          marginBottom: 8,
          borderBottomColor: color.secondary,
          borderBottomWidth: 1,
          paddingVertical: 15,
        }}
        onPress={() => navigateToFileList(item)}
      >
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="folder-open" size={22} color={color.darkYellow} />
            <Text style={[styles.smallText, { fontWeight: "bold" }]}>
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
                    color={color.primary}
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
              onPress={fetchFiles}
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
