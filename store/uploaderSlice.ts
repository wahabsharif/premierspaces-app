// uploaderSlice.ts
import NetInfo from "@react-native-community/netinfo";
import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import axios from "axios";
import * as FileSystem from "expo-file-system";
import { BASE_API_URL } from "../Constants/env";
import { getFileId } from "../helper";
import { refreshCachesAfterPost } from "../services/cacheService";
import {
  createLocalUpload,
  deleteUpload,
  getAllUploads,
  UploadSegment,
} from "../services/uploadService";
import { MediaFile } from "../types";
import { RootState } from "./index";
import { Toast } from "toastify-react-native";

interface UploaderState {
  files: MediaFile[];
  uploadQueue: UploadSegment[];
  uploading: boolean;
  syncingOfflineUploads: boolean;
  progress: { [uri: string]: string };
  successCount: number;
  failedCount: number;
  common_id: string;
  fileStatus: { [uri: string]: "success" | "failed" | "pending" }; // Track status of each file
}

const initialState: UploaderState = {
  files: [],
  uploadQueue: [],
  uploading: false,
  syncingOfflineUploads: false,
  progress: {},
  successCount: 0,
  failedCount: 0,
  common_id: "",
  fileStatus: {}, // Initialize file status tracking
};

// Network quality assessment
const assessNetworkQuality = async () => {
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return "offline";
    if (netInfo.type === "wifi") return "high";
    if (netInfo.type === "cellular") {
      // On cellular, consider the effective type
      if (netInfo.details?.cellularGeneration) {
        const gen = netInfo.details.cellularGeneration;
        if (gen === "4g" || gen === "5g") return "medium";
        return "low";
      }
    }
    return "medium"; // Default to medium if we can't determine
  } catch (e) {
    console.warn("Error assessing network quality:", e);
    return "medium"; // Default to medium on error
  }
};

// Helper to determine optimal concurrency based on network quality
const getOptimalConcurrency = (networkQuality: string, fileCount: number) => {
  switch (networkQuality) {
    case "high":
      return Math.min(4, Math.max(2, Math.floor(fileCount / 2)));
    case "medium":
      return Math.min(2, fileCount);
    case "low":
      return 1;
    case "offline":
      return 0;
    default:
      return 2;
  }
};

