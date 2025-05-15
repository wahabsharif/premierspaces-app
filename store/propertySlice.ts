import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_API_URL } from "../Constants/env";
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

// Cache keys
const CACHE_KEYS = {
  PROPERTIES: "cachedProperties",
  LAST_UPDATED: "propertiesLastUpdated",
};

// Cache expiration time (12 hours in milliseconds)
const CACHE_EXPIRATION = 12 * 60 * 60 * 1000;

// Helper function to check if cache is valid
const isCacheValid = async (): Promise<boolean> => {
  try {
    const lastUpdatedStr = await AsyncStorage.getItem(CACHE_KEYS.LAST_UPDATED);
    if (!lastUpdatedStr) return false;

    const lastUpdated = new Date(lastUpdatedStr).getTime();
    const now = new Date().getTime();

    return now - lastUpdated < CACHE_EXPIRATION;
  } catch {
    return false;
  }
};

// Async thunk for fetching all properties with improved caching
export const fetchAllProperties = createAsyncThunk(
  "property/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      // Check if we have valid cached data first
      const cacheValid = await isCacheValid();
      if (cacheValid) {
        const cachedData = await AsyncStorage.getItem(CACHE_KEYS.PROPERTIES);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      }

      // If cache is invalid or missing, fetch from API
      const userDataJson = await AsyncStorage.getItem("userData");
      const userData = userDataJson ? JSON.parse(userDataJson) : null;
      const userid = userData?.payload?.userid;

      if (!userid) {
        return rejectWithValue("User ID not found. Please log in again.");
      }

      // Fetch all properties
      const url = `${BASE_API_URL}/searchproperty.php?userid=${userid}`;
      const response = await axios.get(url, {
        timeout: 10000, // Add timeout for better error handling
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      const data = response.data;

      if (data.status === 0 && data.payload?.message === "Session expired") {
        return rejectWithValue("Session expired");
      }

      if (data.status === 1 && data.payload && Array.isArray(data.payload)) {
        // Store data in cache
        await Promise.all([
          AsyncStorage.setItem(
            CACHE_KEYS.PROPERTIES,
            JSON.stringify(data.payload)
          ),
          AsyncStorage.setItem(
            CACHE_KEYS.LAST_UPDATED,
            new Date().toISOString()
          ),
        ]);

        return data.payload;
      } else {
        return rejectWithValue("No properties found");
      }
    } catch (error: any) {
      // Enhanced error handling
      const errorMsg =
        error.response?.status === 503
          ? "Service is temporarily unavailable. Please try again later."
          : error.code === "ECONNABORTED"
          ? "Request timed out. Please check your connection and try again."
          : "Failed to fetch properties";

      return rejectWithValue(errorMsg);
    }
  }
);

// Thunk for loading cached properties with optimization
export const loadCachedProperties = createAsyncThunk(
  "property/loadCached",
  async (_, { rejectWithValue }) => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.PROPERTIES);
      if (!cachedData) {
        return rejectWithValue("No cached properties available");
      }
      return JSON.parse(cachedData);
    } catch (error) {
      return rejectWithValue("Failed to load cached properties");
    }
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

// Optimized property filtering with memoization
const filterPropertiesByDoorNum = (
  properties: Property[],
  doorNum: string
): Property[] => {
  const searchTerm = doorNum.trim().toLowerCase();
  if (searchTerm === "") return [];

  return properties.filter((property) =>
    property.address.toLowerCase().includes(searchTerm)
  );
};

// Property slice
const propertySlice = createSlice({
  name: "property",
  initialState,
  reducers: {
    filterProperties: (state, action: PayloadAction<string>) => {
      const doorNum = action.payload;
      state.filteredProperties = filterPropertiesByDoorNum(
        state.properties,
        doorNum
      );
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
        state.error = null;
      })
      .addCase(fetchAllProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Handle loadCachedProperties
      .addCase(loadCachedProperties.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadCachedProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.properties = action.payload;
        state.error = null;
      })
      .addCase(loadCachedProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
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
