import { configureStore } from '@reduxjs/toolkit';
import messagesReducer from './slices/messagesSlice';
import connectionReducer from './slices/connectionSlice';

export const store = configureStore({
  reducer: {
    messages: messagesReducer,
    connection: connectionReducer,
  },
});

export default store;
