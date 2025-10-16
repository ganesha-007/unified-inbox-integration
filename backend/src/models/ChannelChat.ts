import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { ChannelChat as ChannelChatType, ChatStatus } from '../types';

// Define the attributes interface
interface ChannelChatAttributes {
  id: string;
  accountId: string;
  providerChatId: string;
  title?: string;
  lastMessageAt?: Date;
  chatInfo: Record<string, any>;
  unreadCount: number;
  status: ChatStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Define the creation attributes interface
interface ChannelChatCreationAttributes extends Optional<ChannelChatAttributes, 'id' | 'title' | 'lastMessageAt' | 'createdAt' | 'updatedAt' | 'chatInfo' | 'unreadCount' | 'status'> {}

// Define the instance methods interface
interface ChannelChatInstanceMethods {
  updateLastMessage(messageDate: Date): Promise<ChannelChat>;
  incrementUnreadCount(): Promise<ChannelChat>;
  resetUnreadCount(): Promise<ChannelChat>;
  getChatInfo(): Record<string, any>;
  setChatInfo(info: Record<string, any>): Promise<ChannelChat>;
}

// Define the model class
class ChannelChat extends Model<ChannelChatAttributes, ChannelChatCreationAttributes> implements ChannelChatAttributes, ChannelChatInstanceMethods {
  public id!: string;
  public accountId!: string;
  public providerChatId!: string;
  public title?: string;
  public lastMessageAt?: Date;
  public chatInfo!: Record<string, any>;
  public unreadCount!: number;
  public status!: ChatStatus;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async updateLastMessage(messageDate: Date): Promise<ChannelChat> {
    this.lastMessageAt = messageDate;
    return this.save();
  }

  public async incrementUnreadCount(): Promise<ChannelChat> {
    this.unreadCount += 1;
    return this.save();
  }

  public async resetUnreadCount(): Promise<ChannelChat> {
    this.unreadCount = 0;
    return this.save();
  }

  public getChatInfo(): Record<string, any> {
    return this.chatInfo || {};
  }

  public async setChatInfo(info: Record<string, any>): Promise<ChannelChat> {
    this.chatInfo = { ...this.chatInfo, ...info };
    return this.save();
  }

  // Static methods
  public static findByAccount(accountId: string): Promise<ChannelChat[]> {
    return this.findAll({
      where: { accountId },
      order: [['lastMessageAt', 'DESC']],
      include: ['account'],
    });
  }

  public static findActiveChats(accountId: string): Promise<ChannelChat[]> {
    return this.findAll({
      where: { accountId, status: 'active' },
      order: [['lastMessageAt', 'DESC']],
      include: ['account'],
    });
  }
}

// Initialize the model
ChannelChat.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  accountId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'account_id',
    references: {
      model: 'channels_account',
      key: 'id',
    },
  },
  providerChatId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'provider_chat_id',
    comment: 'Thread ID or conversation ID from provider',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_message_at',
  },
  
  // Chat metadata
  chatInfo: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'chat_info',
    comment: 'Provider-specific chat information (participants, type, etc.)',
  },
  
  // Unread count
  unreadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'unread_count',
  },
  
  // Chat status
  status: {
    type: DataTypes.ENUM('active', 'archived', 'muted'),
    defaultValue: 'active',
  },
} as any, {
  sequelize,
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

export default ChannelChat;
