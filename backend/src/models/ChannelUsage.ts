import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { ChannelUsage as ChannelUsageType, Provider } from '../types';

// Define the attributes interface
interface ChannelUsageAttributes {
  id: string;
  userId: string;
  provider: Provider;
  periodYm: string;
  messagesSent: number;
  messagesReceived: number;
  usageMetrics: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Define the creation attributes interface
interface ChannelUsageCreationAttributes extends Optional<ChannelUsageAttributes, 'id' | 'createdAt' | 'updatedAt' | 'usageMetrics'> {}

// Define the instance methods interface
interface ChannelUsageInstanceMethods {
  incrementSent(count?: number): Promise<ChannelUsage>;
  incrementReceived(count?: number): Promise<ChannelUsage>;
  updateMetrics(metrics: Record<string, any>): Promise<ChannelUsage>;
  getTotalMessages(): number;
}

// Define the model class
class ChannelUsage extends Model<ChannelUsageAttributes, ChannelUsageCreationAttributes> implements ChannelUsageAttributes, ChannelUsageInstanceMethods {
  public id!: string;
  public userId!: string;
  public provider!: Provider;
  public periodYm!: string;
  public messagesSent!: number;
  public messagesReceived!: number;
  public usageMetrics!: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async incrementSent(count: number = 1): Promise<ChannelUsage> {
    this.messagesSent += count;
    return this.save();
  }

  public async incrementReceived(count: number = 1): Promise<ChannelUsage> {
    this.messagesReceived += count;
    return this.save();
  }

  public async updateMetrics(metrics: Record<string, any>): Promise<ChannelUsage> {
    this.usageMetrics = { ...this.usageMetrics, ...metrics };
    return this.save();
  }

  public getTotalMessages(): number {
    return this.messagesSent + this.messagesReceived;
  }

  // Static methods
  public static getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  public static findByUserAndPeriod(userId: string, period?: string | null): Promise<ChannelUsage[]> {
    const targetPeriod = period || this.getCurrentPeriod();
    return this.findAll({
      where: { userId, periodYm: targetPeriod },
      include: ['user'],
    });
  }

  public static findByUserAndProvider(userId: string, provider: Provider, period?: string | null): Promise<ChannelUsage | null> {
    const targetPeriod = period || this.getCurrentPeriod();
    return this.findOne({
      where: { userId, provider, periodYm: targetPeriod },
      include: ['user'],
    });
  }

  public static async getOrCreate(userId: string, provider: Provider, period?: string | null): Promise<ChannelUsage> {
    const targetPeriod = period || this.getCurrentPeriod();
    
    let usage = await this.findOne({
      where: { userId, provider, periodYm: targetPeriod },
    });
    
    if (!usage) {
      usage = await this.create({
        userId,
        provider,
        periodYm: targetPeriod,
        messagesSent: 0,
        messagesReceived: 0,
      });
    }
    
    return usage;
  }

  public static getTotalUsageForUser(userId: string, period?: string | null): Promise<any[]> {
    const targetPeriod = period || this.getCurrentPeriod();
    return this.findAll({
      where: { userId, periodYm: targetPeriod },
      attributes: [
        'provider',
        [sequelize.fn('SUM', sequelize.col('messages_sent')), 'total_sent'],
        [sequelize.fn('SUM', sequelize.col('messages_received')), 'total_received'],
      ],
      group: ['provider'],
    });
  }
}

// Initialize the model
ChannelUsage.init({
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
  periodYm: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'period_ym',
    comment: 'Period in YYYY-MM format (e.g., "2025-10")',
  },
  messagesSent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'messages_sent',
  },
  messagesReceived: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'messages_received',
  },
  
  // Additional usage metrics
  usageMetrics: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'usage_metrics',
    comment: 'Additional usage metrics (attachments, characters, etc.)',
  },
} as any, {
  sequelize,
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

export default ChannelUsage;
