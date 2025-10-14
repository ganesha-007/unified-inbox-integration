import React from 'react';
import { Badge } from 'antd';
import { Lock } from 'lucide-react';
import './UnifiedInbox.css';

const ProviderTabs = ({ 
  providers, 
  selectedProvider, 
  onProviderChange, 
  providerStatus, 
  connectionCounts 
}) => {
  const getStatusText = (status) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Not connected';
      case 'locked':
        return 'Upgrade required';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return '#52c41a';
      case 'disconnected':
        return '#faad14';
      case 'locked':
        return '#ff4d4f';
      default:
        return '#d9d9d9';
    }
  };

  return (
    <div className="provider-tabs">
      {providers.map(provider => {
        const status = providerStatus(provider.key);
        const count = connectionCounts[provider.key] || 0;
        const isActive = selectedProvider === provider.key;
        const isLocked = status === 'locked';

        return (
          <div
            key={provider.key}
            className={`provider-tab ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
            onClick={() => !isLocked && onProviderChange(provider.key)}
            style={{
              borderLeft: isActive ? `3px solid ${provider.color}` : '3px solid transparent'
            }}
          >
            <div className="provider-tab-icon" style={{ color: provider.color }}>
              {provider.icon}
            </div>
            
            <div className="provider-tab-content">
              <div className="provider-tab-label">
                {provider.label}
              </div>
              <div 
                className="provider-tab-status"
                style={{ color: getStatusColor(status) }}
              >
                {getStatusText(status)}
              </div>
            </div>

            <div className="provider-tab-count">
              {count}
            </div>

            {isLocked && (
              <Lock size={14} style={{ color: '#ff4d4f', marginLeft: 8 }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProviderTabs;
