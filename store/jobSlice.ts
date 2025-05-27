import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import {
  BASE_API_URL,
  CACHE_CONFIG,
  JOB_TYPES_CACHE_EXPIRY,
} from "../Constants/env";
import { generateCommonId } from "../helper";
import { getCache, refreshCachesAfterPost } from "../services/cacheService";
import {
  createJob as createOfflineJob,
  getAllJobs,
  updateJob as updateOfflineJob,
} from "../services/jobService";
import { syncManager } from "../services/syncManager";
import { Job } from "../types";
import { createCost } from "./costsSlice";
import { RootState } from "./index";
import { Toast } from "toastify-react-native";

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

export interface JobsListState {
  [x: string]: any;
  items: Job[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

export const fetchJobTypes = createAsyncThunk<
  Job[],
  { userId: string; useCache?: boolean },
  { rejectValue: string; state: RootState }
>(
  "jobTypes/fetch",
  async ({ userId, useCache = false }, { rejectWithValue, getState }) => {
    const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.JOB_TYPES}_${userId}`;

    const { lastFetched, items } = (getState() as RootState).job.jobTypes;
    const isFresh =
      lastFetched && Date.now() - lastFetched < JOB_TYPES_CACHE_EXPIRY;

    // If data is fresh and available, return it immediately
    if (isFresh && items.length > 0) {
      return items;
    }

    // If useCache flag is set, prefer cache even if stale
    if (useCache) {
      try {
        const cachedEntry = await getCache(cacheKey);
        if (cachedEntry?.payload?.payload) {
          return cachedEntry.payload.payload as Job[];
        }
      } catch (err) {
        // Continue to next strategy
      }
    }

    try {
      // Only attempt network request if not explicitly using cache
      if (!useCache) {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          const resp = await axios.get(
            `${BASE_API_URL}/jobtypes.php?userid=${userId}`,
            { timeout: 10000 } // Add timeout to prevent hanging requests
          );

          if (resp.data && resp.data.payload) {
            const jobTypes = resp.data.payload as Job[];
            return jobTypes;
          }
        }
      }

      // If we get here, either network request failed or we're offline
      // Fall back to cache
      const cachedEntry = await getCache(cacheKey);
      if (cachedEntry?.payload?.payload) {
        return cachedEntry.payload.payload as Job[];
      }

      // If no cached data, throw error
      throw new Error("No cached job types available");
    } catch (err: any) {
      // Final attempt to get from cache if we haven't already
      if (!useCache) {
        try {
          const cachedEntry = await getCache(cacheKey);
          if (cachedEntry?.payload?.payload) {
            return cachedEntry.payload.payload as Job[];
          }
        } catch (cacheErr) {
          // Last cache attempt failed
        }
      }

      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchJobs = createAsyncThunk<
  Job[],
  { userId: string; propertyId?: string; force?: boolean; useCache?: boolean },
  { rejectValue: string; state: RootState }
>(
  "jobs/fetch",
  async (
    { userId, propertyId, force = false, useCache = false },
    { getState, dispatch }
  ) => {
    const cacheKey = `jobsCache_${userId}${
      propertyId ? "_prop_" + propertyId : ""
    }`;
    const ENDPOINT = `${BASE_API_URL}/getjobs.php?userid=${userId}${
      propertyId ? "&property_id=" + propertyId : ""
    }`;

    // 1) Always grab local (offline) jobs first
    let offlineJobs: Job[] = [];
    try {
      offlineJobs = await getAllJobs();
      dispatch(updatePendingCount(offlineJobs.length));

      // Filter offline jobs by property if needed
      if (propertyId) {
        const propIdStr = String(propertyId);
        offlineJobs = offlineJobs.filter(
          (j) => String(j.property_id) === propIdStr
        );
      }
    } catch (err) {
      Toast.error(
        `Error fetching offline jobs: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // Check network connectivity first
    const net = await NetInfo.fetch();
    const isOnline = net.isConnected;

    // 2) If we're offline or useCache flag is set, combine SQLite jobs with cached server jobs
    if (!isOnline || useCache) {
      // Get cached server jobs
      let cachedServerJobs: Job[] = [];
      try {
        const entry = await getCache(cacheKey);
        cachedServerJobs = (entry?.payload?.payload as Job[]) || [];

        // Apply property filter if not already in the cache key
        if (propertyId && !cacheKey.includes("_prop_")) {
          cachedServerJobs = cachedServerJobs.filter(
            (j) => j.property_id === propertyId
          );
        }
      } catch (err) {
        Toast.error(
          `Error fetching cached jobs: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }

      // Combine offline and cached server jobs
      const combinedJobs = [...cachedServerJobs];
      offlineJobs.forEach((o) => {
        // Don't add if already in the list (by ID)
        if (!combinedJobs.some((j) => j.id === o.id)) {
          combinedJobs.push(o);
        }
      });

      // Sort by date (newest first)
      combinedJobs.sort(
        (a, b) =>
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime()
      );

      return combinedJobs;
    }

    // 3) ONLINE CASE: If we have network, prioritize API data
    if (isOnline) {
      try {
        const resp = await axios.get(ENDPOINT, {
          timeout: 15000, // Add timeout to prevent hanging requests
        });

        if (resp.data.status === 1) {
          const serverJobs = resp.data.payload as Job[];
          const merged = [...serverJobs];
          offlineJobs.forEach((o) => {
            if (!merged.some((j) => j.id === o.id)) {
              merged.push(o);
            }
          });

          // Sort by date_created desc
          merged.sort(
            (a, b) =>
              new Date(b.date_created).getTime() -
              new Date(a.date_created).getTime()
          );

          return merged;
        } else {
          throw new Error("Invalid API response");
        }
      } catch (err: any) {
        // API request failed, fall back to cache
        Toast.info("Using cached data - API request failed");

        // Fall back to cache
        const entry = await getCache(cacheKey);
        const cached: Job[] = (entry?.payload?.payload as Job[]) || [];

        const fallback = [...cached];
        offlineJobs.forEach((o) => {
          if (!fallback.some((j) => j.id === o.id)) {
            fallback.push(o);
          }
        });

        fallback.sort(
          (a, b) =>
            new Date(b.date_created).getTime() -
            new Date(a.date_created).getTime()
        );

        return fallback;
      }
    }

    // This should never happen (either offline or online case should be handled)
    return [];
  }
);

export const createJob = createAsyncThunk<
  any,
  { userId: string; jobData: Job },
  { rejectValue: string; state: RootState }
>("job/create", async ({ userId, jobData }, { rejectWithValue, dispatch }) => {
  try {
    // Generate common_id for the job
    const common_id = generateCommonId();

    // Ensure material_cost is formatted as an integer
    const formattedJobData = {
      ...jobData,
      material_cost: jobData.material_cost
        ? String(Math.round(parseFloat(jobData.material_cost)))
        : "0",
      common_id,
    };

    await AsyncStorage.setItem(
      `${common_id}`,
      JSON.stringify(formattedJobData)
    );
    const netInfo = await NetInfo.fetch();

    if (netInfo.isConnected) {
      const postData = { userid: userId, payload: formattedJobData };
      const response = await axios.post(`${BASE_API_URL}/job.php`, postData);

      // Refresh caches after successful POST operation with comprehensive refresh
      await refreshCachesAfterPost(userId);

      // Force a job list refresh after creating a job
      dispatch(resetJobsList());

      return response.data;
    } else {
      // Save job locally and note that it's pending sync
      const offlineId = await createOfflineJob(formattedJobData);

      // Force a job list refresh after creating a job
      dispatch(resetJobsList());

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

export const updateJob = createAsyncThunk<
  any,
  { userId: string; jobData: Job },
  { rejectValue: string; state: RootState }
>("job/update", async ({ userId, jobData }, { rejectWithValue }) => {
  try {
    const common_id = jobData.common_id || generateCommonId();
    const formattedJobData = {
      ...jobData,
      material_cost: jobData.material_cost
        ? String(Math.round(parseFloat(jobData.material_cost)))
        : "0",
      common_id,
    };
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      const apiPayload = {
        ...formattedJobData,
        job_id: formattedJobData.id,
      };
      const postData = { userid: userId, payload: apiPayload };
      const response = await axios.put(`${BASE_API_URL}/job.php`, postData);
      if (response.data.status !== 1) {
        await updateOfflineJob(formattedJobData);
        return {
          message:
            response.data.payload?.message ||
            "API update failed, saved locally",
          isOffline: true,
          apiError: true,
        };
      }

      // Refresh all relevant caches after successful job update
      await refreshCachesAfterPost(userId);

      await updateOfflineJob(formattedJobData);
      return response.data;
    } else {
      await updateOfflineJob(formattedJobData);
      return {
        message: "Job updated offline and will be synced when online",
        isOffline: true,
      };
    }
  } catch (err: any) {
    console.error("Error updating job:", err);
    return rejectWithValue(err.message || "Failed to update job");
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

const initialJobsListState: JobsListState = {
  items: [],
  loading: false,
  error: null,
  lastFetched: null,
};

const slice = createSlice({
  name: "job",
  initialState: {
    job: initialJobState,
    jobTypes: initialJobTypeState,
    jobsList: initialJobsListState,
  },
  reducers: {
    resetJobState: (state) => {
      state.job = initialJobState;
    },
    resetJobTypes: (state) => {
      state.jobTypes = initialJobTypeState;
    },
    resetJobsList: (state) => {
      state.jobsList = initialJobsListState;
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
      .addCase(fetchJobs.pending, (state) => {
        state.jobsList.loading = true;
        state.jobsList.error = null;
      })
      .addCase(fetchJobs.fulfilled, (state, action: PayloadAction<Job[]>) => {
        state.jobsList.loading = false;
        state.jobsList.items = action.payload;
        state.jobsList.lastFetched = Date.now();
        state.jobsList.error = null;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.jobsList.loading = false;
        state.jobsList.error = action.payload || "Failed to load jobs";
      })
      .addCase(createCost.fulfilled, (state, action) => {
        // action.meta.arg is the object you passed to createCost()
        const { jobId, materialCost } = action.meta.arg as {
          jobId: string;
          materialCost?: string;
        };

        // Find and update the job's material_cost
        const job = state.jobsList.items.find((j: Job) => j.id === jobId);
        if (job && materialCost !== undefined) {
          job.material_cost = materialCost;
        }
      })
      .addCase(syncPendingJobs.fulfilled, (state, action) => {
        if (action.payload.syncedCount > 0) {
          state.job.pendingCount = Math.max(
            0,
            state.job.pendingCount - action.payload.syncedCount
          );
        }
      })
      .addCase(updateJob.pending, (state) => {
        state.job.loading = true;
        state.job.error = null;
        state.job.success = false;
      })
      .addCase(updateJob.fulfilled, (state, action) => {
        state.job.loading = false;
        state.job.success = true;
      })
      .addCase(updateJob.rejected, (state, action) => {
        state.job.loading = false;
        state.job.error = action.payload || "Failed to update job";
      });
  },
});

export const {
  resetJobState,
  resetJobTypes,
  resetJobsList,
  updatePendingCount,
} = slice.actions;

export const selectJobState = (state: RootState) => state.job.job;
export const selectJobTypes = (state: RootState) => state.job.jobTypes;
export const selectJobsList = (state: RootState) => state.job.jobsList;
export const selectIsJobTypesStale = (state: RootState) => {
  const last = state.job.jobTypes.lastFetched;
  if (!last) return true;
  return Date.now() - last > JOB_TYPES_CACHE_EXPIRY;
};
export const selectPendingJobsCount = (state: RootState) =>
  state.job.job.pendingCount;

export default slice.reducer;
