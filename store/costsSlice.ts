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
import { Toast } from "toastify-react-native";

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
  { userId: string; jobId: string; common_id?: string; forceRefresh?: boolean },
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>(
  "costs/fetch",
  async (
    { userId, jobId, common_id, forceRefresh = false },
    { getState, rejectWithValue, dispatch }
  ) => {
    const { items, lastFetched, fetchInProgress } = getState().cost;
    const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;

    // Generate a unique fetch key based on what we have
    const fetchKey = common_id ? `${jobId}_${common_id}` : `${jobId}`;

    // Prevent concurrent fetches for the same job
    if (fetchInProgress[fetchKey]) {
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

      // STEP 1: Always get local SQLite costs (these are costs created while offline)
      let localCosts: Costs[] = [];
      try {
        const allLocalCosts = await getAllCosts();

        // Filter costs for this job based on both job_id and common_id (if available)
        localCosts = allLocalCosts.filter((cost) => {
          // Match by job_id if it exists and matches
          const matchesJobId =
            cost.job_id && String(cost.job_id) === String(jobId);

          // Match by common_id if it exists and matches
          const matchesCommonId =
            common_id &&
            cost.common_id &&
            String(cost.common_id) === String(common_id);

          // Return true if either condition is met
          return matchesJobId || matchesCommonId;
        });
      } catch (err) {
        Toast.error(
          `[fetchCosts] Error getting local costs: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }

      // STEP 2: If online and we need to refresh, fetch from API
      let apiCosts: Costs[] = [];
      if (online && shouldRefreshFromNetwork) {
        try {
          // Build API parameters based on what we have
          const params: any = { userid: userId };

          // Always include job_id
          params.job_id = jobId;

          // Also include common_id if it exists
          if (common_id) {
            params.common_id = common_id;
          }

          const { data } = await axios.get(`${BASE_API_URL}/costs.php`, {
            params,
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

          // More flexible filtering logic - match by job_id or common_id
          apiCosts = payloadArray.filter((c) => {
            // Match by job_id
            const matchesJob = String(c.job_id) === String(jobId);

            // Match by common_id if it exists
            const matchesCommonId =
              common_id && String(c.common_id) === String(common_id);

            return matchesJob || matchesCommonId;
          });

          // API fetch was successful, combine with local costs and return
          const combinedCosts = [...apiCosts];

          // Add local costs that aren't in the API response
          if (localCosts.length > 0) {
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
          }

          return { jobId, costs: combinedCosts, isOffline: false };
        } catch (error) {
          Toast.error(
            `[fetchCosts] API error, falling back to cache: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          // Fall back to cache on API error
        }
      }

      // STEP 3: OFFLINE MODE or API ERROR - Get cached costs from redux store first
      let cachedCosts: Costs[] = [];

      if (items[jobId] && items[jobId].length > 0) {
        cachedCosts = [...items[jobId]];
      } else {
        // STEP 4: If not in redux store, try to get from cache service
        try {
          const cacheEntry = await getCache(cacheKey);

          if (cacheEntry?.payload) {
            let archived: any[] = [];

            if (Array.isArray(cacheEntry.payload)) {
              archived = cacheEntry.payload;
            } else if (
              cacheEntry.payload.payload &&
              Array.isArray(cacheEntry.payload.payload)
            ) {
              archived = cacheEntry.payload.payload;
            } else if (typeof cacheEntry.payload === "object") {
              // Handle case where payload is a single object
              archived = [cacheEntry.payload];
            }

            // Filter by job_id or common_id
            cachedCosts = archived.filter((c) => {
              if (!c) return false;

              const matchesJob = c.job_id && String(c.job_id) === String(jobId);
              const matchesCommonId =
                common_id &&
                c.common_id &&
                String(c.common_id) === String(common_id);
              return matchesJob || matchesCommonId;
            });
          }
        } catch (error) {
          // Critical cache error
        }
      }

      // STEP 5: Now combine cached costs with local costs - CRITICAL PART
      // Start with all cached costs
      const allCosts: Costs[] = [...cachedCosts];

      // Add local costs one by one to ensure proper merging
      let addedCount = 0;
      let updatedCount = 0;

      for (const localCost of localCosts) {
        // Check if we already have this exact cost by ID
        const existingIdIndex = allCosts.findIndex(
          (c) => c.id === localCost.id
        );

        if (existingIdIndex >= 0) {
          // Replace with local version
          allCosts[existingIdIndex] = localCost;
          updatedCount++;
          continue;
        }

        // Check for similar costs (same contractor, amount, etc.)
        const similarIndex = allCosts.findIndex((c) => {
          if (!c || !localCost) return false;

          const sameContractor = c.contractor_id === localCost.contractor_id;

          // Handle amount comparison safely
          let sameAmount = false;
          try {
            const cAmount = parseFloat(String(c.amount || "0"));
            const localAmount = parseFloat(String(localCost.amount || "0"));
            sameAmount = Math.abs(cAmount - localAmount) < 0.01; // Allow tiny rounding differences
          } catch (e) {
            sameAmount = false;
          }

          // Handle material cost comparison
          const sameMaterialCost =
            c.material_cost === localCost.material_cost ||
            (c.material_cost === null && !localCost.material_cost) ||
            (!c.material_cost && localCost.material_cost === null);

          return sameContractor && sameAmount && sameMaterialCost;
        });

        if (similarIndex >= 0) {
          // Replace with local version
          allCosts[similarIndex] = localCost;
          updatedCount++;
        } else {
          // Add as new cost
          allCosts.push(localCost);
          addedCount++;
        }
      }

      // Return the combined results
      return {
        jobId,
        costs: allCosts,
        isOffline: !online,
      };
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
    common_id?: string;
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

      // Format materialCost as an integer if provided
      const formattedMaterialCost =
        materialCost !== undefined
          ? String(Math.round(parseFloat(materialCost || "0")))
          : undefined;

      if (!online) {
        const newCost = await createLocalCost({
          job_id: null,
          common_id: common_id || undefined,
          contractor_id: contractorId || undefined,
          amount: parseFloat(amount || "0").toFixed(2),
          material_cost:
            formattedMaterialCost !== undefined
              ? parseInt(formattedMaterialCost)
              : undefined,
        });

        if (jobId) {
          dispatch(resetCostsForJob(jobId));
        }

        await dispatch(fetchCosts({ userId, jobId: jobId || "", common_id }));
        return;
      }

      // Online mode - send to API
      const payload: any = {
        userid: userId,
        amount: amount,
        material_cost: formattedMaterialCost, // Now using the integer formatted value
        contractor_id: contractorId,
      };

      // Add either job_id or common_id or both as available
      if (jobId) {
        payload.job_id = jobId;
      }

      if (common_id) {
        payload.common_id = common_id;
      }

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

      // After successful API call, refresh caches with the enhanced function
      await refreshCachesAfterPost(userId);

      // Reset cost state for this job
      if (jobId) {
        dispatch(resetCostsForJob(jobId));
      }
    } catch (err: any) {
      Toast.error("[createCost] error", err);
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
