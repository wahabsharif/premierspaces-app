import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL } from "../Constants/env";
import { getFileId } from "../helper";
import { MediaFile } from "../types";
import { RootState } from "./index";

interface UploaderState {
  files: MediaFile[];
  uploading: boolean;
  progress: { [uri: string]: string };
  successCount: number;
  failedCount: number;
}

const initialState: UploaderState = {
  files: [],
  uploading: false,
  progress: {},
  successCount: 0,
  failedCount: 0,
};

// Async thunk to upload files
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

    const fileId = getFileId();
    const totalFiles = files.length;
    const results = [];

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
