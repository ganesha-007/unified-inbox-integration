import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connected: false,
  socket: null,
  accountNumber: '919566651479',
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    // Set connection status
    setConnected: (state, action) => {
      state.connected = action.payload;
    },
    
    // Set socket instance
    setSocket: (state, action) => {
      state.socket = action.payload;
    },
    
    // Set account number
    setAccountNumber: (state, action) => {
      state.accountNumber = action.payload;
    },
  },
});

export const {
  setConnected,
  setSocket,
  setAccountNumber,
} = connectionSlice.actions;

export default connectionSlice.reducer;
