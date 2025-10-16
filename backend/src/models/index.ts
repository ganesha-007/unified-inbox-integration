import { sequelize } from '../config/database';

// Import all models
import User from './User';
import ChannelAccount from './ChannelAccount';
import ChannelChat from './ChannelChat';
import ChannelMessage from './ChannelMessage';
import ChannelEntitlement from './ChannelEntitlement';
import ChannelUsage from './ChannelUsage';
import Message from './Message';

// Define associations
User.hasMany(ChannelAccount, { foreignKey: 'userId', as: 'accounts' });
ChannelAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

ChannelAccount.hasMany(ChannelChat, { foreignKey: 'accountId', as: 'chats' });
ChannelChat.belongsTo(ChannelAccount, { foreignKey: 'accountId', as: 'account' });

ChannelChat.hasMany(ChannelMessage, { foreignKey: 'chatId', as: 'messages' });
ChannelMessage.belongsTo(ChannelChat, { foreignKey: 'chatId', as: 'chat' });

User.hasMany(ChannelEntitlement, { foreignKey: 'userId', as: 'entitlements' });
ChannelEntitlement.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ChannelUsage, { foreignKey: 'userId', as: 'usage' });
ChannelUsage.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Export all models
export {
  User,
  ChannelAccount,
  ChannelChat,
  ChannelMessage,
  ChannelEntitlement,
  ChannelUsage,
  Message,
  sequelize
};

export default {
  User,
  ChannelAccount,
  ChannelChat,
  ChannelMessage,
  ChannelEntitlement,
  ChannelUsage,
  Message,
  sequelize
};
