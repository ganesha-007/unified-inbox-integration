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
    // Load messages from backend and localStorage
    // Don't clear messages first - let loadMessages handle merging
    dispatch(loadMessages());

        // Connect to Socket.io - simplified
        console.log('🔌 Attempting to connect to Socket.io...');
        const socket = io('http://localhost:5001', {
          transports: ['websocket', 'polling'],
          forceNew: true,
          auth: {
            token: null // No token for testing
          }
        });
    dispatch(setSocketInstance(socket));

    socket.on('connect', () => {
      console.log('✅ Socket.io connected successfully!', socket.id);
      dispatch(setConnectionStatus(true));
      
      // Join user-specific room for receiving messages
      // Using the default user ID from the backend
      const userId = 'e82f8560-e0ac-4de1-9c2d-039541a94a97';
      socket.emit('join_room', `user_${userId}`);
      console.log('🏠 Joined user room:', `user_${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket.io disconnected');
      dispatch(setConnectionStatus(false));
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
      dispatch(setConnectionStatus(false));
    });

    socket.on('test_message', (data) => {
      console.log('🧪 Received test message:', data);
    });

    socket.on('new_message', (message) => {
      console.log('🔔 Frontend received new message:', message);
      console.log('🔔 Message direction:', message.direction);
      console.log('🔔 Message fromName:', message.fromName);
      
      // Filter out test users and fake contacts in real-time
      const fromName = message.fromName || 'Unknown';
      const isRealContact = fromName !== 'Unknown' && 
                           fromName !== 'Test User' && 
                           !fromName.startsWith('Chat ') &&
                           !fromName.includes('test') &&
                           !fromName.includes('Test') &&
                           !fromName.includes('github') &&
                           !fromName.includes('frontend') &&
                           fromName.length > 2;
      
      // Only add messages from real contacts or outgoing messages
      if (isRealContact || message.direction === 'out') {
        dispatch(addMessageWithPersistence({
          id: message.id || Date.now(),
          text: message.text,
          from: message.from,
          fromName: fromName,
          to: message.to,
          timestamp: message.timestamp,
          direction: message.direction || 'in'
        }));
      } else {
        console.log('🚫 Filtered out test/fake message from:', fromName);
      }
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
    
    // Determine the correct recipient
    let targetRecipient;
    if (replyingTo) {
      // When replying, use the sender's phone number
      targetRecipient = replyingTo.from;
    } else if (selectedChat) {
      // When sending to selected chat, use the chat ID (which is the phone number)
      targetRecipient = selectedChat.id;
    } else {
      // Fallback
      targetRecipient = '1234567890';
    }
    
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
          text: messageText,
          fromName: 'You',
          replyTo: replyingTo ? replyingTo.id : null
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Don't add sent messages to the frontend - user doesn't want to see their own messages
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
    
    // Auto-select the chat for this message (only for incoming messages)
    if (message.direction === 'in' && message.fromName !== 'You') {
      const chatForMessage = chats.find(chat => chat.id === message.from);
      if (chatForMessage) {
        setSelectedChat(chatForMessage);
      }
    }
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

  // Group messages by chat (phone number) - only show chats from real WhatsApp contacts
  const groupMessagesByChat = (messages) => {
    const chats = {};
    messages.forEach(message => {
      // Only create chat entries for incoming messages from real WhatsApp contacts
      // Filter out test users, empty users, and fake contacts
      if (message.direction === 'in' && 
          message.fromName !== 'You' && 
          message.fromName && 
          message.fromName !== 'Unknown' && 
          message.fromName !== 'Test User' && 
          !message.fromName.startsWith('Chat ') &&
          !message.fromName.includes('test') &&
          !message.fromName.includes('Test') &&
          !message.fromName.includes('github') &&
          !message.fromName.includes('frontend') &&
          message.fromName.length > 2) { // Ensure name has substance
        
        const chatKey = message.from;
        const chatName = message.fromName;
        
        if (!chats[chatKey]) {
          chats[chatKey] = {
            id: chatKey,
            name: chatName,
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
      }
    });
    
    return Object.values(chats).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  };

  // Get messages for selected chat - show both incoming and outgoing messages
  const getSelectedChatMessages = () => {
    if (!selectedChat) return [];
    console.log('🔍 Filtering messages for chat:', selectedChat.id);
    console.log('🔍 All messages:', messages);
    
    const filteredMessages = messages.filter(msg => {
      const isIncoming = msg.direction === 'in' && msg.from === selectedChat.id && msg.fromName !== 'You';
      const isOutgoing = msg.direction === 'out' && msg.to === selectedChat.id;
      
      console.log(`🔍 Message ${msg.id}: direction=${msg.direction}, from=${msg.from}, to=${msg.to}, fromName=${msg.fromName}, isIncoming=${isIncoming}, isOutgoing=${isOutgoing}`);
      
      return isIncoming || isOutgoing;
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    console.log('🔍 Filtered messages:', filteredMessages);
    return filteredMessages;
  };

  const chats = groupMessagesByChat(messages);
  const selectedChatMessages = getSelectedChatMessages();

  // Handle chat selection
  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    dispatch(clearReplyingTo()); // Clear any reply state when selecting a chat
  };

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
                  onClick={() => handleChatSelect(chat)}
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
                          {(() => {
                            const date = new Date(chat.lastMessageTime);
                            return isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            });
                          })()}
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
                            {(() => {
                              const date = new Date(msg.timestamp);
                              return isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              });
                            })()}
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
