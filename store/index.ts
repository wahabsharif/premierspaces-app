import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import propertyReducer from "./propertySlice";
import categoryReducer from "./categorySlice";
import createJobReducer from "./createJobSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    property: propertyReducer,
    categories: categoryReducer,
    job: createJobReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
