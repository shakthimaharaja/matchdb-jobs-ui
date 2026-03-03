/**
 * store/authSlice.ts — Jobs UI auth token store.
 *
 * Thin slice that stores the JWT token received as a prop from the shell host
 * via Module Federation. JobsApp.tsx calls store.dispatch(setToken(token))
 * whenever the token prop changes.
 *
 * jobsApi's prepareHeaders reads from this slice so components never need to
 * pass the token manually to any query or mutation.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  token: string | null;
}

const initialState: AuthState = {
  token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
  },
});

export const { setToken } = authSlice.actions;
export default authSlice.reducer;
