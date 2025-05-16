import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL, JOB_TYPES_CACHE_EXPIRY } from "../Constants/env";
import { generateCommonId } from "../helper";
import { syncManager } from "../services/syncManager";
import { Job } from "../types";
import { createCost } from "./costsSlice";
import { RootState } from "./index";

// Add a request throttling mechanism
const apiThrottles = {
  jobTypes: { lastFetch: 0, inProgress: false },
  jobs: { lastFetch: 0, inProgress: false },
};

// Define minimum time between requests (5 seconds)
const THROTTLE_TIME = 5000;

// Helper to check if a request should be throttled
const shouldThrottle = (key: "jobTypes" | "jobs") => {
  const now = Date.now();
  const throttleInfo = apiThrottles[key];

  // If a request is in progress or if the last request was too recent, throttle
  if (throttleInfo.inProgress || now - throttleInfo.lastFetch < THROTTLE_TIME) {
    console.log(
      `[JobSlice] Throttled API request for ${key}. Last call: ${
        (now - throttleInfo.lastFetch) / 1000
      }s ago, in progress: ${throttleInfo.inProgress}`
    );
    return true;
  }

  // Update the throttle state
  throttleInfo.lastFetch = now;
  throttleInfo.inProgress = true;
  return false;
};

// Helper to mark a request as complete
const markRequestComplete = (key: "jobTypes" | "jobs") => {
  apiThrottles[key].inProgress = false;
};

export const fetchJobTypes = createAsyncThunk<
  Job[],
  { userId: string },
  { rejectValue: string; state: RootState }
>("jobTypes/fetch", async ({ userId }, { rejectWithValue, getState }) => {
  // Check if we should throttle this request
  if (shouldThrottle("jobTypes")) {
    // Return existing data if available
    const currentItems = getState().job.jobTypes.items;
    if (currentItems.length > 0) {
      console.log(
        `[JobSlice] Returning existing ${currentItems.length} job types due to throttling`
      );
      return currentItems;
    }
  }

  console.log(`[JobSlice] Fetching job types for userId: ${userId}`);
  try {
    console.log(
      `[JobSlice] Making API request to: ${BASE_API_URL}/jobtypes.php?userid=${userId}`
    );
    const resp = await axios.get(
      `${BASE_API_URL}/jobtypes.php?userid=${userId}`
    );

    console.log(
      `[JobSlice] Job types API response status: ${resp.data.status}`
    );
    console.log(
      `[JobSlice] Retrieved ${resp.data.payload?.length || 0} job types`
    );

    return resp.data.payload as Job[];
  } catch (err: any) {
    console.error(`[JobSlice] Failed to fetch job types: ${err.message}`, err);
    console.error(`[JobSlice] Response data:`, err.response?.data);
    return rejectWithValue(err.response?.data?.message || err.message);
  } finally {
    // Mark request as complete
    markRequestComplete("jobTypes");
  }
});

export const fetchJobs = createAsyncThunk<
  Job[],
  { userId: string; propertyId?: string },
  { rejectValue: string; state: RootState }
>(
  "jobs/fetch",
  async ({ userId, propertyId }, { rejectWithValue, getState }) => {
    // Check if we should throttle this request
    if (shouldThrottle("jobs")) {
      // Return existing data if available
      const currentItems = getState().job.jobsList.items;
      if (currentItems.length > 0) {
        const filteredItems = propertyId
          ? currentItems.filter((j: Job) => j.property_id === propertyId)
          : currentItems;
        console.log(
          `[JobSlice] Returning existing ${filteredItems.length} jobs due to throttling`
        );
        return filteredItems;
      }
    }

    console.log(
      `[JobSlice] Fetching jobs for userId: ${userId}${
        propertyId ? `, propertyId: ${propertyId}` : ""
      }`
    );
    try {
      const ENDPOINT = `${BASE_API_URL}/getjobs.php?userid=${userId}`;
      console.log(`[JobSlice] Making API request to: ${ENDPOINT}`);

      const resp = await axios.get(ENDPOINT);
      console.log(`[JobSlice] Jobs API response status: ${resp.data.status}`);

      const jobs = resp.data.status === 1 ? (resp.data.payload as Job[]) : [];
      console.log(`[JobSlice] Retrieved ${jobs.length} jobs from API`);

      // Apply propertyId filter if needed
      const filteredJobs = propertyId
        ? jobs.filter((j) => j.property_id === propertyId)
        : jobs;
      console.log(
        `[JobSlice] After filtering: ${filteredJobs.length} jobs${
          propertyId ? ` for propertyId: ${propertyId}` : ""
        }`
      );

      return filteredJobs;
    } catch (err: any) {
      console.error(`[JobSlice] Failed to fetch jobs: ${err.message}`, err);
      console.error(`[JobSlice] Response data:`, err.response?.data);
      return rejectWithValue(err.response?.data?.message || err.message);
    } finally {
      // Mark request as complete
      markRequestComplete("jobs");
    }
  }
);

