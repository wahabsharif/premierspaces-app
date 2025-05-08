import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL } from "../Constants/env";
import { getCache, setCache } from "../services/cacheService";
import { FileItem, FileTypeCount, GroupedFiles } from "../types";
import { Category } from "./categorySlice";

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

  return grouped;
};

// Create category mappings from categories data
export const createCategoryMappings = (categories: Category[]) => {
  const catMap: Record<number, string> = {};
  const subMap: Record<number, string> = {};

  categories.forEach((cat) => {
    catMap[cat.id] = cat.category;
    cat.sub_categories.forEach((sub) => {
      subMap[sub.id] = sub.sub_category;
    });
  });

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
    const userId = user?.payload?.userid;

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
      const userCache = await getCache("userData");
      const user = userCache ? userCache.payload : null;
      const userId = user?.payload?.userid;

      if (userId) {
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
      }
    } catch {
      // ignore cache errors
    }
    return rejectWithValue(err.message || "Failed to load files");
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
