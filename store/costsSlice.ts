import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import axios from "axios";
import { Toast } from "toastify-react-native";
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
    const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;

    // Track fetch request in progress
    dispatch(setFetchInProgress({ key: jobId, value: true }));

    try {
      // Check if online
      const online = await isOnline();
      dispatch(setOfflineMode(!online));

      // SCENARIO 1: ONLINE MODE - Get data from API
      if (online) {
        try {
          const params: any = {
            userid: userId,
            job_id: jobId,
            // Add cache-busting parameter when force refresh is requested
            _cb: forceRefresh ? Date.now() : undefined,
          };
          if (common_id) params.common_id = common_id;

          const { data } = await axios.get(`${BASE_API_URL}/costs.php`, {
            params,
            headers: {
              "Content-Type": "application/json",
              // Add cache control headers for force refresh
              ...(forceRefresh
                ? {
                    "Cache-Control": "no-cache, no-store",
                    Pragma: "no-cache",
                  }
                : {}),
            },
            timeout: 10000,
          });

          let apiCosts: Costs[] = [];
          if (data.status === 1 && data.payload) {
            const payloadArray = Array.isArray(data.payload)
              ? data.payload
              : data.payload.payload && Array.isArray(data.payload.payload)
              ? data.payload.payload
              : typeof data.payload === "object"
              ? [data.payload]
              : [];

            // Define interface for the API cost payload items
            interface ApiCostPayload {
              job_id: string | number;
              common_id?: string | number;
            }

            apiCosts = payloadArray.filter((c: ApiCostPayload) => {
              const matchesJob = String(c.job_id) === String(jobId);
              const matchesCommonId =
                common_id && String(c.common_id) === String(common_id);
              return matchesJob || matchesCommonId;
            });
          }

          return { jobId, costs: apiCosts, isOffline: false };
        } catch (error) {
          Toast.error(
            `[fetchCosts] API error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          throw error;
        }
      }

      // SCENARIO 2: OFFLINE MODE - Combine cache and local database
      else {
        // Step 1: Get costs from local SQLite database
        let localCosts: Costs[] = [];
        try {
          const allLocalCosts = await getAllCosts();
          localCosts = allLocalCosts.filter((cost) => {
            const matchesJobId =
              jobId && cost.job_id && String(cost.job_id) === String(jobId);
            const matchesCommonId =
              common_id &&
              cost.common_id &&
              String(cost.common_id) === String(common_id);
            return matchesJobId || matchesCommonId;
          });
        } catch (err) {
          Toast.error(
            `[fetchCosts] Error getting local costs: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }

        // Step 2: Get costs from cache (unchanged)
        let cachedCosts: Costs[] = [];
        try {
          const cacheEntry = await getCache(cacheKey);
          if (cacheEntry?.payload) {
            const archived = Array.isArray(cacheEntry.payload)
              ? cacheEntry.payload
              : cacheEntry.payload.payload &&
                Array.isArray(cacheEntry.payload.payload)
              ? cacheEntry.payload.payload
              : typeof cacheEntry.payload === "object"
              ? [cacheEntry.payload]
              : [];
            cachedCosts = archived.filter((c: Costs | null) => {
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
          Toast.error(
            `[fetchCosts] Cache retrieval error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }

        // Step 3: Combine cached and local costs (unchanged)
        const combinedCosts: Costs[] = [...cachedCosts];
        localCosts.forEach((localCost) => {
          const exists = combinedCosts.some(
            (cachedCost) =>
              cachedCost.id === localCost.id ||
              (cachedCost.contractor_id === localCost.contractor_id &&
                cachedCost.amount === localCost.amount &&
                cachedCost.material_cost === localCost.material_cost)
          );
          if (!exists) combinedCosts.push(localCost);
        });

        return {
          jobId,
          costs: combinedCosts,
          isOffline: true,
        };
      }
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      dispatch(setFetchInProgress({ key: jobId, value: false }));
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

        // Important: Always reset costs for this job to ensure fresh data
        if (jobId) {
          dispatch(resetCostsForJob(jobId));

          // Immediately fetch fresh costs after creating a new one
          await dispatch(
            fetchCosts({
              userId,
              jobId,
              common_id,
              forceRefresh: true,
            })
          );
        }
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

      // Reset cost state for this job and immediately fetch fresh data
      if (jobId) {
        dispatch(resetCostsForJob(jobId));

        // Fetch fresh costs data immediately
        await dispatch(
          fetchCosts({
            userId,
            jobId,
            common_id,
            forceRefresh: true,
          })
        );
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
