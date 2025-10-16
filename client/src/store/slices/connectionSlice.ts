import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Socket } from 'socket.io-client';

interface ConnectionState {
  connected: boolean;
  socket: Socket | null;
  accountNumber: string;
}

const initialState: ConnectionState = {
  connected: false,
  socket: null,
  accountNumber: '919566651479',
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    // Set connection status
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
    
    // Set socket instance
    setSocket: (state, action: PayloadAction<Socket | null>) => {
      state.socket = action.payload as any;
    },
    
    // Set account number
    setAccountNumber: (state, action: PayloadAction<string>) => {
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
