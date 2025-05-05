// store/authSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { baseApiUrl } from "../Constants/env";
import { Toast } from "toastify-react-native";

// Define the shape of our auth state
interface AuthState {
  status: number | null;
  payload: {
    userid: string;
    name: string;
    role: string;
  } | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  status: null,
  payload: null,
  loading: false,
  error: null,
};

// Async thunk for login
export const login = createAsyncThunk<
  { status: number; payload: { userid: string; name: string; role: string } },
  { initials: string; pin: string },
  { rejectValue: string }
>("auth/login", async ({ initials, pin }, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${baseApiUrl}/login.php`, {
      userid: 0,
      payload: { initials, pin },
    });
    const data = response.data;

    if (data.status !== 1) {
      return rejectWithValue(data.message || "Invalid credentials");
    }

    // Store full response structure
    try {
      await AsyncStorage.setItem("userData", JSON.stringify(data));
      const stored = await AsyncStorage.getItem("userData");
      console.log("✅ Latest userData in AsyncStorage:", stored);
    } catch (e) {
      console.error("❌ AsyncStorage error:", e);
    }

    return data;
  } catch (err: any) {
    return rejectWithValue(err.message || "Unexpected error");
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.status = null;
      state.payload = null;
      AsyncStorage.removeItem("userData");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        login.fulfilled,
        (
          state,
          action: PayloadAction<{
            status: number;
            payload: { userid: string; name: string; role: string };
          }>
        ) => {
          state.loading = false;
          state.status = action.payload.status;
          state.payload = action.payload.payload;
        }
      )
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || "Login failed";
        Toast.error(state.error);
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
