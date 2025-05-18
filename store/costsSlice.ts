import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";
import { getCache, isOnline } from "../services/cacheService";
import { createLocalCost } from "../services/costService";
import { Costs } from "../types";
import type { AppDispatch, RootState } from "./index";

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

// Never expire the cost cache - we'll control refreshing explicitly
const COSTS_NEVER_EXPIRE = 0;

// Only modify the fetchCosts function in costSlice.ts
export const fetchCosts = createAsyncThunk<
  { jobId: string; costs: Costs[]; isOffline: boolean },
  { userId: string; jobId: string; common_id: string },
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>(
  "costs/fetch",
  async (
    { userId, jobId, common_id },
    { getState, rejectWithValue, dispatch }
  ) => {
    const { items, lastFetched } = getState().cost;
    const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;

    // Check if we've fetched this job's costs recently (within the last 30 seconds)
    // This helps prevent excessive API calls
    const now = Date.now();
    const lastFetchTime = lastFetched[jobId] || 0;
    const shouldRefreshFromNetwork = now - lastFetchTime > 30000;

    // Check online status first
    const online = await isOnline();
    dispatch(setOfflineMode(!online));

    // If online and we need to refresh, fetch from API
    if (online && shouldRefreshFromNetwork) {
      try {
        const { data } = await axios.get(`${BASE_API_URL}/costs.php`, {
          params: { userid: userId, common_id },
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        });

        let payloadArray: any[] = [];
        if (data.status === 1 && data.payload) {
          // Handle different payload structures from API
          if (Array.isArray(data.payload)) {
            payloadArray = data.payload;
          } else if (
            data.payload.payload &&
            Array.isArray(data.payload.payload)
          ) {
            payloadArray = data.payload.payload;
          } else if (typeof data.payload === "object") {
            payloadArray = [data.payload];
          }
        }

        // More flexible filtering logic - job_id could be string or number
        // Replace the existing filtering logic with this:
        const filtered = payloadArray.filter((c) => {
          // Use primarily common_id for matching, as it's the shared identifier
          return String(c.common_id) === String(common_id);

          // Alternatively, use an OR condition
          // return String(c.job_id) === String(jobId) || String(c.common_id) === String(common_id);
        });

        return { jobId, costs: filtered, isOffline: false };
      } catch (error) {
        console.error("[fetchCosts] API error, falling back to cache", error);
        // Fall back to cache on API error
      }
    } else if (online) {
      console.log(`[fetchCosts] Using cached data (recently fetched)`);
    } else {
      console.log(`[fetchCosts] Offline mode, using cached data`);
    }

    // Use existing data in memory if available
    if (items[jobId] && items[jobId].length > 0) {
      return { jobId, costs: items[jobId], isOffline: !online };
    }

    // Offline mode or API error fallback - use cache
    try {
      const cacheEntry = await getCache(cacheKey);
      let archived: any[] = [];

      if (cacheEntry?.payload) {
        if (Array.isArray(cacheEntry.payload)) {
          archived = cacheEntry.payload;
        } else if (
          cacheEntry.payload.payload &&
          Array.isArray(cacheEntry.payload.payload)
        ) {
          archived = cacheEntry.payload.payload;
        }
      }

      // More flexible filtering logic
      const filtered = archived.filter((c) => {
        const matchesJob = String(c.job_id) === String(jobId);
        const matchesCommonId = String(c.common_id) === String(common_id);
        return matchesJob && matchesCommonId;
      });
      return { jobId, costs: filtered, isOffline: !online };
    } catch (error) {
      console.error("[fetchCosts] cache fallback error", error);
    }

    if (online) {
      return rejectWithValue("Unable to load costs data.");
    }
    return { jobId, costs: [], isOffline: true };
  }
);
export const createCost = createAsyncThunk<
  void,
  {
    userId: string;
    jobId?: string;
    common_id: string;
    amount: string;
    materialCost?: string;
    contractorId?: string;
  },
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>(
  "costs/create",
  async (
    { userId, jobId, amount, materialCost, common_id, contractorId },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const online = await isOnline();
      dispatch(setOfflineMode(!online));

      if (!online) {
        // Offline mode - create cost locally
        const newCost = await createLocalCost({
          job_id: "",
          common_id: common_id,
          contractor_id: contractorId || null,
          amount: parseFloat(amount || "0").toFixed(2),
          material_cost:
            materialCost !== undefined
              ? parseFloat(materialCost || "0").toFixed(2)
              : null,
        });

        if (jobId) {
          dispatch(resetCostsForJob(jobId));
        }

        await dispatch(fetchCosts({ userId, jobId: jobId || "", common_id }));
        return;
      }

      // Online mode - send to API
      const payload = {
        userid: userId,
        job_id: jobId || null,
        common_id,
        amount: amount,
        material_cost: materialCost,
        contractor_id: contractorId,
      };
      const { data } = await axios.post(`${BASE_API_URL}/costs.php`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      if (data.status !== 1) {
        const errorMsg =
          data.payload?.error ||
          data.message ||
          "Failed to create cost on server";
        throw new Error(errorMsg);
      }

      // After successful API call, refresh costs cache from the server
      if (jobId) {
        dispatch(resetCostsForJob(jobId));
      }

      // This will get the latest data from the API and update the cache
      await dispatch(fetchCosts({ userId, jobId: jobId || "", common_id }));
    } catch (err: any) {
      console.error("[createCost] error", err);
      return rejectWithValue(err.message || "Error creating cost");
    }
  }
);

const costSlice = createSlice({
  name: "cost",
  initialState,
  reducers: {
    resetCosts: (state) => {
      state.items = {};
      state.lastFetched = {};
      state.loading = false;
      state.error = null;
      state.isOffline = false;
    },
    resetCostsForJob: (state, action) => {
      const jobId = action.payload;
      if (jobId) {
        delete state.items[jobId];
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
      .addCase(fetchCosts.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.items[payload.jobId] = payload.costs;
        state.lastFetched[payload.jobId] = Date.now();
        state.isOffline = payload.isOffline;
      })
      .addCase(fetchCosts.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload || "Failed to load costs";
      })
      .addCase(createCost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCost.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(createCost.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload || "Failed to create cost";
      });
  },
});

export const { resetCosts, resetCostsForJob, setOfflineMode } =
  costSlice.actions;

const selectCostItems = (state: RootState) => state.cost.items;
const selectAllContractors = (state: RootState) => state.contractors.data;

export const selectCostsForJobWithNames = createSelector(
  [
    selectCostItems,
    (_: RootState, jobId: string) => jobId,
    selectAllContractors,
  ],
  (items, jobId, contractors) => {
    const raw = items[jobId] ?? [];
    return raw.map((c) => ({
      ...c,
      name:
        contractors.find((ct) => String(ct.id) === String(c.contractor_id))
          ?.name ?? "(No contractor)",
    }));
  }
);

export const selectCostsForJob = createSelector(
  [selectCostItems, (_: RootState, jobId: string) => jobId],
  (items, jobId) => items[jobId] ?? []
);

export default costSlice.reducer;
