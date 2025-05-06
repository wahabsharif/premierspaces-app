// store/createJobSlice.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import {
  BASE_API_URL,
  JOB_TYPES_CACHE_EXPIRY,
  JOB_TYPES_CACHE_KEY,
} from "../Constants/env";
import { Job } from "../types";
import { RootState } from "./index";

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
  const cacheKey = `${JOB_TYPES_CACHE_KEY}_${userId}`;

  // Check if we already have fresh data in Redux store
  const { lastFetched, items } = getState().job.jobTypes;
  const isFresh =
    lastFetched && Date.now() - lastFetched < JOB_TYPES_CACHE_EXPIRY;

  if (isFresh && items.length > 0) {
    return items;
  }

  try {
    // Try network first
    const resp = await axios.get(
      `${BASE_API_URL}/jobtypes.php?userid=${userId}`
    );
    const jobTypes = resp.data.payload as Job[];
    // Save fresh data
    saveToCache(cacheKey, jobTypes);
    return jobTypes;
  } catch (err: any) {
    // Fallback to cache when error or offline
    const cachedData = await getFromCache(cacheKey);
    if (cachedData?.data) {
      return cachedData.data as Job[];
    }
    return rejectWithValue(err.response?.data?.message || err.message);
  }
});

// Thunk: create a new job
export const createJob = createAsyncThunk<
  any,
  { userId: string; jobData: Job },
  { rejectValue: string }
>("job/create", async ({ userId, jobData }, { rejectWithValue }) => {
  try {
    const postData = { userid: userId, payload: jobData };
    const response = await axios.post(`${BASE_API_URL}/newjob.php`, postData);
    return response.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || err.message);
  }
});

const initialJobState: JobState = {
  loading: false,
  error: null,
  success: false,
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(createJob.pending, (state) => {
        state.job.loading = true;
        state.job.error = null;
        state.job.success = false;
      })
      .addCase(createJob.fulfilled, (state) => {
        state.job.loading = false;
        state.job.success = true;
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
      });
  },
});

export const { resetJobState, resetJobTypes } = slice.actions;
export const selectJobState = (state: RootState) => state.job.job;
export const selectJobTypes = (state: RootState) => state.job.jobTypes;
export const selectIsJobTypesStale = (state: RootState) => {
  const last = state.job.jobTypes.lastFetched;
  if (!last) return true;
  return Date.now() - last > JOB_TYPES_CACHE_EXPIRY;
};

export default slice.reducer;
