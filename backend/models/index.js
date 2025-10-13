const { sequelize } = require('../config/database');
const User = require('./User');
const ChannelAccount = require('./ChannelAccount');
const ChannelChat = require('./ChannelChat');
const ChannelMessage = require('./ChannelMessage');
const ChannelEntitlement = require('./ChannelEntitlement');
const ChannelUsage = require('./ChannelUsage');

// Define associations
User.hasMany(ChannelAccount, { foreignKey: 'user_id', as: 'accounts' });
ChannelAccount.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

ChannelAccount.hasMany(ChannelChat, { foreignKey: 'account_id', as: 'chats' });
ChannelChat.belongsTo(ChannelAccount, { foreignKey: 'account_id', as: 'account' });

ChannelChat.hasMany(ChannelMessage, { foreignKey: 'chat_id', as: 'messages' });
ChannelMessage.belongsTo(ChannelChat, { foreignKey: 'chat_id', as: 'chat' });

User.hasMany(ChannelEntitlement, { foreignKey: 'user_id', as: 'entitlements' });
ChannelEntitlement.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(ChannelUsage, { foreignKey: 'user_id', as: 'usage' });
ChannelUsage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Sync database
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  ChannelAccount,
  ChannelChat,
  ChannelMessage,
  ChannelEntitlement,
  ChannelUsage,
  syncDatabase
};
