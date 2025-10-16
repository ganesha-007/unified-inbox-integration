import React, { useEffect, useState } from 'react';
import { Layout, Typography, Space, Button, message as antdMessage, Input, Avatar, List, Divider } from 'antd';
import { MessageSquare, Send, Reply, Archive, Settings, Menu, User, Search } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { addMessage, setReplyingTo, clearReplyingTo, clearMessages } from '../store/slices/messagesSlice';
import { setConnected as setConnectionStatus, setSocket as setSocketInstance } from '../store/slices/connectionSlice';
import { loadMessages, addMessageWithPersistence } from '../store/thunks/messageThunks';
import { RootState, AppDispatch } from '../store';
import { Message, SocketMessage, Chat } from '../types';

// Interface for chat list items (different from Chat interface)
interface ChatListItem {
  id: string;
  from: string;
  fromName: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  avatar?: string;
  messages: Message[];
}
import io, { Socket } from 'socket.io-client';
import './WhatsAppInbox.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

const WhatsAppInbox: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, replyingTo } = useSelector((state: RootState) => state.messages);
  const { connected, accountNumber } = useSelector((state: RootState) => state.connection);
  const [newMessage, setNewMessage] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<ChatListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    // Load messages from backend and localStorage
    // Don't clear messages first - let loadMessages handle merging
    dispatch(loadMessages());

    // Connect to Socket.io - simplified
    console.log('🔌 Attempting to connect to Socket.io...');
    const socket: Socket = io('http://localhost:5001', {
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

    // Listen for new messages
    socket.on('new_message', (message: SocketMessage) => {
      console.log('📨 Received new message via Socket.io:', message);
      
      // Convert SocketMessage to Message format
      const normalizedMessage: Message = {
        id: message.id,
        text: message.text,
        from: message.from,
        fromName: message.fromName,
        to: message.to,
        timestamp: new Date(message.timestamp),
        direction: message.direction,
        chat_id: message.chat_id,
        provider_msg_id: message.provider_msg_id,
        subject: message.subject,
        attachments: message.attachments,
        status: message.status,
        provider_metadata: message.provider_metadata,
        created_at: message.created_at,
        avatar: message.avatar,
        platform: message.platform
      };
      
      dispatch(addMessage(normalizedMessage));
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      dispatch(setConnectionStatus(false));
    };
  }, [dispatch]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageData: Partial<Message> = {
      text: newMessage,
      from: 'you',
      fromName: 'You',
      to: accountNumber,
      timestamp: new Date(),
      direction: 'out',
      status: 'sent'
    };

    try {
      // Add message to Redux store immediately for optimistic UI
      dispatch(addMessage(messageData as Message));

      // Send via Socket.io
      const socket = useSelector((state: RootState) => state.connection.socket);
      if (socket && connected) {
        socket.emit('send_message', {
          platform: 'whatsapp',
          content: newMessage,
          threadId: selectedChat?.id || 'default',
          recipient: accountNumber
        });
      }

      // Also send via API as backup
      dispatch(addMessageWithPersistence(messageData));

      setNewMessage('');
      antdMessage.success('Message sent!');
    } catch (error) {
      console.error('Error sending message:', error);
      antdMessage.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReply = (message: Message) => {
    dispatch(setReplyingTo(message));
  };

  const handleClearReply = () => {
    dispatch(clearReplyingTo());
  };

  const filteredMessages = messages.filter(msg => 
    msg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.fromName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedMessages = filteredMessages.reduce((groups: Record<string, Message[]>, message) => {
    const key = message.from;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(message);
    return groups;
  }, {});

  const chatList: ChatListItem[] = Object.entries(groupedMessages).map(([from, messages]) => {
    const lastMessage = messages[messages.length - 1];
    const unreadCount = messages.filter(msg => msg.direction === 'in' && msg.status !== 'read').length;
    
    return {
      id: from,
      from,
      fromName: lastMessage.fromName,
      lastMessage: lastMessage.text,
      timestamp: lastMessage.timestamp,
      unreadCount,
      avatar: lastMessage.avatar,
      messages
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const currentChatMessages = selectedChat 
    ? groupedMessages[selectedChat.from] || []
    : [];

  return (
    <Layout className="whatsapp-inbox">
      <Header className="inbox-header">
        <div className="header-content">
          <div className="header-left">
            <MessageSquare className="header-icon" />
            <Title level={3} className="header-title">WhatsApp Inbox</Title>
          </div>
          <div className="header-right">
            <Space>
              <Button 
                icon={<Settings />} 
                type="text" 
                className="header-button"
              />
              <Button 
                icon={<Menu />} 
                type="text" 
                className="header-button"
              />
            </Space>
          </div>
        </div>
      </Header>

      <Layout className="inbox-layout">
        {/* Chat List Sidebar */}
        <Layout.Sider width={350} className="chat-sidebar">
          <div className="sidebar-header">
            <div className="search-container">
              <Search className="search-icon" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="chat-list">
            <List
              dataSource={chatList}
              renderItem={(chat) => (
                <List.Item
                  className={`chat-item ${selectedChat?.from === chat.from ? 'selected' : ''}`}
                  onClick={() => setSelectedChat(chat)}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        src={chat.avatar} 
                        icon={<User />}
                        className="chat-avatar"
                      />
                    }
                    title={
                      <div className="chat-title">
                        <Text strong>{chat.fromName}</Text>
                        {chat.unreadCount > 0 && (
                          <span className="unread-badge">{chat.unreadCount}</span>
                        )}
                      </div>
                    }
                    description={
                      <div className="chat-description">
                        <Text ellipsis className="last-message">
                          {chat.lastMessage}
                        </Text>
                        <Text type="secondary" className="timestamp">
                          {new Date(chat.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </Layout.Sider>

        {/* Chat Content */}
        <Content className="chat-content">
          {selectedChat ? (
            <div className="chat-container">
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-info">
                  <Avatar 
                    src={selectedChat.avatar} 
                    icon={<User />}
                    className="chat-avatar"
                  />
                  <div className="chat-details">
                    <Text strong>{selectedChat.fromName}</Text>
                    <Text type="secondary" className="chat-status">
                      {connected ? 'Online' : 'Offline'}
                    </Text>
                  </div>
                </div>
                <div className="chat-actions">
                  <Space>
                    <Button 
                      icon={<Reply />} 
                      type="text" 
                      size="small"
                    />
                    <Button 
                      icon={<Archive />} 
                      type="text" 
                      size="small"
                    />
                  </Space>
                </div>
              </div>

              <Divider className="chat-divider" />

              {/* Messages */}
              <div className="messages-container">
                {currentChatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.direction === 'out' ? 'outgoing' : 'incoming'}`}
                  >
                    <div className="message-content">
                      <div className="message-header">
                        <Text strong className="sender-name">
                          {message.fromName}
                        </Text>
                        <Text type="secondary" className="message-time">
                          {new Date(message.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                      </div>
                      <div className="message-text">
                        {message.text}
                      </div>
                      {message.status && (
                        <div className="message-status">
                          <Text type="secondary" className="status-text">
                            {message.status}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Indicator */}
              {replyingTo && (
                <div className="reply-indicator">
                  <div className="reply-content">
                    <Text type="secondary" className="reply-label">
                      Replying to {replyingTo.fromName}
                    </Text>
                    <Text className="reply-text">
                      {replyingTo.text}
                    </Text>
                  </div>
                  <Button 
                    type="text" 
                    size="small"
                    onClick={handleClearReply}
                  >
                    ×
                  </Button>
                </div>
              )}

              {/* Message Input */}
              <div className="message-input">
                <TextArea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  className="input-field"
                />
                <Button
                  type="primary"
                  icon={<Send />}
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !connected}
                  className="send-button"
                />
              </div>
            </div>
          ) : (
            <div className="no-chat-selected">
              <MessageSquare className="no-chat-icon" />
              <Title level={4}>Select a conversation</Title>
              <Text type="secondary">
                Choose a conversation from the sidebar to start messaging
              </Text>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default WhatsAppInbox;
