import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";
import { getCache, isOnline, setCache } from "../services/cacheService";

interface Contractor {
  id: string;
  name: string;
}

interface ContractorState {
  data: Contractor[];
  isLoading: boolean;
  isError: boolean;
  error: string;
}

const initialState: ContractorState = {
  data: [],
  isLoading: false,
  isError: false,
  error: "",
};

// Fetch contractors: requires userId argument
export const fetchContractors = createAsyncThunk<
  Contractor[],
  string,
  { rejectValue: string }
>("contractors/fetchContractors", async (userId, { rejectWithValue }) => {
  const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.CONTRACTORS}_${userId}`;
  const online = await isOnline();

  if (!online) {
    // Offline: load from cache, default to empty
    try {
      const cached = await getCache(cacheKey);
      // Unwrap nested payload structure from caching
      const arr = Array.isArray(cached?.payload?.payload)
        ? cached.payload.payload
        : [];
      return arr;
    } catch {
      return [];
    }
  }

  // Online: fetch from API
  try {
    const res = await fetch(`${BASE_API_URL}/contractors.php?userid=${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const arr = Array.isArray(json.payload) ? json.payload : [];

    // Cache the result for offline use
    await setCache(cacheKey, arr, { expiresIn: 24 * 60 * 60 * 1000 });
    return arr;
  } catch (err: any) {
    // on error, try cache before rejecting
    try {
      const cached = await getCache(cacheKey);
      const arr = Array.isArray(cached?.payload?.payload)
        ? cached.payload.payload
        : [];
      return arr;
    } catch {
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
        state.error = "";
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
        state.error = action.payload as string;
        state.data = [];
      });
  },
});

export default contractorSlice.reducer;
