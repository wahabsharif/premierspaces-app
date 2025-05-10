import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL, CONTRACTOR_CACHE_KEY } from "../Constants/env";
import { getCache, isOnline, setCache } from "../services/cacheService";
import { RootState } from "./index";

export interface Contractor {
  name: string;
  amount: string;
  id?: string;
  job_id?: string;
}

export interface ContractorState {
  items: Record<string, Contractor[]>; // Map of jobId to contractors array
  loading: boolean;
  error: string | null;
  lastFetched: Record<string, number>; // Map of jobId to timestamp
}

const initialState: ContractorState = {
  items: {},
  loading: false,
  error: null,
  lastFetched: {},
};

// Cache expiry in milliseconds (5 minutes)
const CONTRACTORS_CACHE_EXPIRY = 5 * 60 * 1000;

export const fetchContractors = createAsyncThunk<
  { jobId: string; contractors: Contractor[] },
  { userId: string; jobId: string },
  { rejectValue: string; state: RootState }
>(
  "contractors/fetch",
  async ({ userId, jobId }, { rejectWithValue, getState }) => {
    const { lastFetched, items } = getState().contractor;

    // Check if we have fresh data in the store
    const isFresh =
      lastFetched[jobId] &&
      Date.now() - lastFetched[jobId] < CONTRACTORS_CACHE_EXPIRY;

    if (isFresh && items[jobId]?.length >= 0) {
      return { jobId, contractors: items[jobId] || [] };
    }

    // Try to get from cache first
    const cacheKey = `${CONTRACTOR_CACHE_KEY}_${userId}_${jobId}`;
    try {
      const cacheEntry = await getCache(cacheKey);
      if (cacheEntry && cacheEntry.payload) {
        // When using cache, make sure to store in Redux too
        return { jobId, contractors: cacheEntry.payload };
      }
    } catch (cacheError) {
      console.error("[contractorSlice] Cache error:", cacheError);
      // Continue to API fetch on cache error
    }

    // Check if we're online before trying API
    const online = await isOnline();
    if (!online) {
      return rejectWithValue("Device is offline. Cannot fetch contractors.");
    }

    try {
      const { data } = await axios.get(`${BASE_API_URL}/contractor.php`, {
        params: { userid: userId, job_id: jobId },
      });

      if (data.status === 1) {
        const contractors: Contractor[] = Array.isArray(data.payload)
          ? data.payload
          : data.payload
          ? [data.payload]
          : [];

        // Store in cache with explicit timestamp for better tracking
        await setCache(cacheKey, contractors);

        return { jobId, contractors };
      } else {
        // Store empty array in cache
        await setCache(cacheKey, []);
        return { jobId, contractors: [] };
      }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const contractorSlice = createSlice({
  name: "contractor",
  initialState,
  reducers: {
    resetContractors: (state) => {
      state.items = {};
      state.loading = false;
      state.error = null;
      state.lastFetched = {};
    },
    resetContractorsForJob: (state, action) => {
      const jobId = action.payload;
      if (state.items[jobId]) {
        delete state.items[jobId];
      }
      if (state.lastFetched[jobId]) {
        delete state.lastFetched[jobId];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContractors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContractors.fulfilled, (state, action) => {
        state.loading = false;
        const { jobId, contractors } = action.payload;
        state.items[jobId] = contractors;
        state.lastFetched[jobId] = Date.now();
      })
      .addCase(fetchContractors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load contractors";
      });
  },
});

export const { resetContractors, resetContractorsForJob } =
  contractorSlice.actions;

// Basic selectors
export const selectContractorsItems = (state: RootState) =>
  state.contractor.items;
export const selectContractorsLoading = (state: RootState) =>
  state.contractor.loading;
export const selectContractorsError = (state: RootState) =>
  state.contractor.error;

// Memoized selector for contractors by job
export const selectContractorsForJob = createSelector(
  [selectContractorsItems, (_, jobId: string) => jobId],
  (items, jobId) => items[jobId] || []
);

export default contractorSlice.reducer;
