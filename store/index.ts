import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import propertyReducer from "./propertySlice";
import categoryReducer from "./categorySlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    property: propertyReducer,
    categories: categoryReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
