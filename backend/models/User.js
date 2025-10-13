const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 30],
    },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 255],
    },
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  
  // User preferences
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      theme: 'light',
      notifications: {
        email: true,
        push: true,
        desktop: true,
      },
      language: 'en',
      timezone: 'UTC',
    },
  },
  
  // Account status
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending'),
    defaultValue: 'active',
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  passwordResetToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  
  // Activity tracking
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastActivityAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  loginCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  // Subscription/Plan information
  subscription: {
    type: DataTypes.JSONB,
    defaultValue: {
      plan: 'starter',
      status: 'active',
      expiresAt: null,
      features: {
        maxMessages: 1000,
        maxPlatforms: 2,
        realTimeSync: false,
        advancedSearch: false,
      },
    },
  },
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
  },
});

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  this.loginCount += 1;
  this.lastActivityAt = new Date();
  return this.save();
};

User.prototype.updateLastActivity = async function() {
  this.lastActivityAt = new Date();
  return this.save();
};

User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password;
  delete values.passwordResetToken;
  delete values.emailVerificationToken;
  return values;
};

// Static methods
User.findByEmail = function(email) {
  return this.findOne({ where: { email: email.toLowerCase() } });
};

User.findByUsername = function(username) {
  return this.findOne({ where: { username: username.toLowerCase() } });
};

User.findActiveUsers = function() {
  return this.findAll({ where: { status: 'active' } });
};

module.exports = User;