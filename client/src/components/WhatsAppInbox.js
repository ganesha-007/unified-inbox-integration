import React, { useEffect, useState } from 'react';
import { Layout, Typography, Space, Button, message as antdMessage, Input, Avatar, List, Divider } from 'antd';
import { MessageSquare, Send, Reply, Archive, Settings, Menu, User, Search } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { addMessage, setReplyingTo, clearReplyingTo, setConnected, setSocket, clearMessages } from '../store/slices/messagesSlice';
import { setConnected as setConnectionStatus, setSocket as setSocketInstance } from '../store/slices/connectionSlice';
import { loadMessages, addMessageWithPersistence } from '../store/thunks/messageThunks';
import io from 'socket.io-client';
import './WhatsAppInbox.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

const WhatsAppInbox = () => {
  const dispatch = useDispatch();
  const { messages, replyingTo } = useSelector(state => state.messages);
  const { connected, accountNumber } = useSelector(state => state.connection);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Clear all messages from Redux state
    dispatch(clearMessages());
    
    // Load messages from backend
    dispatch(loadMessages());

    // Connect to Socket.io
    const socket = io('http://localhost:5001');
    dispatch(setSocketInstance(socket));

    socket.on('connect', () => {
      console.log('Connected to server');
      dispatch(setConnectionStatus(true));
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      dispatch(setConnectionStatus(false));
    });

    socket.on('new_message', (message) => {
      console.log('🔔 Frontend received new message:', message);
      dispatch(addMessageWithPersistence({
        id: message.id || Date.now(),
        text: message.text,
        from: message.from,
        fromName: message.fromName || 'Unknown',
        to: message.to,
        timestamp: message.timestamp,
        direction: 'in'
      }));
    });

    socket.on('message_sent', (message) => {
      console.log('Message sent confirmation:', message);
      // Don't add duplicate messages - the sendMessage function already handles this
    });

    return () => {
      socket.close();
    };
  }, [dispatch]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // Store the original message for error handling
    const originalMessage = newMessage;
    
    // Clean the message text - remove any "Replying to..." prefix if it exists
    let messageText = newMessage.trim();
    if (messageText.startsWith('Replying to ')) {
      // Find the colon and take everything after it
      const colonIndex = messageText.indexOf(':');
      if (colonIndex !== -1) {
        messageText = messageText.substring(colonIndex + 1).trim();
      }
    }
    
    const targetRecipient = replyingTo ? replyingTo.from : (selectedChat ? selectedChat.id : '1234567890');
    
    // Clear the input immediately for better UX
    setNewMessage('');
    dispatch(clearReplyingTo());

    try {
      // Show loading state
      antdMessage.loading('Sending message...', 0);
      
      // Call the backend API to send the message
      const response = await fetch('http://localhost:5001/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: targetRecipient,
          message: messageText,
          replyTo: replyingTo ? replyingTo.id : null
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Add the sent message to the Redux store with persistence
        dispatch(addMessageWithPersistence({
          id: result.data.id,
          text: result.data.text,
          from: result.data.from,
          to: result.data.to,
          fromName: 'You',
          timestamp: result.data.timestamp,
          direction: 'out',
          replyTo: result.data.replyTo
        }));
        
        antdMessage.destroy();
        antdMessage.success(`Message sent to ${replyingTo ? replyingTo.fromName : (selectedChat ? selectedChat.name : 'recipient')}!`);
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      antdMessage.destroy();
      antdMessage.error(`Failed to send message: ${error.message}`);
      
      // Restore the message in the input if sending failed
      setNewMessage(originalMessage);
      if (replyingTo) {
        dispatch(setReplyingTo(replyingTo));
      }
    }
  };

  const handleReply = (message) => {
    dispatch(setReplyingTo(message));
    setNewMessage(''); // Don't include the reply prefix in the input
  };

  const cancelReply = () => {
    dispatch(clearReplyingTo());
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Group messages by chat (sender) - only show chats from incoming messages
  const groupMessagesByChat = (messages) => {
    const chats = {};
    messages.forEach(message => {
      // Only create chat entries for incoming messages (from other people)
      // Filter out 'You' messages from chat list
      if (message.direction === 'in' && message.fromName !== 'You') {
        const chatKey = message.from;
        if (!chats[chatKey]) {
          chats[chatKey] = {
            id: chatKey,
            name: message.fromName,
            lastMessage: message.text,
            lastMessageTime: message.timestamp,
            unreadCount: 0,
            messages: []
          };
        }
        chats[chatKey].messages.push(message);
        chats[chatKey].lastMessage = message.text;
        chats[chatKey].lastMessageTime = message.timestamp;
        chats[chatKey].unreadCount++;
      } else if (message.direction === 'out' && message.fromName !== 'You') {
        // For outgoing messages (not from 'You'), add them to the existing chat if it exists
        const chatKey = message.to;
        if (chats[chatKey]) {
          chats[chatKey].messages.push(message);
          // Update last message time if this is more recent
          if (new Date(message.timestamp) > new Date(chats[chatKey].lastMessageTime)) {
            chats[chatKey].lastMessage = message.text;
            chats[chatKey].lastMessageTime = message.timestamp;
          }
        }
      }
    });
    return Object.values(chats).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  };

  // Get messages for selected chat
  const getSelectedChatMessages = () => {
    if (!selectedChat) return [];
    return messages.filter(msg => 
      (msg.direction === 'in' && msg.from === selectedChat.id) ||
      (msg.direction === 'out' && msg.to === selectedChat.id)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  const chats = groupMessagesByChat(messages);
  const selectedChatMessages = getSelectedChatMessages();

  // Auto-select first chat if none selected
  useEffect(() => {
    if (chats.length > 0 && !selectedChat) {
      setSelectedChat(chats[0]);
    }
  }, [chats, selectedChat]);

  return (
    <div className="whatsapp-container">
      {/* Left Sidebar - Chat List */}
      <div className="sidebar">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-header-content">
            <div className="sidebar-header-left">
              <Text strong style={{ fontSize: '18px', color: '#e9edef' }}>Chats</Text>
            </div>
                    <div className="sidebar-header-right">
                      <Button 
                        type="text" 
                        icon={<Archive size={20} />} 
                        onClick={() => {
                          // AGGRESSIVE CLEARING
                          localStorage.clear();
                          localStorage.removeItem('whatsapp_messages');
                          localStorage.removeItem('messages');
                          localStorage.removeItem('redux-state');
                          dispatch(clearMessages());
                          // Force page reload
                          window.location.reload();
                          antdMessage.success('All messages cleared and page reloaded!');
                        }}
                        title="Clear all messages and reload"
                      />
                      <Button type="text" icon={<Settings size={20} />} />
                      <Button type="text" icon={<Menu size={20} />} />
                    </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Ask Meta AI or Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>



        {/* Chat List */}
        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="no-chats">
              <MessageSquare size={48} style={{ color: '#d9d9d9' }} />
              <Text type="secondary">No conversations yet</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Send a WhatsApp message to {accountNumber} to start chatting
              </Text>
            </div>
          ) : (
            <List
              dataSource={chats}
              renderItem={(chat) => (
                <List.Item
                  className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
                  onClick={() => setSelectedChat(chat)}
                >
                  <div className="chat-item-content">
                    <Avatar 
                      size={48} 
                      style={{ backgroundColor: '#25D366' }}
                      icon={<User size={20} />}
                    />
                    <div className="chat-item-info">
                      <div className="chat-item-header">
                        <Text strong className="chat-name">{chat.name}</Text>
                        <Text className="chat-time">
                          {new Date(chat.lastMessageTime).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                      </div>
                      <div className="chat-item-footer">
                        <Text className="chat-last-message" ellipsis>
                          {chat.lastMessage}
                        </Text>
                        {chat.unreadCount > 0 && (
                          <div className="unread-badge">
                            {chat.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Chat Area */}
      <div className="chat-area">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-content">
                <div className="chat-header-left">
                  <Avatar 
                    size={40} 
                    style={{ backgroundColor: '#25D366' }}
                    icon={<User size={20} />}
                  />
                  <div className="chat-header-info">
                    <Text strong className="chat-header-name">{selectedChat.name}</Text>
                  </div>
                </div>
                <div className="chat-header-right">
                  {/* Icons removed for cleaner look */}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="messages-area">
              {selectedChatMessages.length === 0 ? (
                <div className="no-messages">
                  <MessageSquare size={48} style={{ color: '#d9d9d9' }} />
                  <Text type="secondary">No messages in this conversation</Text>
                </div>
              ) : (
                <div className="messages-list">
                  {selectedChatMessages.map((msg) => (
                    <div key={msg.id} className={`message-wrapper ${msg.direction}`}>
                      <div className="message-bubble">
                        {msg.direction === 'out' && msg.replyTo && (
                          <div className="reply-context">
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Replying to previous message
                            </Text>
                          </div>
                        )}
                        <div className="message-text">{msg.text}</div>
                        <div className="message-footer">
                          <div className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                          {msg.direction === 'in' && (
                            <Button
                              type="text"
                              size="small"
                              icon={<Reply size={12} />}
                              onClick={() => handleReply(msg)}
                              className="reply-button"
                            >
                              Reply
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="message-input-container">
              {replyingTo && (
                <div className="reply-indicator">
                  <Space>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Replying to {replyingTo.fromName}:
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      onClick={cancelReply}
                      style={{ color: '#ff4d4f', fontSize: '11px' }}
                    >
                      Cancel
                    </Button>
                  </Space>
                </div>
              )}
              <div className="input-wrapper">
                <TextArea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={replyingTo ? `Reply to ${replyingTo.fromName}...` : "Type a message..."}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  className="message-input"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    color: '#e9edef',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    padding: '8px 0',
                    outline: 'none'
                  }}
                />
                {newMessage.trim() && (
                  <Button 
                    type="primary" 
                    icon={<Send size={16} />}
                    onClick={sendMessage}
                    className="send-button"
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <MessageSquare size={64} style={{ color: '#d9d9d9' }} />
              <Title level={3} type="secondary">WhatsApp Web</Title>
              <Text type="secondary">
                Send and receive messages without keeping your phone online.
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </Text>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppInbox;
