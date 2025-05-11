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
  contractor_id?: string;
  payment_status?: string;
  payment_date?: string;
  company?: string;
  phone?: string;
  email?: string;
  contractor_status?: string;
}

export interface ContractorState {
  items: Record<string, Contractor[]>; // Map of jobId to contractors array
  loading: boolean;
  error: string | null;
  lastFetched: Record<string, number>; // Map of jobId to timestamp
  isOffline: boolean; // Track if we're in offline mode
}

const initialState: ContractorState = {
  items: {},
  loading: false,
  error: null,
  lastFetched: {},
  isOffline: false,
};

// Cache expiry in milliseconds (5 minutes)
const CONTRACTORS_CACHE_EXPIRY = 5 * 60 * 1000;

export const fetchContractors = createAsyncThunk<
  { jobId: string; contractors: Contractor[]; isOffline: boolean },
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
      // Return existing data with online status
      const online = await isOnline();
      return { jobId, contractors: items[jobId] || [], isOffline: !online };
    }

    // Create cache key for this jobId
    const cacheKey = `${CONTRACTOR_CACHE_KEY}_${userId}_${jobId}`;

    // Check network status first
    const online = await isOnline();

    // If online, try API first then fallback to cache
    if (online) {
      try {
        const { data } = await axios.get(`${BASE_API_URL}/contractor.php`, {
          params: { userid: userId, job_id: jobId },
          timeout: 10000, // 10 second timeout
        });

        if (data.status === 1) {
          // Extract contractors from the payload, handling nested structure
          let contractorData: any[] = [];

          if (data.payload) {
            if (Array.isArray(data.payload)) {
              contractorData = data.payload;
            } else if (
              data.payload.payload &&
              Array.isArray(data.payload.payload)
            ) {
              contractorData = data.payload.payload;
            } else if (typeof data.payload === "object") {
              contractorData = [data.payload];
            }
          }

          // Make sure all contractors have the required fields
          const validatedContractors = contractorData.map((c) => ({
            ...c,
            amount: c.amount ? String(c.amount) : "0", // Ensure amount exists and is a string
            name: c.name || "Unknown", // Ensure name exists
          }));

          // Store in cache with explicit timestamp for better tracking
          await setCache(cacheKey, validatedContractors);

          return { jobId, contractors: validatedContractors, isOffline: false };
        } else {
          // Store empty array in cache
          await setCache(cacheKey, []);
          return { jobId, contractors: [], isOffline: false };
        }
      } catch (err: any) {
        console.error("Error fetching contractors:", err);
        // If API fails, fall back to cache (don't immediately reject)
        console.log("API error, falling back to cache");
      }
    }

    // At this point, we're either offline or the API call failed
    // Try to get from cache
    try {
      const cacheEntry = await getCache(cacheKey);
      if (cacheEntry && cacheEntry.payload) {
        // When using cache, make sure to store in Redux too
        const cachedContractors = Array.isArray(cacheEntry.payload)
          ? cacheEntry.payload
          : cacheEntry.payload.payload || [];

        return { jobId, contractors: cachedContractors, isOffline: !online };
      }
    } catch (cacheError) {
      console.error("[contractorSlice] Cache error:", cacheError);
    }

    // If we get here, we're offline and there's no cached data
    if (!online) {
      return { jobId, contractors: [], isOffline: true };
    }

    // Last resort: we're online but both API and cache failed
    return rejectWithValue(
      "Unable to load contractor data. Please try again later."
    );
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
      state.isOffline = false;
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
    setOfflineMode: (state, action) => {
      state.isOffline = action.payload;
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
        const { jobId, contractors, isOffline } = action.payload;
        state.items[jobId] = contractors;
        state.lastFetched[jobId] = Date.now();
        state.isOffline = isOffline;
      })
      .addCase(fetchContractors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load contractors";
      });
  },
});

export const { resetContractors, resetContractorsForJob, setOfflineMode } =
  contractorSlice.actions;

// Basic selectors
export const selectContractorsItems = (state: RootState) =>
  state.contractor.items;
export const selectContractorsLoading = (state: RootState) =>
  state.contractor.loading;
export const selectContractorsError = (state: RootState) =>
  state.contractor.error;
export const selectIsOffline = (state: RootState) => state.contractor.isOffline;

// Memoized selector for contractors by job
export const selectContractorsForJob = createSelector(
  [selectContractorsItems, (_, jobId: string) => jobId],
  (items, jobId) => {
    // Get contractors array for the job
    const contractorsForJob = items[jobId] || [];
    return contractorsForJob;
  }
);

export default contractorSlice.reducer;
