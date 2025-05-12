import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import categoryReducer from "./categorySlice";
import filesReducer from "./filesSlice";
import jobReducer from "./jobSlice";
import propertyReducer from "./propertySlice";
import costReducer from "./costsSlice";
import contractorReducer from "./contractorSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    property: propertyReducer,
    categories: categoryReducer,
    job: jobReducer,
    files: filesReducer,
    cost: costReducer,
    contractor: contractorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // keep immutable checks if you like, but skip serializable checks entirely
      immutableCheck: true,
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
