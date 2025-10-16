import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Define the attributes interface
interface MessageAttributes {
  id: string;
  platform: string;
  threadId: string;
  direction: 'in' | 'out';
  content: string;
  subject?: string;
  timestamp: Date;
  read: boolean;
  readAt?: Date;
  avatar?: string;
  parentMessageId?: string;
  isReply: boolean;
  replyCount: number;
  platformMetadata: Record<string, any>;
  syncStatus: 'pending' | 'synced' | 'failed' | 'retrying';
  lastSyncAt?: Date;
  syncAttempts: number;
  userId: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Define the creation attributes interface
interface MessageCreationAttributes extends Optional<MessageAttributes, 'id' | 'subject' | 'readAt' | 'avatar' | 'parentMessageId' | 'lastSyncAt' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'isReply' | 'replyCount' | 'platformMetadata' | 'syncStatus' | 'syncAttempts' | 'deleted'> {}

// Define the instance methods interface
interface MessageInstanceMethods {
  markAsRead(): Promise<Message>;
  markAsUnread(): Promise<Message>;
  updateSyncStatus(status: 'pending' | 'synced' | 'failed' | 'retrying', error?: string | null): Promise<Message>;
}

// Define the model class
class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes, MessageInstanceMethods {
  public id!: string;
  public platform!: string;
  public threadId!: string;
  public direction!: 'in' | 'out';
  public content!: string;
  public subject?: string;
  public timestamp!: Date;
  public read!: boolean;
  public readAt?: Date;
  public avatar?: string;
  public parentMessageId?: string;
  public isReply!: boolean;
  public replyCount!: number;
  public platformMetadata!: Record<string, any>;
  public syncStatus!: 'pending' | 'synced' | 'failed' | 'retrying';
  public lastSyncAt?: Date;
  public syncAttempts!: number;
  public userId!: string;
  public deleted!: boolean;
  public deletedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async markAsRead(): Promise<Message> {
    this.read = true;
    this.readAt = new Date();
    return this.save();
  }

  public async markAsUnread(): Promise<Message> {
    this.read = false;
    this.readAt = null as any;
    return this.save();
  }

  public async updateSyncStatus(status: 'pending' | 'synced' | 'failed' | 'retrying', error?: string | null): Promise<Message> {
    this.syncStatus = status;
    this.lastSyncAt = new Date();
    if (status === 'failed') {
      this.syncAttempts += 1;
    }
    return this.save();
  }

  // Static methods
  public static findByThread(threadId: string, userId: string): Promise<Message[]> {
    return this.findAll({
      where: { 
        threadId, 
        userId, 
        deleted: false 
      },
      order: [['timestamp', 'ASC']]
    });
  }

  public static findUnreadByUser(userId: string, platform?: string): Promise<Message[]> {
    const where: any = { 
      userId, 
      read: false, 
      deleted: false 
    };
    if (platform) {
      where.platform = platform;
    }
    return this.findAll({
      where,
      order: [['timestamp', 'DESC']]
    });
  }

  public static getUnreadCount(userId: string, platform?: string): Promise<number> {
    const where: any = { 
      userId, 
      read: false, 
      deleted: false 
    };
    if (platform) {
      where.platform = platform;
    }
    return this.count({ where });
  }
}

// Initialize the model
Message.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  threadId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direction: {
    type: DataTypes.ENUM('in', 'out'),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentMessageId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  isReply: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  replyCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  platformMetadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  syncStatus: {
    type: DataTypes.ENUM('pending', 'synced', 'failed', 'retrying'),
    defaultValue: 'pending',
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  syncAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
} as any, {
  sequelize,
  tableName: 'messages',
  timestamps: true,
  indexes: [
    {
      fields: ['threadId', 'timestamp'],
    },
    {
      fields: ['platform', 'timestamp'],
    },
    {
      fields: ['userId', 'platform', 'timestamp'],
    },
    {
      fields: ['userId', 'read', 'timestamp'],
    },
    {
      fields: ['syncStatus', 'lastSyncAt'],
    },
  ],
});

export default Message;
