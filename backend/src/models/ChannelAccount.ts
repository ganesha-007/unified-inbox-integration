import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { ChannelAccount as ChannelAccountType, Provider, AccountStatus, SyncStatus } from '../types';

// Define the attributes interface
interface ChannelAccountAttributes {
  id: string;
  userId: string;
  provider: Provider;
  externalAccountId: string;
  status: AccountStatus;
  connectionData: Record<string, any>;
  accountInfo: Record<string, any>;
  lastSyncAt?: Date;
  syncStatus: SyncStatus;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define the creation attributes interface
interface ChannelAccountCreationAttributes extends Optional<ChannelAccountAttributes, 'id' | 'lastSyncAt' | 'syncError' | 'createdAt' | 'updatedAt' | 'syncStatus'> {}

// Define the instance methods interface
interface ChannelAccountInstanceMethods {
  updateSyncStatus(status: SyncStatus, error?: string | null): Promise<ChannelAccount>;
  isConnected(): boolean;
  getConnectionData(): Record<string, any>;
  setConnectionData(data: Record<string, any>): Promise<ChannelAccount>;
}

// Define the model class
class ChannelAccount extends Model<ChannelAccountAttributes, ChannelAccountCreationAttributes> implements ChannelAccountAttributes, ChannelAccountInstanceMethods {
  public id!: string;
  public userId!: string;
  public provider!: Provider;
  public externalAccountId!: string;
  public status!: AccountStatus;
  public connectionData!: Record<string, any>;
  public accountInfo!: Record<string, any>;
  public lastSyncAt?: Date;
  public syncStatus!: SyncStatus;
  public syncError?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async updateSyncStatus(status: SyncStatus, error?: string | null): Promise<ChannelAccount> {
    this.syncStatus = status;
    this.syncError = error || undefined;
    if (status === 'synced') {
      this.lastSyncAt = new Date();
    }
    return this.save();
  }

  public isConnected(): boolean {
    return this.status === 'connected';
  }

  public getConnectionData(): Record<string, any> {
    return this.connectionData || {};
  }

  public async setConnectionData(data: Record<string, any>): Promise<ChannelAccount> {
    this.connectionData = { ...this.connectionData, ...data };
    return this.save();
  }

  // Static methods
  public static findByUserAndProvider(userId: string, provider: Provider): Promise<ChannelAccount[]> {
    return this.findAll({
      where: { userId, provider },
      include: ['user'],
    });
  }

  public static findConnectedAccounts(userId: string): Promise<ChannelAccount[]> {
    return this.findAll({
      where: { userId, status: 'connected' },
      include: ['user'],
    });
  }
}

// Initialize the model
ChannelAccount.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  provider: {
    type: DataTypes.ENUM('whatsapp', 'instagram', 'email'),
    allowNull: false,
  },
  externalAccountId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'external_account_id',
    comment: 'UniPile ID or email address',
  },
  status: {
    type: DataTypes.ENUM('connected', 'needs_action', 'disconnected'),
    defaultValue: 'disconnected',
  },
  
  // Provider-specific connection data
  connectionData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'connection_data',
    comment: 'Stores tokens, credentials, and provider-specific data',
  },
  
  // Account metadata
  accountInfo: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'account_info',
    comment: 'Account name, avatar, and other display information',
  },
  
  // Sync information
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_sync_at',
  },
  syncStatus: {
    type: DataTypes.ENUM('pending', 'syncing', 'synced', 'failed'),
    defaultValue: 'pending',
    field: 'sync_status',
  },
  syncError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'sync_error',
  },
} as any, {
  sequelize,
  tableName: 'channels_account',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'provider', 'external_account_id'],
    },
    {
      fields: ['provider', 'status'],
    },
  ],
});

export default ChannelAccount;
