import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";
import { getCache, isOnline, setCache } from "../services/cacheService";
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

const COSTS_CACHE_EXPIRY = 5 * 60 * 1000;

export const fetchCosts = createAsyncThunk<
  { jobId: string; costs: Costs[]; isOffline: boolean },
  { userId: string; jobId: string },
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>(
  "costs/fetch",
  async ({ userId, jobId }, { getState, rejectWithValue, dispatch }) => {
    const { lastFetched, items } = getState().cost;
    const now = Date.now();
    const fresh =
      lastFetched[jobId] && now - lastFetched[jobId] < COSTS_CACHE_EXPIRY;

    if (fresh && items[jobId]) {
      const online = await isOnline();
      dispatch(setOfflineMode(!online));
      return {
        jobId,
        costs: items[jobId],
        isOffline: !online,
      };
    }

    const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;
    const online = await isOnline();
    dispatch(setOfflineMode(!online));

    if (online) {
      try {
        const { data } = await axios.get(`${BASE_API_URL}/costs.php`, {
          params: { userid: userId },
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        });

        let payloadArray: any[] = [];
        if (data.status === 1 && data.payload) {
          payloadArray = Array.isArray(data.payload)
            ? data.payload
            : Array.isArray(data.payload.payload)
            ? data.payload.payload
            : [data.payload];
        }

        await setCache(cacheKey, payloadArray);
        const filtered = payloadArray.filter((c) => c.job_id === jobId);

        return { jobId, costs: filtered, isOffline: false };
      } catch {
        // fallback to cache
      }
    }

    try {
      const cacheEntry = await getCache(cacheKey);
      const archived =
        cacheEntry && Array.isArray(cacheEntry.payload)
          ? cacheEntry.payload
          : cacheEntry?.payload?.payload || [];
      const filtered = (archived as Costs[]).filter((c) => c.job_id === jobId);
      return { jobId, costs: filtered, isOffline: !online };
    } catch {
      // no cache
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
    jobId: string;
    amount: string;
    materialCost?: string;
    contractorId?: string;
  },
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>(
  "costs/create",
  async (
    { userId, jobId, amount, materialCost, contractorId },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const online = await isOnline();
      dispatch(setOfflineMode(!online));

      if (!online) {
        const newCost = await createLocalCost({
          job_id: jobId,
          contractor_id: contractorId || null,
          amount: parseFloat(amount || "0").toFixed(2),
          material_cost:
            materialCost !== undefined
              ? parseFloat(materialCost || "0").toFixed(2)
              : null,
        });

        const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;
        try {
          const cacheEntry = await getCache(cacheKey);
          const existing: any[] =
            cacheEntry && Array.isArray(cacheEntry.payload)
              ? cacheEntry.payload
              : cacheEntry?.payload?.payload || [];

          const idx = existing.findIndex(
            (c) =>
              c.job_id === jobId && c.contractor_id === (contractorId || null)
          );
          if (idx >= 0) existing[idx] = newCost;
          else existing.push(newCost);

          await setCache(cacheKey, existing);
        } catch {
          // ignore cache write errors
        }

        await dispatch(fetchCosts({ userId, jobId }));
      } else {
        // online create logic goes here
      }
    } catch (err: any) {
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
      delete state.items[action.payload];
      delete state.lastFetched[action.payload];
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
        contractors.find((ct) => ct.id === c.contractor_id)?.name ??
        "(No contractor)",
    }));
  }
);
export const selectCostsForJob = createSelector(
  [selectCostItems, (_: RootState, jobId: string) => jobId],
  (items, jobId) => items[jobId] ?? []
);

export default costSlice.reducer;
