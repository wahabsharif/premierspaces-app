import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_API_URL } from "../Constants/env";
import { isOnline, getCache, setCache } from "../services/cacheService";
import { CACHE_CONFIG } from "../Constants/env";

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

// Fetch contractors, extracting only the payload array
export const fetchContractors = createAsyncThunk<
  Contractor[],
  void,
  { rejectValue: string }
>("contractors/fetchContractors", async (_, { rejectWithValue }) => {
  try {
    const userJson = await AsyncStorage.getItem("userData");
    if (!userJson) return rejectWithValue("User not authenticated");
    const userData = JSON.parse(userJson);
    const userId = userData.payload?.userid ?? userData.userid;
    if (!userId) return rejectWithValue("User ID not found");

    const cacheKey = `${CACHE_CONFIG.CACHE_KEYS.CONTRACTORS}_${userId}`;
    const online = await isOnline();

    if (!online) {
      const cached = await getCache(cacheKey);
      if (cached?.payload) {
        const arr = Array.isArray(cached.payload) ? cached.payload : [];
        return arr;
      }
      return rejectWithValue("No connection and no cache");
    }

    const res = await fetch(`${BASE_API_URL}/contractors.php?userid=${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Assume server responds { status: 1, payload: [ ... ] }
    const arr = Array.isArray(json.payload) ? json.payload : [];
    await setCache(cacheKey, arr);
    return arr;
  } catch (err: any) {
    return rejectWithValue(err.message || "Error fetching contractors");
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
          // Ensure we always have an array
          state.data = Array.isArray(action.payload) ? action.payload : [];
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
