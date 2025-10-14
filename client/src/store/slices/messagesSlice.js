import { createSlice } from '@reduxjs/toolkit';

// Helper functions for localStorage persistence
const STORAGE_KEY = 'whatsapp_messages';

const saveToStorage = (messages) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save messages to localStorage:', error);
  }
};

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const messages = stored ? JSON.parse(stored) : [];
    return messages; // Don't filter here - we'll filter in the UI components
  } catch (error) {
    console.error('Failed to load messages from localStorage:', error);
    return [];
  }
};

const initialState = {
  messages: loadFromStorage(), // Load messages from localStorage on initialization
  loading: false,
  error: null,
  replyingTo: null,
  lastSyncTime: null,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    // Add a new message
    addMessage: (state, action) => {
      console.log('📝 Redux: Adding message to state:', action.payload);
      const newMessage = {
        id: action.payload.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: action.payload.text,
        from: action.payload.from,
        fromName: action.payload.fromName || 'Unknown',
        to: action.payload.to,
        timestamp: action.payload.timestamp || new Date().toISOString(),
        direction: action.payload.direction, // 'in' or 'out'
        replyTo: action.payload.replyTo || null,
        ...action.payload
      };
      
      // Check if message already exists to prevent duplicates
      const exists = state.messages.some(msg => msg.id === newMessage.id);
      if (!exists) {
        state.messages.push(newMessage);
        saveToStorage(state.messages); // Persist to localStorage
        state.lastSyncTime = new Date().toISOString();
        console.log('✅ Redux: Message added to state. Total messages:', state.messages.length);
      } else {
        console.log('⚠️ Redux: Message already exists, skipping');
      }
    },
    
    // Set replying to message
    setReplyingTo: (state, action) => {
      state.replyingTo = action.payload;
    },
    
    // Clear replying to
    clearReplyingTo: (state) => {
      state.replyingTo = null;
    },
    
    // Set loading state
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    // Set error
    setError: (state, action) => {
      state.error = action.payload;
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    
    // Set all messages (for loading from storage)
    setMessages: (state, action) => {
      state.messages = action.payload;
      saveToStorage(state.messages); // Persist to localStorage
      state.lastSyncTime = new Date().toISOString();
    },
    
    // Clear all messages
    clearMessages: (state) => {
      state.messages = [];
      localStorage.removeItem(STORAGE_KEY);
      state.lastSyncTime = new Date().toISOString();
    },
    
    
    // Update message (for read receipts, etc.)
    updateMessage: (state, action) => {
      const { id, updates } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === id);
      if (messageIndex !== -1) {
        state.messages[messageIndex] = { ...state.messages[messageIndex], ...updates };
        saveToStorage(state.messages); // Persist to localStorage
        state.lastSyncTime = new Date().toISOString();
      }
    },
    
    // Sync messages (merge new messages with existing ones)
    syncMessages: (state, action) => {
      const newMessages = action.payload;
      const existingIds = new Set(state.messages.map(msg => msg.id));
      
      newMessages.forEach(newMsg => {
        if (!existingIds.has(newMsg.id)) {
          const message = {
            id: newMsg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: newMsg.text,
            from: newMsg.from,
            fromName: newMsg.fromName || 'Unknown',
            to: newMsg.to,
            timestamp: newMsg.timestamp || new Date().toISOString(),
            direction: newMsg.direction,
            replyTo: newMsg.replyTo || null,
            ...newMsg
          };
          state.messages.push(message);
        }
      });
      
      // Sort messages by timestamp
      state.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      saveToStorage(state.messages); // Persist to localStorage
      state.lastSyncTime = new Date().toISOString();
    },
  },
});

export const {
  addMessage,
  setMessages,
  setReplyingTo,
  clearReplyingTo,
  setLoading,
  setError,
  clearError,
  clearMessages,
  updateMessage,
  syncMessages,
} = messagesSlice.actions;

export default messagesSlice.reducer;
