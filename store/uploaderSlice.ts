// uploaderSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import { BASE_API_URL } from "../Constants/env";
import { getFileId } from "../helper";
import { MediaFile } from "../types";
import { RootState } from "./index";
import {
  createLocalUpload,
  getAllUploads,
  deleteUpload,
  getFileContent,
  UploadSegment,
} from "../services/uploadService";

interface UploaderState {
  files: MediaFile[];
  uploadQueue: UploadSegment[];
  uploading: boolean;
  syncingOfflineUploads: boolean;
  progress: { [uri: string]: string };
  successCount: number;
  failedCount: number;
}

const initialState: UploaderState = {
  files: [],
  uploadQueue: [],
  uploading: false,
  syncingOfflineUploads: false,
  progress: {},
  successCount: 0,
  failedCount: 0,
};

// Async thunk to upload files (or store offline)
export const uploadFiles = createAsyncThunk(
  "uploader/uploadFiles",
  async (
    {
      mainCategoryId,
      subCategoryId,
      propertyId,
      jobId,
      userName,
    }: {
      mainCategoryId: string;
      subCategoryId: string;
      propertyId: string;
      jobId: string;
      userName: string;
    },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const files = state.uploader.files;

    if (!files || files.length === 0) {
      throw new Error("No files to upload");
    }

    // Check network connectivity
    const netState = await NetInfo.fetch();
    const isConnected = netState.isConnected;

    const fileId = getFileId();
    const totalFiles = files.length;
    const results: Promise<any>[] = [];

    // Offline mode: store segments locally
    if (!isConnected) {
      console.log("Saving files in offline mode");
      for (const [index, file] of files.entries()) {
        const fileName =
          file.name || file.uri.split("/").pop() || `file_${index}`;

        // Create a segment without the binary content - we'll save the file separately
        const segment: Omit<UploadSegment, "id" | "content_path"> & {
          uri: string;
        } = {
          total_segments: totalFiles,
          segment_number: index + 1,
          main_category: parseInt(mainCategoryId, 10),
          category_level_1: parseInt(subCategoryId, 10),
          property_id: parseInt(propertyId, 10),
          job_id: parseInt(jobId, 10),
          file_name: fileName,
          file_header: null,
          file_size: file.size || null,
          file_type: file.mimeType || null,
          file_index: index,
          uri: file.uri, // Store the original URI
        };

        try {
          // Create local upload (this will copy the file to local storage)
          await createLocalUpload(segment);
          dispatch(
            updateProgress({ uri: file.uri, progress: "Stored Offline" })
          );
          dispatch(incrementSuccessCount());
        } catch (error) {
          console.error("Error storing file offline:", error);
          dispatch(
            updateProgress({ uri: file.uri, progress: "Failed Offline" })
          );
          dispatch(incrementFailedCount());
        }
      }

      // After storing files, fetch all pending uploads
      dispatch(fetchOfflineUploads());
      return;
    }

    // Online mode: upload via API
    const tasks = files.map((file, index) => async () => {
      const formData = new FormData();
      const fileName =
        file.name || file.uri.split("/").pop() || `file_${index}`;
      const fileType = file.mimeType;

      formData.append("id", fileId || "");
      formData.append("total_segments", totalFiles.toString());
      formData.append("segment_number", (index + 1).toString());
      formData.append("main_category", mainCategoryId);
      formData.append("category_level_1", subCategoryId);
      formData.append("property_id", propertyId);
      formData.append("job_id", jobId);
      formData.append("file_name", fileName);
      formData.append("file_type", fileType);
      formData.append("user_name", userName);
      formData.append("content", {
        uri: file.uri,
        type: fileType,
        name: fileName,
      } as any);

      try {
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
                    uri: file.uri,
                    progress: `${percentCompleted}%`,
                  })
                );
              }
            },
          }
        );
        dispatch(updateProgress({ uri: file.uri, progress: "Complete" }));
        dispatch(incrementSuccessCount());
        return { success: true, data: response.data };
      } catch (error) {
        dispatch(updateProgress({ uri: file.uri, progress: "Failed" }));
        dispatch(incrementFailedCount());
        return { success: false, error };
      }
    });

    // Concurrency control
    const concurrencyLimit = 3;
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

    await Promise.all(results);
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
      });
  },
});

export const {
  setFiles,
  clearFiles,
  updateProgress,
  incrementSuccessCount,
  incrementFailedCount,
} = uploaderSlice.actions;

export default uploaderSlice.reducer;
