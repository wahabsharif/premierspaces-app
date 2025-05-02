import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { baseApiUrl } from "../Constants/env";

// Define the shape of our auth state
interface AuthState {
  token: string | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: null,
  userId: null,
  loading: false,
  error: null,
};

// Async thunk for login
// store/authSlice.ts
export const login = createAsyncThunk<
  { token: string; userId: string },
  { initials: string; pin: string },
  { rejectValue: string }
>("auth/login", async ({ initials, pin }, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${baseApiUrl}/login.php`, {
      userid: 0,
      payload: { initials, pin },
    });
    const data = response.data;
    console.log("🔍 login response.data:", data);

    if (data.status !== 1) {
      return rejectWithValue("Invalid credentials");
    }

    // ─── PATCH ───
    // API returns { payload: { userid: "qwohnadv7w", ... }, ... }
    const userId = data.payload.userid;
    if (!userId) {
      console.warn("⚠️ payload.userid missing");
      return rejectWithValue("Malformed login response");
    }
    // We'll temporarily use `userId` also as our "token"
    const token = userId;

    const userInfo = { token, userId };

    // store & verify
    try {
      await AsyncStorage.setItem("userData", JSON.stringify(userInfo));
      const stored = await AsyncStorage.getItem("userData");
      console.log("✅ Latest userData in AsyncStorage:", stored);
    } catch (e) {
      console.error("❌ AsyncStorage error:", e);
    }
    // ──────────────

    return userInfo;
  } catch (err: any) {
    return rejectWithValue(err.message || "Unexpected error");
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.userId = null;
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
        (state, action: PayloadAction<{ token: string; userId: string }>) => {
          state.loading = false;
          state.token = action.payload.token;
          state.userId = action.payload.userId;
        }
      )
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || "Login failed";
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
