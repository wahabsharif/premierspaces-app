import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";
import {
  getCache,
  isOnline,
  refreshCachesAfterPost,
} from "../services/cacheService";
import { createLocalCost, getAllCosts } from "../services/costService";
import { Costs } from "../types";
import type { AppDispatch, RootState } from "./index";

export interface CostState {
  items: Record<string, Costs[]>;
  loading: boolean;
  error: string | null;
  lastFetched: Record<string, number>;
  isOffline: boolean;
  fetchInProgress: Record<string, boolean>; // Track in-progress fetches per job
}

const initialState: CostState = {
  items: {},
  loading: false,
  error: null,
  lastFetched: {},
  isOffline: false,
  fetchInProgress: {},
};

// Configure minimum time between fetches for the same job (30 seconds)
const MIN_FETCH_INTERVAL = 30000;

// Only modify the fetchCosts function in costSlice.ts
export const fetchCosts = createAsyncThunk<
  { jobId: string; costs: Costs[]; isOffline: boolean },
  { userId: string; jobId: string; common_id: string; forceRefresh?: boolean },
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>(
  "costs/fetch",
  async (
    { userId, jobId, common_id, forceRefresh = false },
    { getState, rejectWithValue, dispatch }
  ) => {
    const { items, lastFetched, fetchInProgress } = getState().cost;
    const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;

    // ADDED: Create a unique key for this job/common_id combination
    const fetchKey = `${jobId}_${common_id}`;

    // ADDED: Prevent concurrent fetches for the same job
    if (fetchInProgress[fetchKey]) {
      // Return existing data if available, or an empty array
      return {
        jobId,
        costs: items[jobId] || [],
        isOffline: getState().cost.isOffline,
      };
    }

    // Check if we've fetched this job's costs recently (within MIN_FETCH_INTERVAL)
    const now = Date.now();
    const lastFetchTime = lastFetched[jobId] || 0;
    const timeSinceLastFetch = now - lastFetchTime;

    // Only refresh from network if forced or enough time has passed
    const shouldRefreshFromNetwork =
      forceRefresh || timeSinceLastFetch > MIN_FETCH_INTERVAL;

    // If we have data and shouldn't refresh, return immediately
    if (items[jobId] && items[jobId].length > 0 && !shouldRefreshFromNetwork) {
      return {
        jobId,
        costs: items[jobId],
        isOffline: getState().cost.isOffline,
      };
    }

    // Mark fetch as in progress for this job
    dispatch(setFetchInProgress({ key: fetchKey, value: true }));

    try {
      // Check online status first
      const online = await isOnline();
      dispatch(setOfflineMode(!online));

      // Get local SQLite costs first (these are costs created while offline)
      let localCosts: Costs[] = [];
      try {
        const allLocalCosts = await getAllCosts();
        // Filter costs for this job based on both job_id and common_id
        localCosts = allLocalCosts.filter(
          (cost) =>
            String(cost.job_id) === String(jobId) ||
            String(cost.common_id) === String(common_id)
        );
      } catch (err) {
        console.error("[fetchCosts] Error getting local costs:", err);
      }

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
          const filtered = payloadArray.filter((c) => {
            // Use primarily common_id for matching, as it's the shared identifier
            return String(c.common_id) === String(common_id);
          });

          // Combine API costs with local costs, avoiding duplicates
          const combinedCosts = [...filtered];

          // Add local costs that aren't in the API response
          localCosts.forEach((localCost) => {
            // Check if this local cost already exists in the API response
            const exists = combinedCosts.some(
              (apiCost) =>
                apiCost.id === localCost.id ||
                (apiCost.contractor_id === localCost.contractor_id &&
                  apiCost.amount === localCost.amount &&
                  apiCost.material_cost === localCost.material_cost)
            );

            if (!exists) {
              combinedCosts.push(localCost);
            }
          });

          return { jobId, costs: combinedCosts, isOffline: false };
        } catch (error) {
          console.error("[fetchCosts] API error, falling back to cache", error);
          // Fall back to cache on API error
        }
      } else if (online) {
        console.log(`[fetchCosts] Using cached data (recently fetched)`);
      } else {
        console.log(`[fetchCosts] Offline mode, using cached data`);
      }

      // Use existing data in memory if available and combine with local costs
      if (items[jobId] && items[jobId].length > 0) {
        const cachedCosts = items[jobId];
        const combinedCosts = [...cachedCosts];

        // Add local costs that aren't in the cached costs
        localCosts.forEach((localCost) => {
          const exists = combinedCosts.some(
            (cachedCost) =>
              cachedCost.id === localCost.id ||
              (cachedCost.contractor_id === localCost.contractor_id &&
                cachedCost.amount === localCost.amount &&
                cachedCost.material_cost === localCost.material_cost)
          );

          if (!exists) {
            combinedCosts.push(localCost);
          }
        });

        return { jobId, costs: combinedCosts, isOffline: !online };
      }

      // Offline mode or API error fallback - use cache + local costs
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
          return matchesJob || matchesCommonId; // Changed to OR to be more inclusive
        });

        // Combine cached costs with local costs
        const combinedCosts = [...filtered];

        // Add local costs that aren't in the cached costs
        localCosts.forEach((localCost) => {
          const exists = combinedCosts.some(
            (cachedCost) =>
              cachedCost.id === localCost.id ||
              (cachedCost.contractor_id === localCost.contractor_id &&
                cachedCost.amount === localCost.amount &&
                cachedCost.material_cost === localCost.material_cost)
          );

          if (!exists) {
            combinedCosts.push(localCost);
          }
        });

        return { jobId, costs: combinedCosts, isOffline: !online };
      } catch (error) {
        console.error("[fetchCosts] cache fallback error", error);
      }

      // If all else fails, just return local costs (which could be empty)
      return { jobId, costs: localCosts, isOffline: true };
    } finally {
      // Always clear the in-progress flag when done
      dispatch(setFetchInProgress({ key: fetchKey, value: false }));
    }
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

      // After successful API call, refresh both caches from the server
      await refreshCachesAfterPost(userId);

      // Reset cost state for this job
      if (jobId) {
        dispatch(resetCostsForJob(jobId));
      }
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
      state.fetchInProgress = {};
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
    // Add a new reducer to track in-progress fetches
    setFetchInProgress: (state, action) => {
      const { key, value } = action.payload;
      state.fetchInProgress[key] = value;
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

export const {
  resetCosts,
  resetCostsForJob,
  setOfflineMode,
  setFetchInProgress,
} = costSlice.actions;

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
