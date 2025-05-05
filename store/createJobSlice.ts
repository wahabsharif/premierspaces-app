import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { baseApiUrl } from "../Constants/env";
import { RootState } from "./index";
import { JobType } from "../types";

export interface JobTasks {
  [key: string]: string;
}

export interface JobState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export interface JobTypeState {
  items: JobType[];
  loading: boolean;
  error: string | null;
}

interface NewJobPayload {
  property_id: string;
  job_type: string;
  tasks: JobTasks;
}

// Fetch available job types
export const fetchJobTypes = createAsyncThunk<
  JobType[],
  { userId: string },
  { rejectValue: string }
>("jobTypes/fetch", async ({ userId }, { rejectWithValue }) => {
  try {
    const response = await axios.get(
      `${baseApiUrl}/jobtypes.php?userid=${userId}`
    );
    return response.data.payload as JobType[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || err.message);
  }
});

// Create a new job
export const createJob = createAsyncThunk<
  any,
  { userId: string; jobData: NewJobPayload },
  { rejectValue: string }
>("job/create", async ({ userId, jobData }, { rejectWithValue }) => {
  try {
    const postData = { userid: userId, payload: jobData };
    const response = await axios.post(
      `${baseApiUrl}/newjob.php?userid=${userId}`,
      postData
    );
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
};

const slice = createSlice({
  name: "job",
  initialState: {
    job: initialJobState,
    jobTypes: initialJobTypeState,
  },
  reducers: {
    resetJobState: (state) => {
      state.job = { ...initialJobState };
    },
    resetJobTypes: (state) => {
      state.jobTypes = { ...initialJobTypeState };
    },
  },
  extraReducers: (builder) => {
    // createJob reducers
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
      // fetchJobTypes reducers
      .addCase(fetchJobTypes.pending, (state) => {
        state.jobTypes.loading = true;
        state.jobTypes.error = null;
      })
      .addCase(
        fetchJobTypes.fulfilled,
        (state, action: PayloadAction<JobType[]>) => {
          state.jobTypes.loading = false;
          state.jobTypes.items = action.payload;
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

export default slice.reducer;