// Async thunk to upload files (or store offline)
export const uploadFiles = createAsyncThunk(
  "uploader/uploadFiles",
  async (
    {
      mainCategoryId,
      subCategoryId,
      propertyId,
      job_id,
      userName,
      common_id,
    }: {
      mainCategoryId: string;
      subCategoryId: string;
      propertyId: string;
      job_id: string;
      userName: string;
      common_id: string;
    },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const files = state.uploader.files;

    if (!files || files.length === 0) {
      throw new Error("No files to upload");
    }

    // Check network connectivity and quality
    const networkQuality = await assessNetworkQuality();
    const isConnected = networkQuality !== "offline";

    const fileId = getFileId();
    const totalFiles = files.length;
    const results: any[] = [];

    // Offline mode: store segments locally with optimized batch processing
    if (!isConnected) {
      // Process files in batches for better memory management
      const batchSize = 3;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchPromises = batch.map(async (file, batchIndex) => {
          const index = i + batchIndex;
          const fileName =
            file.name || file.uri.split("/").pop() || `file_${index}`;

          // Create a segment without reading the entire file content
          const segment: Omit<UploadSegment, "id" | "content_path"> & {
            uri: string;
            common_id: string;
          } = {
            total_segments: totalFiles,
            segment_number: index + 1,
            main_category: parseInt(mainCategoryId, 10),
            category_level_1: parseInt(subCategoryId, 10),
            property_id: parseInt(propertyId, 10),
            job_id: null,
            file_name: fileName,
            file_header: null,
            file_size: file.size || null,
            file_type: file.mimeType || null,
            file_index: index,
            uri: file.uri,
            common_id: common_id,
          };

          try {
            await createLocalUpload(segment);
            dispatch(
              updateProgress({ uri: file.uri, progress: "Stored Offline" })
            );
            dispatch(incrementSuccessCount());
            return { success: true };
          } catch (error) {
            Toast.error(
              `Error storing file offline: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            dispatch(
              updateProgress({ uri: file.uri, progress: "Failed Offline" })
            );
            dispatch(incrementFailedCount());
            return { success: false, error };
          }
        });

        await Promise.all(batchPromises);
      }

      dispatch(fetchOfflineUploads());
      return;
    }

    // Online upload mode with enhanced performance
    // Determine optimal concurrency based on network quality and file count
    const concurrencyLimit = getOptimalConcurrency(
      networkQuality,
      files.length
    );

    const uploadFile = async (file: MediaFile, index: number): Promise<any> => {
      const fileName =
        file.name || file.uri.split("/").pop() || `file_${index}`;
      const fileType = file.mimeType;

      try {
        // Regular upload with optimized FormData
        const formData = new FormData();
        formData.append("id", fileId || "");
        formData.append("total_segments", totalFiles.toString());
        formData.append("segment_number", (index + 1).toString());
        formData.append("main_category", mainCategoryId);
        formData.append("category_level_1", subCategoryId);
        formData.append("property_id", propertyId);
        formData.append("job_id", job_id);
        formData.append("file_name", fileName);
        formData.append("file_type", fileType);
        formData.append("user_name", userName);
        formData.append("common_id", common_id);

        // Use blob instead of base64 for better memory usage
        formData.append("content", {
          uri: file.uri,
          type: fileType || "application/octet-stream",
          name: fileName,
        } as any);

        // Create abort controller for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await axios.post(
          `${BASE_API_URL}/media-uploader.php`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            signal: controller.signal,
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                dispatch(
                  updateProgress({
                    uri: file.uri,
                    progress: `${percentCompleted}%`,
                  })
                );
              }
            },
          }
        );

        clearTimeout(timeoutId);
        dispatch(updateProgress({ uri: file.uri, progress: "Complete" }));
        dispatch(incrementSuccessCount());
        // Track successful file status
        dispatch(updateFileStatus({ uri: file.uri, status: "success" }));

        // Refresh job cache after successful upload
        await refreshCachesAfterPost(userName);

        return { success: true, data: response.data };
      } catch (error) {
        dispatch(updateProgress({ uri: file.uri, progress: "Failed" }));
        dispatch(incrementFailedCount());
        // Track failed file status
        dispatch(updateFileStatus({ uri: file.uri, status: "failed" }));

        // Add automatic retry for transient errors
        if (axios.isCancel(error)) {
          return { success: false, error: "Upload timed out" };
        }

        return { success: false, error };
      }
    };

    // Process files in optimal batches for memory and network efficiency
    const processBatch = async (startIndex: number, batchSize: number) => {
      const endIndex = Math.min(startIndex + batchSize, files.length);
      const batch = files.slice(startIndex, endIndex);

      // Execute with concurrency control
      const executing: Promise<any>[] = [];
      const batchResults: any[] = [];

      for (let i = 0; i < batch.length; i++) {
        const fileIndex = startIndex + i;
        const file = batch[i];

        const uploadPromise = (async () => {
          const result = await uploadFile(file, fileIndex);
          return result;
        })();

        const wrappedPromise = uploadPromise.then((result) => {
          executing.splice(executing.indexOf(wrappedPromise), 1);
          return result;
        });

        batchResults.push(uploadPromise);
        executing.push(wrappedPromise);

        if (executing.length >= concurrencyLimit) {
          await Promise.race(executing);
        }
      }

      const results = await Promise.all(batchResults);
      return results;
    };

    // Determine optimal batch size based on file count
    const optimalBatchSize = Math.min(
      10,
      Math.max(5, Math.floor(files.length / 2))
    );

    // Process all files in batches
    for (let i = 0; i < files.length; i += optimalBatchSize) {
      const batchResults = await processBatch(i, optimalBatchSize);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the API
      if (i + optimalBatchSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return results;
  }
);

// Thunk to fetch all offline uploads
export const fetchOfflineUploads = createAsyncThunk(
  "uploader/fetchOfflineUploads",
  async () => {
    const uploads = await getAllUploads();
    return uploads;
  }
);

// Thunk to sync offline uploads when back online
export const syncOfflineUploads = createAsyncThunk(
  "uploader/syncOfflineUploads",
  async (
    {
      userName,
    }: {
      userName: string;
    },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const uploadQueue = state.uploader.uploadQueue;

    if (!uploadQueue || uploadQueue.length === 0) {
      return;
    }

    // Check network connectivity
    const netState = await NetInfo.fetch();
    const isConnected = netState.isConnected;

    if (!isConnected) {
      throw new Error("No internet connection");
    }

    const results: Promise<any>[] = [];

    const tasks = uploadQueue.map((upload) => async () => {
      try {
        // Only process uploads that have a content path
        if (!upload.content_path || !upload.uri) {
          return { success: false, error: "Missing content path or URI" };
        }

        const formData = new FormData();
        const fileId = getFileId();

        formData.append("id", fileId || "");
        formData.append("total_segments", String(upload.total_segments || 1));
        formData.append("segment_number", String(upload.segment_number || 1));
        formData.append("main_category", String(upload.main_category || ""));
        formData.append(
          "category_level_1",
          String(upload.category_level_1 || "")
        );
        formData.append("property_id", String(upload.property_id || ""));
        formData.append("job_id", String(upload.job_id || ""));
        formData.append("file_name", upload.file_name || "");
        formData.append("file_type", upload.file_type || "");
        formData.append("user_name", userName);
        formData.append("common_id", upload.common_id || "");

        // Check if the content_path file exists
        const fileInfo = await FileSystem.getInfoAsync(upload.content_path);

        if (fileInfo.exists) {
          // Use the saved file
          formData.append("content", {
            uri: upload.content_path,
            type: upload.file_type || "application/octet-stream",
            name: upload.file_name || "file.dat",
          } as any);
        } else {
          // If file is missing, try the original URI
          formData.append("content", {
            uri: upload.uri,
            type: upload.file_type || "application/octet-stream",
            name: upload.file_name || "file.dat",
          } as any);
        }

        dispatch(
          updateProgress({
            uri: upload.uri || upload.id,
            progress: "Syncing...",
          })
        );

        const response = await axios.post(
          `${BASE_API_URL}/media-uploader.php`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                dispatch(
                  updateProgress({
                    uri: upload.uri || upload.id,
                    progress: `Syncing ${percentCompleted}%`,
                  })
                );
              }
            },
          }
        );

        dispatch(
          updateProgress({ uri: upload.uri || upload.id, progress: "Synced" })
        );
        dispatch(incrementSuccessCount());

        // Refresh job cache after successful upload
        await refreshCachesAfterPost(userName);

        // Delete the local upload after successful upload
        await deleteUpload(upload.id);

        return { success: true, data: response.data, id: upload.id };
      } catch (error) {
        dispatch(
          updateProgress({
            uri: upload.uri || upload.id,
            progress: "Sync Failed",
          })
        );
        dispatch(incrementFailedCount());
        return { success: false, error, id: upload.id };
      }
    });

    // Execute tasks with concurrency control
    const concurrencyLimit = 2;
    const executing: Promise<any>[] = [];

    for (const task of tasks) {
      const p = task().then((result) => {
        executing.splice(executing.indexOf(p), 1);
        return result;
      });

      results.push(p);
      executing.push(p);

      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }

    const uploadResults = await Promise.all(results);

    // Refresh upload queue
    dispatch(fetchOfflineUploads());

    return uploadResults;
  }
);

// Thunk to retry failed uploads
export const retryFailedUploads = createAsyncThunk(
  "uploader/retryFailedUploads",
  async (
    {
      mainCategoryId,
      subCategoryId,
      propertyId,
      job_id,
      userName,
      common_id,
    }: {
      mainCategoryId: string;
      subCategoryId: string;
      propertyId: string;
      job_id: string;
      userName: string;
      common_id: string;
    },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const files = state.uploader.files;
    const fileStatus = state.uploader.fileStatus;

    // Filter to get only failed files
    const failedFiles = files.filter(
      (file) => fileStatus[file.uri] === "failed"
    );

    if (!failedFiles || failedFiles.length === 0) {
      return [];
    }

    // Reset counters for retry operation
    dispatch(resetRetryCounters());

    // Use the existing upload mechanism but only for failed files
    const oldFiles = state.uploader.files;

    // Temporarily set only failed files for upload
    dispatch(setFiles(failedFiles));

    // Use the existing upload files thunk
    const results = await dispatch(
      uploadFiles({
        mainCategoryId,
        subCategoryId,
        propertyId,
        job_id,
        userName,
        common_id,
      })
    ).unwrap();

    // Restore the original files list
    dispatch(setFiles(oldFiles));

    return results;
  }
);

// Helper function to ensure counts are correct
export const validateUploadCounts = createAsyncThunk(
  "uploader/validateUploadCounts",
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const files = state.uploader.files;
    const fileStatus = state.uploader.fileStatus;

    // Count files by their actual status
    let successCount = 0;
    let failedCount = 0;

    files.forEach((file) => {
      if (fileStatus[file.uri] === "success") {
        successCount++;
      } else if (fileStatus[file.uri] === "failed") {
        failedCount++;
      }
    });

    // Update counts if they don't match
    if (
      successCount !== state.uploader.successCount ||
      failedCount !== state.uploader.failedCount
    ) {
      dispatch(setUploadCounts({ successCount, failedCount }));
    }

    return { successCount, failedCount };
  }
);

const uploaderSlice = createSlice({
  name: "uploader",
  initialState,
  reducers: {
    setFiles: (state, action) => {
      state.files = action.payload;
    },
    clearFiles: (state) => {
      state.files = [];
      state.progress = {};
      state.successCount = 0;
      state.failedCount = 0;
    },
    updateProgress: (state, action) => {
      const { uri, progress } = action.payload;
      state.progress[uri] = progress;
    },
    incrementSuccessCount: (state) => {
      state.successCount += 1;
    },
    incrementFailedCount: (state) => {
      state.failedCount += 1;
    },
    setCommonId: (state, action) => {
      // Added reducer for setting common_id
      state.common_id = action.payload;
    },
    updateFileStatus: (state, action) => {
      const { uri, status } = action.payload;
      state.fileStatus[uri] = status;
    },
    resetRetryCounters: (state) => {
      // Reset counters specifically for retry operation
      state.successCount = 0;
      state.failedCount = 0;
    },
    setUploadCounts: (state, action) => {
      const { successCount, failedCount } = action.payload;
      state.successCount = successCount;
      state.failedCount = failedCount;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadFiles.pending, (state) => {
        state.uploading = true;
      })
      .addCase(uploadFiles.fulfilled, (state) => {
        state.uploading = false;
      })
      .addCase(uploadFiles.rejected, (state) => {
        state.uploading = false;
      })
      .addCase(fetchOfflineUploads.fulfilled, (state, action) => {
        state.uploadQueue = action.payload;
      })
      .addCase(syncOfflineUploads.pending, (state) => {
        state.syncingOfflineUploads = true;
      })
      .addCase(syncOfflineUploads.fulfilled, (state) => {
        state.syncingOfflineUploads = false;
      })
      .addCase(syncOfflineUploads.rejected, (state) => {
        state.syncingOfflineUploads = false;
      })
      .addCase(retryFailedUploads.pending, (state) => {
        state.uploading = true;
      })
      .addCase(retryFailedUploads.fulfilled, (state) => {
        state.uploading = false;
      })
      .addCase(retryFailedUploads.rejected, (state) => {
        state.uploading = false;
      })
      .addCase(validateUploadCounts.fulfilled, (state) => {
        // No state update needed, just trigger re-calculation
      });
  },
});

export const {
  setFiles,
  clearFiles,
  updateProgress,
  incrementSuccessCount,
  incrementFailedCount,
  setCommonId,
  updateFileStatus, // Export the new action
  resetRetryCounters, // Export the reset counters action
  setUploadCounts,
} = uploaderSlice.actions;

export const selectFiles = (state: RootState) => state.uploader.files;
export const selectUploading = (state: RootState) => state.uploader.uploading;
export const selectProgress = (state: RootState) => state.uploader.progress;
export const selectUploadCounts = createSelector(
  [
    (state: RootState) => state.uploader.successCount,
    (state: RootState) => state.uploader.failedCount,
  ],
  (successCount, failedCount) => ({ successCount, failedCount })
);

// Add a selector to get failed files
export const selectFailedFiles = createSelector(
  [
    (state: RootState) => state.uploader.files,
    (state: RootState) => state.uploader.fileStatus,
  ],
  (files, fileStatus) =>
    files.filter((file) => fileStatus[file.uri] === "failed")
);

export default uploaderSlice.reducer;
