import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { Toast } from "toastify-react-native";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";
import { getCache, isOnline, setCache } from "../services/cacheService";

export interface Contractor {
  id: string;
  name: string;
}

export interface ContractorState {
  data: Contractor[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
}

const initialState: ContractorState = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
};

export const fetchContractors = createAsyncThunk<
  Contractor[],
  string,
  { rejectValue: string }
>("contractors/fetchContractors", async (userId, { rejectWithValue }) => {
  const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.CONTRACTORS}_${userId}`;
  const online = await isOnline();

  // Debug log to see what's happening
  console.log("[fetchContractors] Starting fetch for user:", userId);

  if (!online) {
    try {
      console.log("[fetchContractors] Offline, fetching from cache");
      const cached = await getCache(cacheKey);

      // Handle various possible cache structures
      let contractors = [];
      if (cached?.payload) {
        if (Array.isArray(cached.payload)) {
          contractors = cached.payload;
        } else if (
          cached.payload.payload &&
          Array.isArray(cached.payload.payload)
        ) {
          contractors = cached.payload.payload;
        } else if (typeof cached.payload === "object") {
          contractors = [cached.payload];
        }
      }

      // Ensure all contractors have string IDs for consistent comparison
      interface CachedContractor {
        id: string | number;
        [key: string]: any;
      }

      const normalized: Contractor[] = contractors.map(
        (c: CachedContractor) => ({
          ...c,
          id: String(c.id),
        })
      );

      console.log(
        `[fetchContractors] Found ${normalized.length} contractors in cache`
      );
      return normalized;
    } catch (err) {
      Toast.error(
        `[fetchContractors] Cache error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return [];
    }
  }

  try {
    console.log("[fetchContractors] Online, fetching from API");
    // Using axios instead of fetch for consistency with your other code
    const { data } = await axios.get(`${BASE_API_URL}/contractors.php`, {
      params: { userid: userId },
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    let contractors = [];
    if (data.status === 1 && data.payload) {
      if (Array.isArray(data.payload)) {
        contractors = data.payload;
      } else if (data.payload.payload && Array.isArray(data.payload.payload)) {
        contractors = data.payload.payload;
      } else if (typeof data.payload === "object") {
        contractors = [data.payload];
      }
    }

    // Normalize contractor data to ensure consistent structure
    interface ApiContractor {
      id?: string | number;
      contractor_id?: string | number;
      name?: string;
      contractor_name?: string;
      [key: string]: any; // Allow additional properties
    }

    const normalized: Contractor[] = contractors.map((c: ApiContractor) => ({
      id: String(c.id || c.contractor_id), // Handle possible field name variations
      name: String(c.name || c.contractor_name || "Unknown"), // Handle possible field name variations
    }));

    console.log(
      `[fetchContractors] Received ${normalized.length} contractors from API`
    );

    // Store the normalized array in cache with no expiration
    await setCache(cacheKey, normalized, { expiresIn: 0 });

    return normalized;
  } catch (err: any) {
    Toast.error("[fetchContractors] API error, trying cache fallback:", err);
    try {
      const cached = await getCache(cacheKey);
      let contractors = [];
      if (cached?.payload) {
        if (Array.isArray(cached.payload)) {
          contractors = cached.payload;
        } else if (
          cached.payload.payload &&
          Array.isArray(cached.payload.payload)
        ) {
          contractors = cached.payload.payload;
        } else if (typeof cached.payload === "object") {
          contractors = [cached.payload];
        }
      }

      interface CachedContractor {
        id: string | number;
        [key: string]: any;
      }

      const normalized: Contractor[] = contractors.map(
        (c: CachedContractor) => ({
          ...c,
          id: String(c.id),
        })
      );

      return normalized;
    } catch (cacheErr) {
      Toast.error(
        `[fetchContractors] Cache fallback error: ${
          cacheErr instanceof Error ? cacheErr.message : String(cacheErr)
        }`
      );
      return rejectWithValue(err.message || "Error fetching contractors");
    }
  }
});

const contractorSlice = createSlice({
  name: "contractors",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchContractors.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.error = null;
      })
      .addCase(
        fetchContractors.fulfilled,
        (state, action: PayloadAction<Contractor[]>) => {
          state.isLoading = false;
          state.data = action.payload;
        }
      )
      .addCase(fetchContractors.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.error = action.payload ?? "Unknown error";
        state.data = [];
      });
  },
});

export default contractorSlice.reducer;
