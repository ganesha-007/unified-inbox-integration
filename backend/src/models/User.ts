import { DataTypes, Model, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database';
import { User as UserType, UserPreferences, Subscription } from '../types';

// Define the attributes interface
interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  preferences: UserPreferences;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  lastActivityAt: Date;
  loginCount: number;
  subscription: Subscription;
  createdAt: Date;
  updatedAt: Date;
}

// Define the creation attributes interface (optional fields for creation)
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'avatar' | 'emailVerificationToken' | 'passwordResetToken' | 'passwordResetExpires' | 'lastLoginAt' | 'createdAt' | 'updatedAt' | 'preferences' | 'status' | 'emailVerified' | 'lastActivityAt' | 'loginCount' | 'subscription'> {}

// Define the instance methods interface
interface UserInstanceMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  updateLastLogin(): Promise<User>;
  updateLastActivity(): Promise<User>;
  toJSON(): Omit<UserAttributes, 'password' | 'passwordResetToken' | 'emailVerificationToken'>;
}

// Define the model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes, UserInstanceMethods {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public firstName!: string;
  public lastName!: string;
  public avatar?: string;
  public preferences!: UserPreferences;
  public status!: 'active' | 'inactive' | 'suspended' | 'pending';
  public emailVerified!: boolean;
  public emailVerificationToken?: string;
  public passwordResetToken?: string;
  public passwordResetExpires?: Date;
  public lastLoginAt?: Date;
  public lastActivityAt!: Date;
  public loginCount!: number;
  public subscription!: Subscription;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  public async updateLastLogin(): Promise<User> {
    this.lastLoginAt = new Date();
    this.loginCount += 1;
    this.lastActivityAt = new Date();
    return this.save();
  }

  public async updateLastActivity(): Promise<User> {
    this.lastActivityAt = new Date();
    return this.save();
  }

  public override toJSON(): Omit<UserAttributes, 'password' | 'passwordResetToken' | 'emailVerificationToken'> {
    const values = { ...this.get() };
    delete (values as any).password;
    delete (values as any).passwordResetToken;
    delete (values as any).emailVerificationToken;
    return values;
  }

  // Static methods
  public static findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email: email.toLowerCase() } });
  }

  public static findByUsername(username: string): Promise<User | null> {
    return this.findOne({ where: { username: username.toLowerCase() } });
  }

  public static findActiveUsers(): Promise<User[]> {
    return this.findAll({ where: { status: 'active' } });
  }
}

// Initialize the model
User.init({
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
} as any, {
  sequelize,
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user: User) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user: User) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
  },
});

export default User;
