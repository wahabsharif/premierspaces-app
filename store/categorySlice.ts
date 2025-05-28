import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_API_URL } from "../Constants/env";
import { deleteCache, getCache, setCache } from "../services/cacheService";
import { Toast } from "toastify-react-native";

export interface SubCategory {
  id: number;
  sub_category: string;
}

export interface Category {
  id: number;
  category: string;
  icon_url?: string;
  sub_categories: SubCategory[];
}

interface CategoryState {
  data: Category[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: CategoryState = {
  data: [],
  loading: false,
  error: null,
  lastFetched: null,
};

// Track in-flight requests to prevent duplicate API calls
let fetchInProgress: Promise<Category[]> | null = null;
// Minimum time between API calls (5 minutes)
const CACHE_FRESHNESS_DURATION = 5 * 60 * 1000;

/**
 * Thunk: Loads categories
 * - Short-circuit if already loaded and cache is fresh
 * - Deduplicate concurrent requests
 * - If online: fetch from API, cache to SQLite via cacheService
 * - If offline or fetch fails: load from SQLite cache
 */
export const loadCategories = createAsyncThunk<
  Category[],
  void,
  { rejectValue: string; state: { categories: CategoryState } }
>("categories/load", async (_, { getState, rejectWithValue }) => {
  const { data, loading, lastFetched } = getState().categories;
  const now = Date.now();

  // Short-circuit if we have fresh data (within 5 minutes)
  const isFresh = lastFetched && now - lastFetched < CACHE_FRESHNESS_DURATION;
  if (!loading && data.length > 0 && isFresh) {
    return data;
  }

  // Request deduplication - if a request is already in progress, return its result
  if (fetchInProgress) {
    try {
      return await fetchInProgress;
    } catch (err: any) {
      // If the in-flight request fails, we'll try again (don't return here)
      console.warn("In-flight categories request failed:", err.message);
    }
  }

  // Create a new request promise that will be used for deduplication
  const fetchPromise = (async () => {
    try {
      const net = await NetInfo.fetch();

      const userJson = await AsyncStorage.getItem("userData");
      const user = userJson ? JSON.parse(userJson) : null;
      const userId = user?.payload?.userid || user?.userid;
      if (!userId) {
        return rejectWithValue("User ID missing");
      }
      const cacheKey = `categoryCache_${userId}`;

      if (net.isConnected) {
        // Online: fetch from server with timeout and retry
        try {
          const resp = await axios.get<{
            status: number;
            payload: Category[];
          }>(`${BASE_API_URL}/fileuploadcats.php?userid=${userId}`, {
            timeout: 10000,
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          });

          if (resp.data.status !== 1) {
            throw new Error("Server returned error status");
          }

          // Optimize: Only store in cache if data actually changed
          const currentCache = await getCache(cacheKey);
          const currentData = currentCache?.payload;

          // Only update cache if data changed (prevents unnecessary writes)
          if (
            !currentData ||
            JSON.stringify(currentData) !== JSON.stringify(resp.data.payload)
          ) {
            await setCache(cacheKey, resp.data.payload);
          }

          return resp.data.payload;
        } catch (apiError: any) {
          // API error - try cache as fallback
          Toast.info("Using cached categories - API request failed");
          const cached = await getCache(cacheKey);

          if (cached?.payload) {
            if (Array.isArray(cached.payload)) {
              return cached.payload;
            } else if (
              cached.payload.payload &&
              Array.isArray(cached.payload.payload)
            ) {
              return cached.payload.payload;
            }
          }
          throw apiError; // Re-throw if no valid cache
        }
      } else {
        // Offline: load from cache
        const cached = await getCache(cacheKey);
        if (cached?.payload) {
          if (Array.isArray(cached.payload)) {
            return cached.payload;
          } else if (
            cached.payload.payload &&
            Array.isArray(cached.payload.payload)
          ) {
            return cached.payload.payload;
          }
        }
        throw new Error("No internet and no cached data");
      }
    } catch (err: any) {
      // Fallback to cache on any error
      try {
        const userJson = await AsyncStorage.getItem("userData");
        const user = userJson ? JSON.parse(userJson) : null;
        const userId = user?.payload?.userid || user?.userid;
        if (!userId) {
          return rejectWithValue("User ID missing from storage");
        }
        const cacheKey = `categoryCache_${userId}`;
        const cached = await getCache(cacheKey);
        if (cached?.payload) {
          if (Array.isArray(cached.payload)) {
            return cached.payload;
          } else if (
            cached.payload.payload &&
            Array.isArray(cached.payload.payload)
          ) {
            return cached.payload.payload;
          }
        }
        return rejectWithValue("No valid cached category data found");
      } catch (cacheErr: any) {
        Toast.error("Cache retrieval error:", cacheErr);
        return rejectWithValue(err.message || "Failed to load categories");
      }
    }
  })();

  // Store the promise for deduplication
  fetchInProgress = fetchPromise;

  try {
    // Wait for the request to complete
    const result = await fetchPromise;
    return result;
  } catch (err) {
    throw err;
  } finally {
    // Clear the in-flight request reference
    if (fetchInProgress === fetchPromise) {
      fetchInProgress = null;
    }
  }
});

const categorySlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    setCategories: (state, action: PayloadAction<Category[]>) => {
      state.data = action.payload;
      state.loading = false;
      state.error = null;
      state.lastFetched = Date.now();
    },
    clearCategoryCache: (state) => {
      state.data = [];
      state.lastFetched = null;
      AsyncStorage.getItem("userData")
        .then((userJson) => {
          if (userJson) {
            const user = JSON.parse(userJson);
            const userId = user?.payload?.userid;
            if (userId) {
              const cacheKey = `categoryCache_${userId}`;
              return deleteCache(cacheKey);
            }
          }
          return null;
        })
        .catch(() => {
          // ignore
        });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        loadCategories.fulfilled,
        (state, action: PayloadAction<Category[]>) => {
          state.loading = false;
          state.data = action.payload;
          state.lastFetched = Date.now();
        }
      )
      .addCase(loadCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unknown error";
      });
  },
});

export const { setCategories, clearCategoryCache } = categorySlice.actions;

export const selectCategories = (state: { categories: CategoryState }) =>
  state.categories.data;
export const selectCategoryLoading = (state: { categories: CategoryState }) =>
  state.categories.loading;
export const selectCategoryError = (state: { categories: CategoryState }) =>
  state.categories.error;
export const selectCategoriesLastFetched = (state: {
  categories: CategoryState;
}) => state.categories.lastFetched;

export default categorySlice.reducer;
