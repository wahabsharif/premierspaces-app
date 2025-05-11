import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL, COST_CACHE_KEY } from "../Constants/env";
import { getCache, isOnline, setCache } from "../services/cacheService";
import { RootState } from "./index";

export interface Costs {
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

export interface CostState {
  items: Record<string, Costs[]>;
  loading: boolean;
  error: string | null;
  lastFetched: Record<string, number>;
  isOffline: boolean;
}

const initialState: CostState = {
  items: {},
  loading: false,
  error: null,
  lastFetched: {},
  isOffline: false,
};

// Cache expiry in milliseconds (5 minutes)
const COSTS_CACHE_EXPIRY = 5 * 60 * 1000;

export const fetchCosts = createAsyncThunk<
  { jobId: string; costs: Costs[]; isOffline: boolean },
  { userId: string; jobId: string },
  { rejectValue: string; state: RootState }
>("costs/fetch", async ({ userId, jobId }, { rejectWithValue, getState }) => {
  const { lastFetched, items } = getState().cost;

  // Check if we have fresh data in the store
  const isFresh =
    lastFetched[jobId] && Date.now() - lastFetched[jobId] < COSTS_CACHE_EXPIRY;

  if (isFresh && items[jobId]?.length >= 0) {
    // Return existing data with online status
    const online = await isOnline();
    return { jobId, costs: items[jobId] || [], isOffline: !online };
  }

  // Create cache key for this jobId
  const cacheKey = `${COST_CACHE_KEY}_${userId}_${jobId}`;

  // Check network status first
  const online = await isOnline();

  // If online, try API first then fallback to cache
  if (online) {
    try {
      const { data } = await axios.get(`${BASE_API_URL}/costs.php`, {
        params: { userid: userId, job_id: jobId },
        timeout: 10000, // 10 second timeout
      });

      if (data.status === 1) {
        let costData: any[] = [];

        if (data.payload) {
          if (Array.isArray(data.payload)) {
            costData = data.payload;
          } else if (
            data.payload.payload &&
            Array.isArray(data.payload.payload)
          ) {
            costData = data.payload.payload;
          } else if (typeof data.payload === "object") {
            costData = [data.payload];
          }
        }

        // Make sure all contractors have the required fields
        const validatedCosts = costData.map((c) => ({
          ...c,
          amount: c.amount ? String(c.amount) : "0", // Ensure amount exists and is a string
          name: c.name || "Unknown", // Ensure name exists
        }));

        // Store in cache with explicit timestamp for better tracking
        await setCache(cacheKey, validatedCosts);

        return { jobId, costs: validatedCosts, isOffline: false };
      } else {
        // Store empty array in cache
        await setCache(cacheKey, []);
        return { jobId, costs: [], isOffline: false };
      }
    } catch (err: any) {
      console.error("Error fetching costs:", err);
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
      const cachedCosts = Array.isArray(cacheEntry.payload)
        ? cacheEntry.payload
        : cacheEntry.payload.payload || [];

      return { jobId, costs: cachedCosts, isOffline: !online };
    }
  } catch (cacheError) {
    console.error("[costsSlice] Cache error:", cacheError);
  }

  // If we get here, we're offline and there's no cached data
  if (!online) {
    return { jobId, costs: [], isOffline: true };
  }

  // Last resort: we're online but both API and cache failed
  return rejectWithValue("Unable to load costs data. Please try again later.");
});

const costSlice = createSlice({
  name: "cost",
  initialState,
  reducers: {
    resetCosts: (state) => {
      state.items = {};
      state.loading = false;
      state.error = null;
      state.lastFetched = {};
      state.isOffline = false;
    },
    resetCostsForJob: (state, action) => {
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
      .addCase(fetchCosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCosts.fulfilled, (state, action) => {
        state.loading = false;
        const { jobId, costs, isOffline } = action.payload;
        state.items[jobId] = costs;
        state.lastFetched[jobId] = Date.now();
        state.isOffline = isOffline;
      })
      .addCase(fetchCosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load";
      });
  },
});

export const { resetCosts, resetCostsForJob, setOfflineMode } =
  costSlice.actions;

// Basic selectors
export const selectCostsItems = (state: RootState) => state.cost.items;
export const selectCostsLoading = (state: RootState) => state.cost.loading;
export const selectCostsError = (state: RootState) => state.cost.error;
export const selectIsOffline = (state: RootState) => state.cost.isOffline;

// Memoized selector for contractors by job
export const selectCostsForJob = createSelector(
  [selectCostsItems, (_, jobId: string) => jobId],
  (items, jobId) => {
    // Get contractors array for the job
    const costsForJob = items[jobId] || [];
    return costsForJob;
  }
);

export default costSlice.reducer;
