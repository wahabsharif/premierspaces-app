import NetInfo from "@react-native-community/netinfo";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import {
  BASE_API_URL,
  JOB_TYPES_CACHE_EXPIRY,
  JOB_TYPES_CACHE_KEY,
} from "../Constants/env";
import { getCache, setCache } from "../services/cacheService";
import { createJob as createOfflineJob } from "../services/jobService";
import { syncManager } from "../services/syncManager";
import { Job } from "../types";
import { RootState } from "./index";

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

export const fetchJobTypes = createAsyncThunk<
  Job[],
  { userId: string },
  { rejectValue: string; state: RootState }
>("jobTypes/fetch", async ({ userId }, { rejectWithValue, getState }) => {
  const cacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;

  const { lastFetched, items } = getState().job.jobTypes;
  const isFresh =
    lastFetched && Date.now() - lastFetched < JOB_TYPES_CACHE_EXPIRY;

  if (isFresh && items.length > 0) {
    return items;
  }

  try {
    const resp = await axios.get(
      `${BASE_API_URL}/jobtypes.php?userid=${userId}`
    );

    const jobTypes = resp.data.payload as Job[];

    // Store in SQLite cache
    await setCache(cacheKey, {
      created_at: Date.now(),
      payload: jobTypes,
    });

    return jobTypes;
  } catch (err: any) {
    console.warn("[Slice] Remote fetch failed, falling back to cache:", err);

    // Get from SQLite cache
    const cachedEntry = await getCache(cacheKey);
    if (cachedEntry?.payload?.payload) {
      return cachedEntry.payload.payload as Job[];
    }

    return rejectWithValue(err.response?.data?.message || err.message);
  }
});

export const createJob = createAsyncThunk<
  any,
  { userId: string; jobData: Job },
  { rejectValue: string }
>("job/create", async ({ userId, jobData }, { rejectWithValue }) => {
  try {
    const netInfo = await NetInfo.fetch();

    if (netInfo.isConnected) {
      const postData = { userid: userId, payload: jobData };
      const response = await axios.post(`${BASE_API_URL}/newjob.php`, postData);
      return response.data;
    } else {
      const offlineId = await createOfflineJob(jobData);

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

export const syncPendingJobs = createAsyncThunk<
  { syncedCount: number; failedCount: number },
  void,
  { rejectValue: string }
>("job/syncPending", async (_, { rejectWithValue }) => {
  try {
    return new Promise((resolve, reject) => {
      let complete = false;
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

      syncManager.manualSync();

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
