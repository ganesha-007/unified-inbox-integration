import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';
import { ChannelMessage as ChannelMessageType, MessageDirection, MessageStatus, MessageSyncStatus } from '../types';

// Define the attributes interface
interface ChannelMessageAttributes {
  id: string;
  chatId: string;
  providerMsgId: string;
  direction: MessageDirection;
  body: string;
  subject?: string;
  attachments: any[];
  sentAt: Date;
  status: MessageStatus;
  readAt?: Date;
  providerMetadata: Record<string, any>;
  threadId?: string;
  parentMessageId?: string;
  isReply: boolean;
  syncStatus: MessageSyncStatus;
  syncAttempts: number;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Define the creation attributes interface
interface ChannelMessageCreationAttributes extends Optional<ChannelMessageAttributes, 'id' | 'subject' | 'readAt' | 'threadId' | 'parentMessageId' | 'lastSyncAt' | 'createdAt' | 'updatedAt' | 'attachments' | 'syncStatus' | 'syncAttempts' | 'isReply'> {}

// Define the instance methods interface
interface ChannelMessageInstanceMethods {
  markAsRead(): Promise<ChannelMessage>;
  updateStatus(status: MessageStatus): Promise<ChannelMessage>;
  addAttachment(attachment: any): Promise<ChannelMessage>;
  getProviderMetadata(): Record<string, any>;
  setProviderMetadata(metadata: Record<string, any>): Promise<ChannelMessage>;
}

// Define the model class
class ChannelMessage extends Model<ChannelMessageAttributes, ChannelMessageCreationAttributes> implements ChannelMessageAttributes, ChannelMessageInstanceMethods {
  public id!: string;
  public chatId!: string;
  public providerMsgId!: string;
  public direction!: MessageDirection;
  public body!: string;
  public subject?: string;
  public attachments!: any[];
  public sentAt!: Date;
  public status!: MessageStatus;
  public readAt?: Date;
  public providerMetadata!: Record<string, any>;
  public threadId?: string;
  public parentMessageId?: string;
  public isReply!: boolean;
  public syncStatus!: MessageSyncStatus;
  public syncAttempts!: number;
  public lastSyncAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async markAsRead(): Promise<ChannelMessage> {
    this.status = 'read';
    this.readAt = new Date();
    return this.save();
  }

  public async updateStatus(status: MessageStatus): Promise<ChannelMessage> {
    this.status = status;
    if (status === 'read' && !this.readAt) {
      this.readAt = new Date();
    }
    return this.save();
  }

  public async addAttachment(attachment: any): Promise<ChannelMessage> {
    const attachments = this.attachments || [];
    attachments.push(attachment);
    this.attachments = attachments;
    return this.save();
  }

  public getProviderMetadata(): Record<string, any> {
    return this.providerMetadata || {};
  }

  public async setProviderMetadata(metadata: Record<string, any>): Promise<ChannelMessage> {
    this.providerMetadata = { ...this.providerMetadata, ...metadata };
    return this.save();
  }

  // Static methods
  public static findByChat(chatId: string, limit: number = 50, offset: number = 0): Promise<{ rows: ChannelMessage[]; count: number }> {
    return this.findAndCountAll({
      where: { chatId },
      order: [['sentAt', 'ASC']],
      limit,
      offset,
      include: ['chat'],
    });
  }

  public static findByThread(threadId: string, limit: number = 50, offset: number = 0): Promise<{ rows: ChannelMessage[]; count: number }> {
    return this.findAndCountAll({
      where: { threadId },
      order: [['sentAt', 'ASC']],
      limit,
      offset,
      include: ['chat'],
    });
  }

  public static findUnreadMessages(chatId: string): Promise<ChannelMessage[]> {
    return this.findAll({
      where: { 
        chatId, 
        direction: 'in',
        status: { [Op.ne]: 'read' }
      },
      order: [['sentAt', 'ASC']],
      include: ['chat'],
    });
  }

  public static getUnreadCount(chatId: string): Promise<number> {
    return this.count({
      where: { 
        chatId, 
        direction: 'in',
        status: { [Op.ne]: 'read' }
      },
    });
  }
}

// Initialize the model
ChannelMessage.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  chatId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'chat_id',
    references: {
      model: 'channels_chat',
      key: 'id',
    },
  },
  providerMsgId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'provider_msg_id',
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
  sentAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'sent_at',
  },
  
  // Message status
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'received'),
    defaultValue: 'pending',
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'read_at',
  },
  
  // Provider-specific metadata
  providerMetadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'provider_metadata',
    comment: 'Provider-specific message data',
  },
  
  // Threading
  threadId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'thread_id',
    comment: 'Thread/conversation ID for grouping messages',
  },
  parentMessageId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'parent_message_id',
    references: {
      model: 'channels_message',
      key: 'id',
    },
  },
  isReply: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_reply',
  },
  
  // Sync information
  syncStatus: {
    type: DataTypes.ENUM('pending', 'synced', 'failed'),
    defaultValue: 'pending',
    field: 'sync_status',
  },
  syncAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sync_attempts',
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_sync_at',
  },
} as any, {
  sequelize,
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

export default ChannelMessage;
