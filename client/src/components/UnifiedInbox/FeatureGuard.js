import React from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { Lock, Crown } from 'lucide-react';
import { useEntitlements } from '../../hooks/useEntitlements';

const { Title, Text } = Typography;

const FeatureGuard = ({ children, feature, fallback = null }) => {
  const { entitlements, loading } = useEntitlements();
  const [upgradeModalVisible, setUpgradeModalVisible] = React.useState(false);

  if (loading) {
    return <div>Loading...</div>;
  }

  const hasAccess = entitlements?.access?.[feature];

  if (hasAccess) {
    return children;
  }

  const handleUpgrade = () => {
    setUpgradeModalVisible(true);
  };

  const handleUpgradeModalClose = () => {
    setUpgradeModalVisible(false);
  };

  const getFeatureInfo = (feature) => {
    const features = {
      whatsapp: {
        name: 'WhatsApp',
        description: 'Send and receive WhatsApp messages',
        icon: '💬',
      },
      instagram: {
        name: 'Instagram',
        description: 'Manage Instagram direct messages',
        icon: '📸',
      },
      email: {
        name: 'Email',
        description: 'Connect Gmail and Outlook accounts',
        icon: '📧',
      },
    };
    return features[feature] || { name: feature, description: '', icon: '🔒' };
  };

  const featureInfo = getFeatureInfo(feature);

  if (fallback) {
    return fallback;
  }

  return (
    <>
      <div 
        style={{ 
          opacity: 0.5, 
          cursor: 'not-allowed',
          position: 'relative'
        }}
        onClick={handleUpgrade}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <Space direction="vertical" align="center" size="small">
            <Lock size={24} color="#ff4d4f" />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Upgrade Required
            </Text>
          </Space>
        </div>
      </div>

      <Modal
        title={
          <Space>
            <Crown size={20} color="#faad14" />
            <span>Upgrade Required</span>
          </Space>
        }
        open={upgradeModalVisible}
        onCancel={handleUpgradeModalClose}
        footer={[
          <Button key="cancel" onClick={handleUpgradeModalClose}>
            Cancel
          </Button>,
          <Button key="upgrade" type="primary" onClick={() => {
            // Handle upgrade logic
            window.open('/pricing', '_blank');
            handleUpgradeModalClose();
          }}>
            View Plans
          </Button>,
        ]}
        width={500}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {featureInfo.icon}
          </div>
          
          <Title level={3}>
            Unlock {featureInfo.name}
          </Title>
          
          <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '24px' }}>
            {featureInfo.description}
          </Text>

          <div style={{ 
            background: '#f6f8fa', 
            padding: '16px', 
            borderRadius: '8px',
            marginBottom: '24px'
          }}>
            <Text strong>Current Plan: {entitlements?.plan || 'Starter'}</Text>
            <br />
            <Text type="secondary">
              Upgrade to access {featureInfo.name} and other premium features
            </Text>
          </div>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text strong>What you'll get:</Text>
              <ul style={{ textAlign: 'left', marginTop: '8px' }}>
                <li>Connect unlimited {featureInfo.name} accounts</li>
                <li>Send and receive messages in real-time</li>
                <li>Advanced message management features</li>
                <li>Priority support</li>
              </ul>
            </div>
          </Space>
        </div>
      </Modal>
    </>
  );
};

export default FeatureGuard;