export const createJob = createAsyncThunk<
  any,
  { userId: string; jobData: Job },
  { rejectValue: string; state: RootState }
>("job/create", async ({ userId, jobData }, { rejectWithValue, dispatch }) => {
  console.log(`[JobSlice] Creating new job for userId: ${userId}`);
  console.log(`[JobSlice] Job data:`, JSON.stringify(jobData, null, 2));

  try {
    // Generate common_id for the job
    const common_id = generateCommonId();
    console.log(`[JobSlice] Generated common_id: ${common_id}`);

    const jobWithCommonId = { ...jobData, common_id };
    console.log(`[JobSlice] Making API request to: ${BASE_API_URL}/newjob.php`);

    const postData = { userid: userId, payload: jobWithCommonId };
    const response = await axios.post(`${BASE_API_URL}/newjob.php`, postData);

    console.log(
      `[JobSlice] Create job API response:`,
      JSON.stringify(response.data, null, 2)
    );

    // Force a job list refresh after creating a job
    console.log(`[JobSlice] Resetting jobs list after job creation`);
    dispatch(resetJobsList());

    return response.data;
  } catch (err: any) {
    console.error(`[JobSlice] Failed to create job: ${err.message}`, err);
    console.error(`[JobSlice] Response data:`, err.response?.data);
    return rejectWithValue(err.message || "Failed to create job");
  }
});

export const syncPendingJobs = createAsyncThunk<
  { syncedCount: number; failedCount: number },
  void,
  { rejectValue: string }
>("job/syncPending", async (_, { rejectWithValue }) => {
  console.log(`[JobSlice] Starting sync of pending jobs`);

  try {
    return new Promise((resolve, reject) => {
      let complete = false;
      console.log(`[JobSlice] Adding sync listener`);

      const unsubscribe = syncManager.addSyncListener((syncState) => {
        console.log(`[JobSlice] Sync status update:`, syncState);

        if (syncState.status === "complete" && !complete) {
          complete = true;
          unsubscribe();
          console.log(
            `[JobSlice] Sync completed successfully: ${
              syncState.syncedCount || 0
            } synced, ${syncState.failedCount || 0} failed`
          );
          resolve({
            syncedCount: syncState.syncedCount || 0,
            failedCount: syncState.failedCount || 0,
          });
        } else if (syncState.status === "error" && !complete) {
          complete = true;
          unsubscribe();
          console.error(
            `[JobSlice] Sync failed with error: ${syncState.message}`
          );
          reject(new Error(syncState.message));
        }
      });

      console.log(`[JobSlice] Triggering manual sync`);
      syncManager.manualSync();

      setTimeout(() => {
        if (!complete) {
          complete = true;
          unsubscribe();
          console.warn(`[JobSlice] Sync timed out after 30 seconds`);
          resolve({ syncedCount: 0, failedCount: 0 });
        }
      }, 30000);
    });
  } catch (err: any) {
    console.error(`[JobSlice] Sync error in catch block: ${err.message}`, err);
    return rejectWithValue(err.message || "Failed to sync jobs");
  }
});

// Define the JobState type if not already defined or import it from your types module
type JobState = {
  loading: boolean;
  error: string | null;
  success: boolean;
  pendingCount: number;
};

const initialJobState: JobState = {
  loading: false,
  error: null,
  success: false,
  pendingCount: 0,
};

type JobTypeState = {
  items: Job[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
};

const initialJobTypeState: JobTypeState = {
  items: [],
  loading: false,
  error: null,
  lastFetched: null,
};

type JobsListState = {
  items: Job[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
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
        const { jobId, materialCost } = action.meta.arg as {
          jobId: string;
          materialCost?: string;
        };

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
