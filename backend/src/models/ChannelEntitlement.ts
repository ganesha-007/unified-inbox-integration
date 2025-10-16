import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';
import { ChannelEntitlement as ChannelEntitlementType, Provider, EntitlementSource } from '../types';

// Define the attributes interface
interface ChannelEntitlementAttributes {
  id: string;
  userId: string;
  provider: Provider;
  isActive: boolean;
  source: EntitlementSource;
  expiresAt?: Date;
  limits: Record<string, any>;
  billingInfo: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Define the creation attributes interface
interface ChannelEntitlementCreationAttributes extends Optional<ChannelEntitlementAttributes, 'id' | 'expiresAt' | 'createdAt' | 'updatedAt' | 'isActive' | 'billingInfo'> {}

// Define the instance methods interface
interface ChannelEntitlementInstanceMethods {
  isExpired(): boolean;
  isValid(): boolean;
  getLimits(): Record<string, any>;
  setLimits(limits: Record<string, any>): Promise<ChannelEntitlement>;
  activate(): Promise<ChannelEntitlement>;
  deactivate(): Promise<ChannelEntitlement>;
}

// Define the model class
class ChannelEntitlement extends Model<ChannelEntitlementAttributes, ChannelEntitlementCreationAttributes> implements ChannelEntitlementAttributes, ChannelEntitlementInstanceMethods {
  public id!: string;
  public userId!: string;
  public provider!: Provider;
  public isActive!: boolean;
  public source!: EntitlementSource;
  public expiresAt?: Date;
  public limits!: Record<string, any>;
  public billingInfo!: Record<string, any>;
  public metadata!: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  public isValid(): boolean {
    return this.isActive && !this.isExpired();
  }

  public getLimits(): Record<string, any> {
    return this.limits || {};
  }

  public async setLimits(limits: Record<string, any>): Promise<ChannelEntitlement> {
    this.limits = { ...this.limits, ...limits };
    return this.save();
  }

  public async activate(): Promise<ChannelEntitlement> {
    this.isActive = true;
    return this.save();
  }

  public async deactivate(): Promise<ChannelEntitlement> {
    this.isActive = false;
    return this.save();
  }

  // Static methods
  public static findActiveByUser(userId: string): Promise<ChannelEntitlement[]> {
    return this.findAll({
      where: { 
        userId, 
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ] as any
      },
      include: ['user'],
    });
  }

  public static findByUserAndProvider(userId: string, provider: Provider): Promise<ChannelEntitlement | null> {
    return this.findOne({
      where: { userId, provider },
      include: ['user'],
    });
  }

  public static async createFromPlan(userId: string, plan: string, planConfig: any): Promise<ChannelEntitlement[]> {
    const entitlements: ChannelEntitlement[] = [];
    
    for (const provider of planConfig.includes || []) {
      const entitlement = await this.create({
        userId,
        provider,
        source: 'plan',
        limits: planConfig.limits || {},
        metadata: { plan },
      });
      entitlements.push(entitlement);
    }
    
    return entitlements;
  }

  public static async createFromAddon(userId: string, addon: string, addonConfig: any): Promise<ChannelEntitlement> {
    return this.create({
      userId,
      provider: addon as Provider,
      source: 'addon',
      limits: addonConfig.limits || {},
      metadata: { addon },
    });
  }
}

// Initialize the model
ChannelEntitlement.init({
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
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  source: {
    type: DataTypes.ENUM('plan', 'addon'),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
  },
  
  // Entitlement limits
  limits: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  
  // Billing information
  billingInfo: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'billing_info',
  },
  
  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
} as any, {
  sequelize,
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

export default ChannelEntitlement;
