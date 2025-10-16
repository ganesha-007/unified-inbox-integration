import { Sequelize } from 'sequelize';
import config from './index';

// Create Sequelize instance
const sequelize = new Sequelize(config.database.uri, {
  dialect: 'postgres',
  logging: config.nodeEnv === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
});

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

// Sync database models
export const syncDatabase = async (): Promise<void> => {
  try {
    // Import models to ensure they're registered
    await import('../models');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized successfully.');
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    throw error;
  }
};

export { sequelize };
export default sequelize;
