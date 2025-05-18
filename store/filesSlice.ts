import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL } from "../Constants/env";
import { getCache, setCache } from "../services/cacheService";
import { FileItem, FileTypeCount, GroupedFiles } from "../types";
import { Category } from "./categorySlice";
import { Toast } from "toastify-react-native";

const STORAGE_KEYS = {
  USER: "userData",
  PROPERTY: "selectedProperty",
};

interface FilesState {
  files: FileItem[];
  groupedFiles: GroupedFiles[];
  loading: boolean;
  error: string | null;
  categoryMap: Record<number, string>;
  subCategoryMap: Record<number, string>;
}

const initialState: FilesState = {
  files: [],
  groupedFiles: [],
  loading: false,
  error: null,
  categoryMap: {},
  subCategoryMap: {},
};

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
const groupFilesByPath = (fileList: FileItem[]): GroupedFiles[] => {
  if (!Array.isArray(fileList)) {
    console.warn(
      "[FilesSlice] Invalid fileList provided to groupFilesByPath",
      fileList
    );
    return [];
  }

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
    if (!file || typeof file !== "object") {
      console.warn("[FilesSlice] Invalid file object in fileList");
      return;
    }

    const path = file.path || ""; // Use empty string for undefined paths
    const fileType = getFileType(file.file_name || "unknown");

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

  return grouped;
};

/**
 * Creates mappings from categories data to lookup objects
 * Handles various formats of category data that might come from different sources
 * @param {any} categoriesData - The categories data which could be in various formats
 * @returns {{ categoryMap: Record<number, string>, subCategoryMap: Record<number, string> }}
 */
export const createCategoryMappings = (categoriesData: any) => {
  const catMap: Record<number, string> = {};
  const subMap: Record<number, string> = {};

  try {
    // Handle different possible structures of the categories data
    let categories: Category[] = [];

    if (!categoriesData) {
      console.warn("[FilesSlice] No categories data provided");
      return { categoryMap: catMap, subCategoryMap: subMap };
    }

    // Determine the correct structure
    if (Array.isArray(categoriesData)) {
      categories = categoriesData;
    } else if (
      categoriesData.payload &&
      Array.isArray(categoriesData.payload)
    ) {
      categories = categoriesData.payload;
    } else if (
      typeof categoriesData === "object" &&
      "payload" in categoriesData &&
      categoriesData.payload &&
      "payload" in categoriesData.payload &&
      Array.isArray(categoriesData.payload.payload)
    ) {
      // Handle nested payload.payload structure
      categories = categoriesData.payload.payload;
    } else {
      console.warn(
        "[FilesSlice] Unrecognized categories data format:",
        typeof categoriesData,
        Array.isArray(categoriesData) ? "array" : "not array"
      );
      return { categoryMap: catMap, subCategoryMap: subMap };
    }

    // Process each category
    categories.forEach((cat) => {
      if (!cat || typeof cat !== "object") {
        console.warn(
          "[FilesSlice] Invalid category object in categories array"
        );
        return;
      }

      if ("id" in cat && "category" in cat) {
        catMap[cat.id] = cat.category;

        // Process subcategories if they exist
        if (cat.sub_categories && Array.isArray(cat.sub_categories)) {
          cat.sub_categories.forEach((sub) => {
            if (
              sub &&
              typeof sub === "object" &&
              "id" in sub &&
              "sub_category" in sub
            ) {
              subMap[sub.id] = sub.sub_category;
            }
          });
        }
      }
    });
  } catch (error) {
    Toast.error(
      `[FilesSlice] Error creating category mappings: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return { categoryMap: catMap, subCategoryMap: subMap };
};

export const loadFiles = createAsyncThunk<
  FileItem[],
  { propertyId: string },
  { rejectValue: string }
>("files/load", async ({ propertyId }, { rejectWithValue }) => {
  try {
    const net = await NetInfo.fetch();

    // Determine userId from AsyncStorage
    const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    const user = userJson ? JSON.parse(userJson) : null;
    const userId = user?.payload?.userid || user?.userid;

    if (!userId) {
      throw new Error("User ID missing");
    }

    // Build a cache key for all files for this user
    const cacheKey = `filesCache_${userId}`;

    if (net.isConnected) {
      // Online: fetch from server
      const resp = await axios.get<{ status: number; payload: FileItem[] }>(
        `${BASE_API_URL}/get-files.php?userid=${userId}`
      );

      if (resp.data.status !== 1) {
        throw new Error("Server returned error status");
      }

      // Cache all files to SQLite
      await setCache(cacheKey, resp.data.payload);

      // Return only files for the selected property
      return resp.data.payload.filter(
        (file) => file.property_id === propertyId
      );
    } else {
      // Offline: load from cache
      const cached = await getCache(cacheKey);
      if (cached && cached.payload) {
        // Filter for the requested property
        const allFiles = Array.isArray(cached.payload)
          ? cached.payload
          : cached.payload.payload || [];

        return allFiles.filter(
          (file: FileItem) => file.property_id === propertyId
        );
      } else {
        throw new Error("No internet and no cached data");
      }
    }
  } catch (err: any) {
    // Attempt to load from cache on any error
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const user = userJson ? JSON.parse(userJson) : null;
      const userId = user?.payload?.userid || user?.userid;

      if (!userId) {
        return rejectWithValue("User ID missing from storage");
      }

      const cacheKey = `filesCache_${userId}`;
      const cached = await getCache(cacheKey);

      if (cached && cached.payload) {
        // Filter for the requested property
        const allFiles = Array.isArray(cached.payload)
          ? cached.payload
          : cached.payload.payload || [];

        return allFiles.filter(
          (file: FileItem) => file.property_id === propertyId
        );
      }
      return rejectWithValue("No valid cached files found");
    } catch (cacheErr: any) {
      Toast.error("[FilesSlice] Cache retrieval error:", cacheErr);
      return rejectWithValue(err.message || "Failed to load files");
    }
  }
});

const filesSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    setCategoryMappings: (
      state,
      action: PayloadAction<{
        categoryMap: Record<number, string>;
        subCategoryMap: Record<number, string>;
      }>
    ) => {
      state.categoryMap = action.payload.categoryMap;
      state.subCategoryMap = action.payload.subCategoryMap;
    },
    clearFilesCache: (state) => {
      state.files = [];
      state.groupedFiles = [];
      // Remove SQLite cache entry - we don't delete here as we need user ID
      // This should be handled in the component when needed
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadFiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        loadFiles.fulfilled,
        (state, action: PayloadAction<FileItem[]>) => {
          state.loading = false;
          state.files = action.payload;
          state.groupedFiles = groupFilesByPath(action.payload);
        }
      )
      .addCase(loadFiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unknown error";
      });
  },
});

export const { setCategoryMappings, clearFilesCache } = filesSlice.actions;

export const selectFiles = (state: { files: FilesState }) => state.files.files;
export const selectGroupedFiles = (state: { files: FilesState }) =>
  state.files.groupedFiles;
export const selectFilesLoading = (state: { files: FilesState }) =>
  state.files.loading;
export const selectFilesError = (state: { files: FilesState }) =>
  state.files.error;
export const selectCategoryMap = (state: { files: FilesState }) =>
  state.files.categoryMap;
export const selectSubCategoryMap = (state: { files: FilesState }) =>
  state.files.subCategoryMap;

export default filesSlice.reducer;
