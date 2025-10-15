const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChannelMessage = sequelize.define('ChannelMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  chat_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'channels_chat',
      key: 'id',
    },
  },
  provider_msg_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Message ID from provider',
  },
  direction: {
    type: DataTypes.ENUM('in', 'out'),
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email subject or message title',
  },
  attachments: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of attachment objects',
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  
  // Message status
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'received'),
    defaultValue: 'pending',
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  
  // Provider-specific metadata
  provider_metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Provider-specific message data',
  },
  
  // Threading
  thread_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Thread/conversation ID for grouping messages',
  },
  parent_message_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'channels_message',
      key: 'id',
    },
  },
  is_reply: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  
  // Sync information
  sync_status: {
    type: DataTypes.ENUM('pending', 'synced', 'failed'),
    defaultValue: 'pending',
  },
  sync_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  last_sync_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'channels_message',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['chat_id', 'provider_msg_id'],
    },
    {
      fields: ['chat_id', 'sent_at'],
    },
    {
      fields: ['thread_id', 'sent_at'],
    },
    {
      fields: ['direction', 'sent_at'],
    },
  ],
});

// Instance methods
ChannelMessage.prototype.markAsRead = async function() {
  this.status = 'read';
  this.read_at = new Date();
  return this.save();
};

ChannelMessage.prototype.updateStatus = async function(status) {
  this.status = status;
  if (status === 'read' && !this.read_at) {
    this.read_at = new Date();
  }
  return this.save();
};

ChannelMessage.prototype.addAttachment = async function(attachment) {
  const attachments = this.attachments || [];
  attachments.push(attachment);
  this.attachments = attachments;
  return this.save();
};

ChannelMessage.prototype.getProviderMetadata = function() {
  return this.provider_metadata || {};
};

ChannelMessage.prototype.setProviderMetadata = async function(metadata) {
  this.provider_metadata = { ...this.provider_metadata, ...metadata };
  return this.save();
};

// Static methods
ChannelMessage.findByChat = function(chatId, limit = 50, offset = 0) {
  return this.findAndCountAll({
    where: { chat_id: chatId },
    order: [['sent_at', 'ASC']],
    limit,
    offset,
    include: ['chat'],
  });
};

ChannelMessage.findByThread = function(threadId, limit = 50, offset = 0) {
  return this.findAndCountAll({
    where: { thread_id: threadId },
    order: [['sent_at', 'ASC']],
    limit,
    offset,
    include: ['chat'],
  });
};

ChannelMessage.findUnreadMessages = function(chatId) {
  return this.findAll({
    where: { 
      chat_id: chatId, 
      direction: 'in',
      status: { [sequelize.Op.ne]: 'read' }
    },
    order: [['sent_at', 'ASC']],
    include: ['chat'],
  });
};

ChannelMessage.getUnreadCount = function(chatId) {
  return this.count({
    where: { 
      chat_id: chatId, 
      direction: 'in',
      status: { [sequelize.Op.ne]: 'read' }
    },
  });
};

module.exports = ChannelMessage;
