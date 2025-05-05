// store/categorySlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import { baseApiUrl } from "../Constants/env";

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

const CACHE_KEY = "categoriesCache";

const initialState: CategoryState = {
  data: [],
  loading: false,
  error: null,
};

/**
 * Thunk: Loads categories
 * - If online: fetch from API, cache to AsyncStorage
 * - If offline or fetch fails: load from cache
 */
export const loadCategories = createAsyncThunk<
  Category[],
  void,
  { rejectValue: string }
>("categories/load", async (_, { rejectWithValue }) => {
  try {
    const net = await NetInfo.fetch();
    if (net.isConnected) {
      // online: fetch from server
      const userJson = await AsyncStorage.getItem("userData");
      const user = userJson ? JSON.parse(userJson) : null;
      const userId = user?.payload?.userid;
      if (!userId) {
        throw new Error("User ID missing");
      }

      const resp = await axios.get<{ status: number; payload: Category[] }>(
        `${baseApiUrl}/fileuploadcats.php?userid=${userId}`
      );

      if (resp.data.status !== 1) {
        throw new Error("Server returned error status");
      }

      // cache to AsyncStorage
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(resp.data.payload));
      return resp.data.payload;
    } else {
      // offline: load from cache
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as Category[];
      } else {
        throw new Error("No internet and no cached data");
      }
    }
  } catch (err: any) {
    // attempt to load from cache on any error
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as Category[];
    }
    return rejectWithValue(err.message ?? "Failed to load categories");
  }
});

const categorySlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    clearCategoryCache: (state) => {
      state.data = [];
      AsyncStorage.removeItem(CACHE_KEY);
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

export const { clearCategoryCache } = categorySlice.actions;

export const selectCategories = (state: { categories: CategoryState }) =>
  state.categories.data;
export const selectCategoryLoading = (state: { categories: CategoryState }) =>
  state.categories.loading;
export const selectCategoryError = (state: { categories: CategoryState }) =>
  state.categories.error;

export default categorySlice.reducer;
