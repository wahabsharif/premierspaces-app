import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
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

  if (!online) {
    try {
      const cached = await getCache(cacheKey);
      const arr = Array.isArray(cached?.payload?.payload)
        ? cached.payload.payload
        : [];
      return arr;
    } catch {
      return [];
    }
  }

  try {
    const res = await fetch(`${BASE_API_URL}/contractors.php?userid=${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const arr = Array.isArray(json.payload) ? json.payload : [];

    await setCache(cacheKey, arr, {
      expiresIn: 24 * 60 * 60 * 1000,
    });
    return arr;
  } catch (err: any) {
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
