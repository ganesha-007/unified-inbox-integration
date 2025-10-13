const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChannelAccount = sequelize.define('ChannelAccount', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  provider: {
    type: DataTypes.ENUM('whatsapp', 'instagram', 'email'),
    allowNull: false,
  },
  external_account_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'UniPile ID or email address',
  },
  status: {
    type: DataTypes.ENUM('connected', 'needs_action', 'disconnected'),
    defaultValue: 'disconnected',
  },
  
  // Provider-specific connection data
  connection_data: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Stores tokens, credentials, and provider-specific data',
  },
  
  // Account metadata
  account_info: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Account name, avatar, and other display information',
  },
  
  // Sync information
  last_sync_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sync_status: {
    type: DataTypes.ENUM('pending', 'syncing', 'synced', 'failed'),
    defaultValue: 'pending',
  },
  sync_error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'channels_account',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'provider', 'external_account_id'],
    },
    {
      fields: ['provider', 'status'],
    },
  ],
});

// Instance methods
ChannelAccount.prototype.updateSyncStatus = async function(status, error = null) {
  this.sync_status = status;
  this.sync_error = error;
  if (status === 'synced') {
    this.last_sync_at = new Date();
  }
  return this.save();
};

ChannelAccount.prototype.isConnected = function() {
  return this.status === 'connected';
};

ChannelAccount.prototype.getConnectionData = function() {
  return this.connection_data || {};
};

ChannelAccount.prototype.setConnectionData = async function(data) {
  this.connection_data = { ...this.connection_data, ...data };
  return this.save();
};

// Static methods
ChannelAccount.findByUserAndProvider = function(userId, provider) {
  return this.findAll({
    where: { user_id: userId, provider },
    include: ['user'],
  });
};

ChannelAccount.findConnectedAccounts = function(userId) {
  return this.findAll({
    where: { user_id: userId, status: 'connected' },
    include: ['user'],
  });
};

module.exports = ChannelAccount;
