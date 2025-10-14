import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Card, Typography, Space, Button, message } from 'antd';
import { 
  MessageSquare, 
  Mail, 
  Instagram, 
  Settings,
  Plus,
  Bell
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useConnections } from '../../hooks/useConnections';
import ProviderTabs from './ProviderTabs';
import ChatList from './ChatList';
import Conversation from './Conversation';
import Composer from './Composer';
import FeatureGuard from './FeatureGuard';
import ConnectionModal from './ConnectionModal';
import './UnifiedInbox.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const UnifiedInbox = () => {
  const { user } = useAuth();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const { connections, loading: connectionsLoading, refetch } = useConnections();
  const [selectedProvider, setSelectedProvider] = useState('whatsapp');
  const [selectedChat, setSelectedChat] = useState(null);
  const [connectionModalVisible, setConnectionModalVisible] = useState(false);
  const [selectedProviderForConnection, setSelectedProviderForConnection] = useState(null);

  const providers = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageSquare size={16} />,
      color: '#25D366',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      icon: <Instagram size={16} />,
      color: '#E4405F',
    },
    {
      key: 'email',
      label: 'Email',
      icon: <Mail size={16} />,
      color: '#4285F4',
    },
  ];

  const handleProviderChange = (provider) => {
    setSelectedProvider(provider);
    setSelectedChat(null);
  };

  const handleConnectProvider = (provider) => {
    setSelectedProviderForConnection(provider);
    setConnectionModalVisible(true);
  };

  const handleConnectionSuccess = () => {
    setConnectionModalVisible(false);
    setSelectedProviderForConnection(null);
    refetch();
    message.success('Account connected successfully!');
  };

  const getProviderStatus = (provider) => {
    const hasAccess = entitlements?.access?.[provider];
    const hasConnection = connections?.some(conn => 
      conn.provider === provider && conn.status === 'connected'
    );

    if (!hasAccess) {
      return 'locked';
    } else if (!hasConnection) {
      return 'disconnected';
    } else {
      return 'connected';
    }
  };

  const getProviderConnectionCount = (provider) => {
    return connections?.filter(conn => 
      conn.provider === provider && conn.status === 'connected'
    ).length || 0;
  };

  if (entitlementsLoading || connectionsLoading) {
    return (
      <Layout className="unified-inbox">
        <Content style={{ padding: '50px', textAlign: 'center' }}>
          <div>Loading...</div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="unified-inbox">
      <Header className="inbox-header">
        <div className="header-content">
          <div className="header-left">
            <Title level={3} style={{ margin: 0, color: 'white' }}>
              Unified Inbox
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
              Manage all your conversations in one place
            </Text>
          </div>
          <div className="header-right">
            <Space>
              <Button 
                type="primary" 
                icon={<Plus size={16} />}
                onClick={() => setConnectionModalVisible(true)}
              >
                Connect Account
              </Button>
              <Button icon={<Settings size={16} />}>
                Settings
              </Button>
            </Space>
          </div>
        </div>
      </Header>

      <Layout>
        <Sider width={300} className="inbox-sidebar">
          <div className="sidebar-content">
            <ProviderTabs
              providers={providers}
              selectedProvider={selectedProvider}
              onProviderChange={handleProviderChange}
              providerStatus={getProviderStatus}
              connectionCounts={providers.reduce((acc, provider) => {
                acc[provider.key] = getProviderConnectionCount(provider.key);
                return acc;
              }, {})}
            />
            
            <div className="sidebar-actions">
              {providers.map(provider => (
                <FeatureGuard key={provider.key} feature={provider.key}>
                  <Button
                    type="text"
                    icon={provider.icon}
                    onClick={() => handleConnectProvider(provider.key)}
                    className="connect-button"
                    style={{ 
                      color: getProviderStatus(provider.key) === 'connected' ? provider.color : undefined 
                    }}
                  >
                    {getProviderStatus(provider.key) === 'connected' 
                      ? `Manage ${provider.label}` 
                      : `Connect ${provider.label}`
                    }
                  </Button>
                </FeatureGuard>
              ))}
            </div>
          </div>
        </Sider>

        <Layout>
          <Content className="inbox-content">
            <div className="content-header">
              <div className="content-header-left">
                <Title level={4} style={{ margin: 0 }}>
                  {providers.find(p => p.key === selectedProvider)?.label} Conversations
                </Title>
                <Text type="secondary">
                  {getProviderConnectionCount(selectedProvider)} connected account(s)
                </Text>
              </div>
              <div className="content-header-right">
                <Button 
                  type="primary" 
                  icon={<Plus size={16} />}
                  onClick={() => handleConnectProvider(selectedProvider)}
                >
                  Add Account
                </Button>
              </div>
            </div>

            <div className="content-body">
              <div className="chat-list-container">
                <FeatureGuard feature={selectedProvider}>
                  <ChatList
                    provider={selectedProvider}
                    selectedChat={selectedChat}
                    onChatSelect={setSelectedChat}
                  />
                </FeatureGuard>
              </div>

              <div className="conversation-container">
                {selectedChat ? (
                  <Conversation
                    chat={selectedChat}
                    provider={selectedProvider}
                  />
                ) : (
                  <div className="no-chat-selected">
                    <MessageSquare size={48} style={{ color: '#d9d9d9' }} />
                    <Title level={4} type="secondary">
                      Select a conversation to start messaging
                    </Title>
                    <Text type="secondary">
                      Choose a conversation from the list to view and send messages
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </Content>
        </Layout>
      </Layout>

      <ConnectionModal
        visible={connectionModalVisible}
        provider={selectedProviderForConnection}
        onClose={() => {
          setConnectionModalVisible(false);
          setSelectedProviderForConnection(null);
        }}
        onSuccess={handleConnectionSuccess}
      />
    </Layout>
  );
};

export default UnifiedInbox;
