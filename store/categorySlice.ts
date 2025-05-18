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
  sub_categories: SubCategory[];
}

interface CategoryState {
  data: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoryState = {
  data: [],
  loading: false,
  error: null,
};

/**
 * Thunk: Loads categories
 * - Short-circuit if already loaded
 * - If online: fetch from API, cache to SQLite via cacheService
 * - If offline or fetch fails: load from SQLite cache
 */
export const loadCategories = createAsyncThunk<
  Category[],
  void,
  { rejectValue: string; state: { categories: CategoryState } }
>("categories/load", async (_, { getState, rejectWithValue }) => {
  const { data, loading } = getState().categories;
  if (!loading && data.length > 0) {
    // Already have data — skip network call
    return data;
  }

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
      // Online: fetch from server
      const resp = await axios.get<{ status: number; payload: Category[] }>(
        `${BASE_API_URL}/fileuploadcats.php?userid=${userId}`
      );
      if (resp.data.status !== 1) {
        throw new Error("Server returned error status");
      }
      await setCache(cacheKey, resp.data.payload);
      return resp.data.payload;
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
});

const categorySlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    setCategories: (state, action: PayloadAction<Category[]>) => {
      state.data = action.payload;
      state.loading = false;
      state.error = null;
    },
    clearCategoryCache: (state) => {
      state.data = [];
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

export default categorySlice.reducer;
