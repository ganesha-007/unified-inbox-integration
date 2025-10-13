const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChannelUsage = sequelize.define('ChannelUsage', {
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
  period_ym: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Period in YYYY-MM format (e.g., "2025-10")',
  },
  messages_sent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  messages_received: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  // Additional usage metrics
  usage_metrics: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional usage metrics (attachments, characters, etc.)',
  },
}, {
  tableName: 'channels_usage',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'provider', 'period_ym'],
    },
    {
      fields: ['user_id', 'period_ym'],
    },
    {
      fields: ['provider', 'period_ym'],
    },
  ],
});

// Instance methods
ChannelUsage.prototype.incrementSent = async function(count = 1) {
  this.messages_sent += count;
  return this.save();
};

ChannelUsage.prototype.incrementReceived = async function(count = 1) {
  this.messages_received += count;
  return this.save();
};

ChannelUsage.prototype.updateMetrics = async function(metrics) {
  this.usage_metrics = { ...this.usage_metrics, ...metrics };
  return this.save();
};

ChannelUsage.prototype.getTotalMessages = function() {
  return this.messages_sent + this.messages_received;
};

// Static methods
ChannelUsage.getCurrentPeriod = function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

ChannelUsage.findByUserAndPeriod = function(userId, period = null) {
  const targetPeriod = period || this.getCurrentPeriod();
  return this.findAll({
    where: { user_id: userId, period_ym: targetPeriod },
    include: ['user'],
  });
};

ChannelUsage.findByUserAndProvider = function(userId, provider, period = null) {
  const targetPeriod = period || this.getCurrentPeriod();
  return this.findOne({
    where: { user_id: userId, provider, period_ym: targetPeriod },
    include: ['user'],
  });
};

ChannelUsage.getOrCreate = async function(userId, provider, period = null) {
  const targetPeriod = period || this.getCurrentPeriod();
  
  let usage = await this.findOne({
    where: { user_id: userId, provider, period_ym: targetPeriod },
  });
  
  if (!usage) {
    usage = await this.create({
      user_id: userId,
      provider,
      period_ym: targetPeriod,
      messages_sent: 0,
      messages_received: 0,
    });
  }
  
  return usage;
};

ChannelUsage.getTotalUsageForUser = function(userId, period = null) {
  const targetPeriod = period || this.getCurrentPeriod();
  return this.findAll({
    where: { user_id: userId, period_ym: targetPeriod },
    attributes: [
      'provider',
      [sequelize.fn('SUM', sequelize.col('messages_sent')), 'total_sent'],
      [sequelize.fn('SUM', sequelize.col('messages_received')), 'total_received'],
    ],
    group: ['provider'],
  });
};

module.exports = ChannelUsage;
