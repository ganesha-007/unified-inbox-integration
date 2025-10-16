import { createAsyncThunk } from '@reduxjs/toolkit';
import messageService from '../../services/messageService';
import { addMessage, setMessages, syncMessages, updateMessage, setLoading, setError } from '../slices/messagesSlice';
import { Message } from '../../types';

// Load messages from backend and sync with localStorage
export const loadMessages = createAsyncThunk(
  'messages/loadMessages',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      // Load from backend
      const backendMessages = await messageService.loadMessages();
      
      // Transform backend messages to frontend format and filter out test messages
      const transformedBackendMessages: Message[] = backendMessages
        .map(backendMsg => ({
          id: backendMsg.id,
          text: (backendMsg as any).body || (backendMsg as any).content || 'No content',
          from: (backendMsg as any).provider_metadata?.from || (backendMsg as any).chat?.account?.connection_data?.phone_number || 'Unknown',
          fromName: (backendMsg as any).provider_metadata?.fromName || (backendMsg as any).chat?.title || 'Unknown',
          to: (backendMsg as any).provider_metadata?.to || (backendMsg as any).chat?.provider_chat_id || 'Unknown',
          timestamp: new Date((backendMsg as any).sent_at || (backendMsg as any).timestamp),
          direction: (backendMsg as any).direction || 'in',
          chat_id: (backendMsg as any).chat_id,
          provider_msg_id: (backendMsg as any).provider_msg_id,
          subject: (backendMsg as any).subject,
          attachments: (backendMsg as any).attachments,
          status: (backendMsg as any).status,
          provider_metadata: (backendMsg as any).provider_metadata,
          created_at: (backendMsg as any).created_at,
          avatar: (backendMsg as any).provider_metadata?.avatar,
          platform: (backendMsg as any).provider_metadata?.platform
        }))
        .filter(msg => {
          // Filter out test users and fake contacts
          const fromName = msg.fromName || 'Unknown';
          const isRealContact = fromName !== 'Unknown' && 
                               fromName !== 'Test User' && 
                               !fromName.startsWith('Chat ') &&
                               !fromName.includes('test') &&
                               !fromName.includes('Test') &&
                               !fromName.includes('github') &&
                               !fromName.includes('frontend') &&
                               fromName.length > 2;
          
          // Keep messages from real contacts or outgoing messages
          return isRealContact || msg.direction === 'out';
        });
      
      // Load from localStorage
      const localMessages: Message[] = JSON.parse(localStorage.getItem('whatsapp_messages') || '[]');
      
      // Merge messages, prioritizing backend data
      const allMessages: Message[] = [...localMessages];
      transformedBackendMessages.forEach(backendMsg => {
        const exists = allMessages.find(msg => msg.id === backendMsg.id || msg.provider_msg_id === backendMsg.provider_msg_id);
        if (!exists) {
          allMessages.push(backendMsg);
        }
      });
      
      // Sort by timestamp
      allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      dispatch(setMessages(allMessages));
      return allMessages;
    } catch (error: any) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Add message with persistence
export const addMessageWithPersistence = createAsyncThunk(
  'messages/addMessageWithPersistence',
  async (message: Partial<Message>, { dispatch, rejectWithValue }) => {
    try {
      console.log('🔄 Adding message to Redux store:', message);
      // Add to Redux store (which will save to localStorage)
      dispatch(addMessage(message as Message));
      
      // Also save to backend
      await messageService.saveMessage(message);
      
      console.log('✅ Message added successfully');
      return message;
    } catch (error: any) {
      console.error('❌ Error adding message:', error);
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);

// Sync messages with backend
export const syncMessagesWithBackend = createAsyncThunk(
  'messages/syncMessagesWithBackend',
  async (messages: Message[], { dispatch, rejectWithValue }) => {
    try {
      const syncedMessages = await messageService.syncMessages(messages);
      dispatch(syncMessages(syncedMessages));
      return syncedMessages;
    } catch (error: any) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);

// Update message with persistence
export const updateMessageWithPersistence = createAsyncThunk(
  'messages/updateMessageWithPersistence',
  async ({ messageId, updates }: { messageId: string; updates: Partial<Message> }, { dispatch, rejectWithValue }) => {
    try {
      // Update in Redux store (which will save to localStorage)
      dispatch(updateMessage({ id: messageId, updates }));
      
      // Also update in backend
      await messageService.updateMessage(messageId, updates);
      
      return { messageId, updates };
    } catch (error: any) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);

// Delete message with persistence
export const deleteMessageWithPersistence = createAsyncThunk(
  'messages/deleteMessageWithPersistence',
  async (messageId: string, { dispatch, rejectWithValue }) => {
    try {
      // Delete from backend
      await messageService.deleteMessage(messageId);
      
      // Remove from localStorage
      const localMessages: Message[] = JSON.parse(localStorage.getItem('whatsapp_messages') || '[]');
      const updatedMessages = localMessages.filter(msg => msg.id !== messageId);
      localStorage.setItem('whatsapp_messages', JSON.stringify(updatedMessages));
      
      // Update Redux store
      dispatch(setMessages(updatedMessages));
      
      return messageId;
    } catch (error: any) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);
