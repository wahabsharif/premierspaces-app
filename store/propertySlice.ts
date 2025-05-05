import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { baseApiUrl } from "../Constants/env";
import NetInfo from "@react-native-community/netinfo";

interface Property {
  id: string;
  address: string;
  company: string;
  [key: string]: any;
}

interface PropertyState {
  properties: Property[];
  filteredProperties: Property[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  lastUpdated: string | null;
}

// Initial state
const initialState: PropertyState = {
  properties: [],
  filteredProperties: [],
  loading: false,
  error: null,
  isConnected: true,
  lastUpdated: null,
};

// Async thunk for fetching all properties
export const fetchAllProperties = createAsyncThunk(
  "property/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      // Check if user is logged in
      const userDataJson = await AsyncStorage.getItem("userData");
      const userData = userDataJson ? JSON.parse(userDataJson) : null;
      const userid = userData?.payload?.userid;

      if (!userid) {
        return rejectWithValue("User ID not found. Please log in again.");
      }

      // Fetch all properties
      const url = `${baseApiUrl}/searchproperty.php?userid=${userid}`;
      const response = await axios.get(url);
      const data = response.data;

      if (data.status === 0 && data.payload?.message === "Session expired") {
        return rejectWithValue("Session expired");
      }

      if (data.status === 1 && data.payload && Array.isArray(data.payload)) {
        // Store the full properties data in AsyncStorage as a backup
        await AsyncStorage.setItem(
          "cachedProperties",
          JSON.stringify(data.payload)
        );
        return data.payload;
      } else {
        return rejectWithValue("No properties found");
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.status === 503
          ? "Service is temporarily unavailable. Please try again later."
          : "Failed to fetch properties"
      );
    }
  }
);

// Thunk for loading cached properties from AsyncStorage
export const loadCachedProperties = createAsyncThunk(
  "property/loadCached",
  async () => {
    const cachedData = await AsyncStorage.getItem("cachedProperties");
    return cachedData ? JSON.parse(cachedData) : [];
  }
);

// Check network connectivity
export const checkConnectivity = createAsyncThunk(
  "property/checkConnectivity",
  async () => {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected;
  }
);

// Property slice
const propertySlice = createSlice({
  name: "property",
  initialState,
  reducers: {
    filterProperties: (state, action: PayloadAction<string>) => {
      const doorNum = action.payload.trim().toLowerCase();
      if (doorNum === "") {
        state.filteredProperties = [];
      } else {
        state.filteredProperties = state.properties.filter((property) =>
          property.address.toLowerCase().includes(doorNum)
        );
      }
    },
    clearFilter: (state) => {
      state.filteredProperties = [];
    },
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchAllProperties
      .addCase(fetchAllProperties.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.properties = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchAllProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Handle loadCachedProperties
      .addCase(loadCachedProperties.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadCachedProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.properties = action.payload;
      })
      .addCase(loadCachedProperties.rejected, (state) => {
        state.loading = false;
        state.error = "Failed to load cached properties";
      })
      // Handle connectivity checks
      .addCase(checkConnectivity.fulfilled, (state, action) => {
        state.isConnected = action.payload ?? false;
      });
  },
});

export const { filterProperties, clearFilter, setConnectionStatus } =
  propertySlice.actions;
export default propertySlice.reducer;
