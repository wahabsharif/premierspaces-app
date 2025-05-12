import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";
import { getCache, isOnline, setCache } from "../services/cacheService";
import type { RootState, AppDispatch } from "./index";

export interface Costs {
  name: string;
  amount: string;
  id?: string;
  job_id?: string;
  contractor_id?: string | null;
  payment_status?: string;
  payment_date?: string;
  material_cost?: string;
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

const COSTS_CACHE_EXPIRY = 5 * 60 * 1000;

// FETCH COSTS
export const fetchCosts = createAsyncThunk<
  { jobId: string; costs: Costs[]; isOffline: boolean },
  { userId: string; jobId: string },
  {
    state: RootState;
    dispatch: AppDispatch;
    rejectValue: string;
  }
>("costs/fetch", async ({ userId, jobId }, { getState, rejectWithValue }) => {
  const { lastFetched, items } = getState().cost;
  const isFresh =
    lastFetched[jobId] && Date.now() - lastFetched[jobId] < COSTS_CACHE_EXPIRY;

  if (isFresh && items[jobId]) {
    const online = await isOnline();
    return { jobId, costs: items[jobId], isOffline: !online };
  }

  const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`;
  const online = await isOnline();

  if (online) {
    try {
      const { data } = await axios.get(`${BASE_API_URL}/costs.php`, {
        params: { userid: userId, job_id: jobId },
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
    } catch (err) {
      console.warn("fetchCosts network error, falling back to cache", err);
    }
  }

  // Offline or fallback
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

  if (!online) {
    return { jobId, costs: [], isOffline: true };
  }

  return rejectWithValue("Unable to load costs data.");
});

// CREATE COST
export const createCost = createAsyncThunk<
  void,
  {
    userId: string;
    jobId: string;
    name: string;
    amount: string;
    materialCost?: string;
    contractorId?: string;
  },
  {
    state: RootState;
    dispatch: AppDispatch;
    rejectValue: string;
  }
>(
  "costs/create",
  async (
    { userId, jobId, name, amount, materialCost, contractorId },
    { dispatch, rejectWithValue }
  ) => {
    const payload: any = {
      user_id: userId,
      job_id: jobId,
      name: name.substring(0, 50),
      amount: parseFloat(amount).toFixed(2),
      contractor_id:
        contractorId && contractorId !== "" ? parseInt(contractorId, 10) : null,
    };
    if (materialCost) {
      payload.material_cost = parseFloat(materialCost).toFixed(2);
    }

    try {
      const response = await axios.post(`${BASE_API_URL}/costs.php`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      const { status, payload: resp } = response.data;

      if (status !== 1) {
        return rejectWithValue(resp?.error || "Create failed");
      }

      // Re-fetch to update list
      await dispatch(fetchCosts({ userId, jobId }));
    } catch (err: any) {
      return rejectWithValue(err.message || "Network error");
    }
  }
);

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

// Selectors
export const selectCostState = (state: RootState) => state.cost;
export const selectCostsForJob = (state: RootState, jobId: string): Costs[] =>
  state.cost.items[jobId] ?? [];

export default costSlice.reducer;
