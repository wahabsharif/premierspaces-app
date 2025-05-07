import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import {
  BASE_API_URL,
  JOB_TYPES_CACHE_EXPIRY,
  JOB_TYPES_CACHE_KEY,
} from "../Constants/env";
import { Job } from "../types";
import { RootState } from "./index";
import { saveOfflineJob } from "../services/offlineJobService";
import { syncManager } from "../services/syncManager";

// Cache utility functions
export const saveToCache = async (key: string, data: any) => {
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.error("Error saving to cache:", error);
  }
};

export const getFromCache = async (key: string) => {
  try {
    const cachedData = await AsyncStorage.getItem(key);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    return null;
  } catch (error) {
    console.error("Error reading from cache:", error);
    return null;
  }
};

export interface JobState {
  loading: boolean;
  error: string | null;
  success: boolean;
  pendingCount: number;
}

export interface JobTypeState {
  items: Job[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

// Thunk: fetch job types with offline cache fallback
export const fetchJobTypes = createAsyncThunk<
  Job[],
  { userId: string },
  { rejectValue: string; state: RootState }
>("jobTypes/fetch", async ({ userId }, { rejectWithValue, getState }) => {
  console.log("[Slice][fetchJobTypes] Called for user:", userId);

  const cacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;

  // Check if we already have fresh data in Redux store
  const { lastFetched, items } = getState().job.jobTypes;
  const isFresh =
    lastFetched && Date.now() - lastFetched < JOB_TYPES_CACHE_EXPIRY;

  if (isFresh && items.length > 0) {
    return items;
  }

  try {
    console.log("[Slice] Attempting remote fetch…");
    const resp = await axios.get(
      `${BASE_API_URL}/jobtypes.php?userid=${userId}`
    );
    console.log("[Slice] Remote fetch success, payload:", resp.data.payload);

    const jobTypes = resp.data.payload as Job[];
    // Save fresh data
    saveToCache(cacheKey, jobTypes);
    return jobTypes;
  } catch (err: any) {
    console.warn("[Slice] Remote fetch failed, falling back to cache:", err);
    const cachedData = await getFromCache(cacheKey);
    if (cachedData?.data) {
      return cachedData.data as Job[];
    }
    return rejectWithValue(err.response?.data?.message || err.message);
  }
});

// Thunk: create a new job with offline support
export const createJob = createAsyncThunk<
  any,
  { userId: string; jobData: Job },
  { rejectValue: string }
>("job/create", async ({ userId, jobData }, { rejectWithValue }) => {
  try {
    // Check network status
    const netInfo = await NetInfo.fetch();

    if (netInfo.isConnected) {
      // Online: send immediately to server
      const postData = { userid: userId, payload: jobData };
      const response = await axios.post(`${BASE_API_URL}/newjob.php`, postData);
      return response.data;
    } else {
      // Offline: store locally for later sync
      const offlineId = await saveOfflineJob(userId, jobData);

      // Return a custom response that mimics the server
      return {
        message: "Job saved offline and will be synced when online",
        offlineId,
        isOffline: true,
      };
    }
  } catch (err: any) {
    return rejectWithValue(err.message || "Failed to create job");
  }
});

// Thunk: sync all pending jobs
export const syncPendingJobs = createAsyncThunk<
  { syncedCount: number; failedCount: number },
  void,
  { rejectValue: string }
>("job/syncPending", async (_, { rejectWithValue }) => {
  try {
    return new Promise((resolve, reject) => {
      let complete = false;

      // Add a listener for sync completion
      const unsubscribe = syncManager.addSyncListener((syncState) => {
        if (syncState.status === "complete" && !complete) {
          complete = true;
          unsubscribe();
          resolve({
            syncedCount: syncState.syncedCount || 0,
            failedCount: syncState.failedCount || 0,
          });
        } else if (syncState.status === "error" && !complete) {
          complete = true;
          unsubscribe();
          reject(new Error(syncState.message));
        }
      });

      // Start the sync
      syncManager.manualSync();

      // Safety timeout - resolve after 30s if not completed
      setTimeout(() => {
        if (!complete) {
          complete = true;
          unsubscribe();
          resolve({ syncedCount: 0, failedCount: 0 });
        }
      }, 30000);
    });
  } catch (err: any) {
    return rejectWithValue(err.message || "Failed to sync jobs");
  }
});

const initialJobState: JobState = {
  loading: false,
  error: null,
  success: false,
  pendingCount: 0,
};

const initialJobTypeState: JobTypeState = {
  items: [],
  loading: false,
  error: null,
  lastFetched: null,
};

const slice = createSlice({
  name: "job",
  initialState: { job: initialJobState, jobTypes: initialJobTypeState },
  reducers: {
    resetJobState: (state) => {
      state.job = initialJobState;
    },
    resetJobTypes: (state) => {
      state.jobTypes = initialJobTypeState;
    },
    updatePendingCount: (state, action: PayloadAction<number>) => {
      state.job.pendingCount = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createJob.pending, (state) => {
        state.job.loading = true;
        state.job.error = null;
        state.job.success = false;
      })
      .addCase(createJob.fulfilled, (state, action) => {
        state.job.loading = false;
        state.job.success = true;
        // If job was saved offline, increment pending count
        if (action.payload?.isOffline) {
          state.job.pendingCount += 1;
        }
      })
      .addCase(createJob.rejected, (state, action) => {
        state.job.loading = false;
        state.job.error = action.payload || "Failed to create job";
      })
      .addCase(fetchJobTypes.pending, (state) => {
        state.jobTypes.loading = true;
        state.jobTypes.error = null;
      })
      .addCase(
        fetchJobTypes.fulfilled,
        (state, action: PayloadAction<Job[]>) => {
          state.jobTypes.loading = false;
          state.jobTypes.items = action.payload;
          state.jobTypes.lastFetched = Date.now();
        }
      )
      .addCase(fetchJobTypes.rejected, (state, action) => {
        state.jobTypes.loading = false;
        state.jobTypes.error = action.payload || "Failed to load job types";
      })
      .addCase(syncPendingJobs.fulfilled, (state, action) => {
        // Update pending count after sync
        if (action.payload.syncedCount > 0) {
          state.job.pendingCount = Math.max(
            0,
            state.job.pendingCount - action.payload.syncedCount
          );
        }
      });
  },
});

export const { resetJobState, resetJobTypes, updatePendingCount } =
  slice.actions;
export const selectJobState = (state: RootState) => state.job.job;
export const selectJobTypes = (state: RootState) => state.job.jobTypes;
export const selectIsJobTypesStale = (state: RootState) => {
  const last = state.job.jobTypes.lastFetched;
  if (!last) return true;
  return Date.now() - last > JOB_TYPES_CACHE_EXPIRY;
};
export const selectPendingJobsCount = (state: RootState) =>
  state.job.job.pendingCount;

export default slice.reducer;
