import { configureStore } from '@reduxjs/toolkit';
import messagesReducer from './slices/messagesSlice';
import connectionReducer from './slices/connectionSlice';

export const store = configureStore({
  reducer: {
    messages: messagesReducer,
    connection: connectionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['connection/setSocket', 'messages/setSocket'],
        ignoredPaths: ['connection.socket', 'messages.socket'],
      },
    }),
});

export default store;
