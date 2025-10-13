const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChannelEntitlement = sequelize.define('ChannelEntitlement', {
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
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  source: {
    type: DataTypes.ENUM('plan', 'addon'),
    allowNull: false,
    comment: 'Whether this entitlement comes from a plan or add-on',
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When this entitlement expires (null for permanent)',
  },
  
  // Entitlement limits
  limits: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Usage limits for this entitlement',
  },
  
  // Billing information
  billing_info: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Stripe subscription ID, product ID, etc.',
  },
  
  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional entitlement metadata',
  },
}, {
  tableName: 'channels_entitlement',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'provider', 'source'],
    },
    {
      fields: ['user_id', 'is_active'],
    },
    {
      fields: ['expires_at'],
    },
  ],
});

// Instance methods
ChannelEntitlement.prototype.isExpired = function() {
  if (!this.expires_at) return false;
  return new Date() > this.expires_at;
};

ChannelEntitlement.prototype.isValid = function() {
  return this.is_active && !this.isExpired();
};

ChannelEntitlement.prototype.getLimits = function() {
  return this.limits || {};
};

ChannelEntitlement.prototype.setLimits = async function(limits) {
  this.limits = { ...this.limits, ...limits };
  return this.save();
};

ChannelEntitlement.prototype.activate = async function() {
  this.is_active = true;
  return this.save();
};

ChannelEntitlement.prototype.deactivate = async function() {
  this.is_active = false;
  return this.save();
};

// Static methods
ChannelEntitlement.findActiveByUser = function(userId) {
  return this.findAll({
    where: { 
      user_id: userId, 
      is_active: true,
      [sequelize.Op.or]: [
        { expires_at: null },
        { expires_at: { [sequelize.Op.gt]: new Date() } }
      ]
    },
    include: ['user'],
  });
};

ChannelEntitlement.findByUserAndProvider = function(userId, provider) {
  return this.findOne({
    where: { user_id: userId, provider },
    include: ['user'],
  });
};

ChannelEntitlement.createFromPlan = async function(userId, plan, planConfig) {
  const entitlements = [];
  
  for (const provider of planConfig.includes || []) {
    const entitlement = await this.create({
      user_id: userId,
      provider,
      source: 'plan',
      limits: planConfig.limits || {},
      metadata: { plan },
    });
    entitlements.push(entitlement);
  }
  
  return entitlements;
};

ChannelEntitlement.createFromAddon = async function(userId, addon, addonConfig) {
  return this.create({
    user_id: userId,
    provider: addon,
    source: 'addon',
    limits: addonConfig.limits || {},
    metadata: { addon },
  });
};

module.exports = ChannelEntitlement;
