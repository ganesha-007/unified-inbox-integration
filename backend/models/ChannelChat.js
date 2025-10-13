const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChannelChat = sequelize.define('ChannelChat', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  account_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'channels_account',
      key: 'id',
    },
  },
  provider_chat_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Thread ID or conversation ID from provider',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last_message_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  
  // Chat metadata
  chat_info: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Provider-specific chat information (participants, type, etc.)',
  },
  
  // Unread count
  unread_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  // Chat status
  status: {
    type: DataTypes.ENUM('active', 'archived', 'muted'),
    defaultValue: 'active',
  },
}, {
  tableName: 'channels_chat',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['account_id', 'provider_chat_id'],
    },
    {
      fields: ['account_id', 'last_message_at'],
    },
  ],
});

// Instance methods
ChannelChat.prototype.updateLastMessage = async function(messageDate) {
  this.last_message_at = messageDate;
  return this.save();
};

ChannelChat.prototype.incrementUnreadCount = async function() {
  this.unread_count += 1;
  return this.save();
};

ChannelChat.prototype.resetUnreadCount = async function() {
  this.unread_count = 0;
  return this.save();
};

ChannelChat.prototype.getChatInfo = function() {
  return this.chat_info || {};
};

ChannelChat.prototype.setChatInfo = async function(info) {
  this.chat_info = { ...this.chat_info, ...info };
  return this.save();
};

// Static methods
ChannelChat.findByAccount = function(accountId) {
  return this.findAll({
    where: { account_id: accountId },
    order: [['last_message_at', 'DESC']],
    include: ['account'],
  });
};

ChannelChat.findActiveChats = function(accountId) {
  return this.findAll({
    where: { account_id: accountId, status: 'active' },
    order: [['last_message_at', 'DESC']],
    include: ['account'],
  });
};

module.exports = ChannelChat;
