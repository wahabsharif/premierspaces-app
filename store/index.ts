import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import propertyReducer from "./propertySlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    property: propertyReducer,
  },
});

// Infer types for use throughout the app
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
