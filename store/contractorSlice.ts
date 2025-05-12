// contractorSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_API_URL } from "../Constants/env";

interface ContractorState {
  data: any[];
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

export const fetchContractors = createAsyncThunk(
  "contractors/fetchContractors",
  async (_, { rejectWithValue }) => {
    try {
      // Retrieve user data from AsyncStorage
      const userJson = await AsyncStorage.getItem("userData");
      if (!userJson) {
        return rejectWithValue("User not authenticated");
      }

      // Parse user data and extract user ID
      const userData = JSON.parse(userJson);
      const userId = userData.payload?.userid ?? userData.userid;

      if (!userId) {
        return rejectWithValue("User ID not found");
      }

      // Fetch contractors from API
      const response = await fetch(
        `${BASE_API_URL}/contractors.php?userid=${userId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contractors = await response.json();
      return contractors;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue("An unknown error occurred");
    }
  }
);

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
      .addCase(fetchContractors.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isError = false;
        state.data = action.payload;
      })
      .addCase(fetchContractors.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.error = action.payload as string;
        state.data = [];
      });
  },
});

export default contractorSlice.reducer;
