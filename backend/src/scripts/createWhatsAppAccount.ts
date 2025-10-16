import { ChannelAccount, User } from '../models';
import { sequelize } from '../config/database';

async function createWhatsAppAccount(): Promise<void> {
  try {
    console.log('🔧 Creating WhatsApp account connection...');
    
    // First, create a default user if none exists
    let user = await User.findOne();
    if (!user) {
      console.log('👤 Creating default user...');
      user = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123', // In production, this should be hashed
        firstName: 'Admin',
        lastName: 'User'
      });
      console.log('✅ Default user created:', user.id);
    } else {
      console.log('👤 Using existing user:', user.id);
    }

    // Create WhatsApp account connection
    const [account, created] = await ChannelAccount.findOrCreate({
      where: {
        userId: user.id,
        provider: 'whatsapp',
        externalAccountId: 'T5GMMpVSS72Nh975S0wPPg'
      },
      defaults: {
        userId: user.id,
        provider: 'whatsapp',
        externalAccountId: 'T5GMMpVSS72Nh975S0wPPg',
        status: 'connected',
        connectionData: {
          connectionId: 'T5GMMpVSS72Nh975S0wPPg',
          accountNumber: '919566651479',
          accountToken: 'T5GMMpVSS72Nh975S0wPPg'
        },
        accountInfo: {
          name: 'WhatsApp Business',
          phone: '919566651479'
        }
      }
    });

    if (created) {
      console.log('✅ WhatsApp account created successfully!');
      console.log('📱 Account ID:', account.id);
      console.log('🔗 Connection ID:', account.connectionData.connectionId);
    } else {
      console.log('✅ WhatsApp account already exists!');
      // Update the account to ensure it's connected
      account.status = 'connected';
      await account.save();
      console.log('🔄 Account status updated to connected');
    }

    console.log('📊 Account details:', {
      id: account.id,
      provider: account.provider,
      external_account_id: account.externalAccountId,
      status: account.status,
      connection_data: account.connectionData
    });

  } catch (error) {
    console.error('❌ Error creating WhatsApp account:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the script
createWhatsAppAccount();
