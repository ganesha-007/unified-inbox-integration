import config from '../config';
import { User, ChannelEntitlement, ChannelUsage } from '../models';
import { Provider } from '../types';

interface UserAccess {
  whatsapp: boolean;
  instagram: boolean;
  email: boolean;
}

interface ProviderLimits {
  messagesPerMonth: number;
  maxPlatforms?: number;
  realTimeSync?: boolean;
  advancedSearch?: boolean;
}

class EntitlementService {
  private pricingMode: string;
  private plans: Record<string, any>;
  private addons: Record<string, any>;

  constructor() {
    this.pricingMode = config.pricing.mode;
    this.plans = config.pricing.plans;
    this.addons = config.pricing.addons;
  }

  /**
   * Get user's entitlements for all providers
   */
  async getUserEntitlements(userId: string): Promise<UserAccess> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const plan = user.subscription?.plan || 'starter';
      const activeEntitlements = await ChannelEntitlement.findActiveByUser(userId);
      
      const access: UserAccess = {
        whatsapp: false,
        instagram: false,
        email: false,
      };

      // Check plan-based entitlements
      if (this.pricingMode === 'bundled') {
        const planConfig = this.plans[plan];
        if (planConfig && planConfig.includes) {
          planConfig.includes.forEach((provider: Provider) => {
            access[provider] = true;
          });
        }
      }

      // Check addon-based entitlements
      activeEntitlements.forEach(entitlement => {
        if (entitlement.isValid()) {
          access[entitlement.provider] = true;
        }
      });

      return access;
    } catch (error) {
      console.error('Error getting user entitlements:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to a specific provider
   */
  async hasAccess(userId: string, provider: Provider): Promise<boolean> {
    try {
      const entitlements = await this.getUserEntitlements(userId);
      return entitlements[provider];
    } catch (error) {
      console.error(`Error checking access for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get limits for a specific provider
   */
  async getLimits(userId: string, provider: Provider): Promise<ProviderLimits> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const plan = user.subscription?.plan || 'starter';
      const entitlement = await ChannelEntitlement.findByUserAndProvider(userId, provider);

      // Default limits
      let limits: ProviderLimits = {
        messagesPerMonth: 1000,
        maxPlatforms: 2,
        realTimeSync: false,
        advancedSearch: false,
      };

      // Check plan-based limits
      if (this.pricingMode === 'bundled') {
        const planConfig = this.plans[plan];
        if (planConfig && planConfig.limits) {
          limits = { ...limits, ...planConfig.limits };
        }
      }

      // Check entitlement-based limits
      if (entitlement && entitlement.isValid()) {
        const entitlementLimits = entitlement.getLimits();
        limits = { ...limits, ...entitlementLimits };
      }

      return limits;
    } catch (error) {
      console.error(`Error getting limits for ${provider}:`, error);
      return {
        messagesPerMonth: 1000,
        maxPlatforms: 2,
        realTimeSync: false,
        advancedSearch: false,
      };
    }
  }

  /**
   * Create entitlements from a plan
   */
  async createPlanEntitlements(userId: string, plan: string): Promise<ChannelEntitlement[]> {
    try {
      const planConfig = this.plans[plan];
      if (!planConfig) {
        throw new Error(`Plan ${plan} not found`);
      }

      return await ChannelEntitlement.createFromPlan(userId, plan, planConfig);
    } catch (error) {
      console.error(`Error creating plan entitlements for ${plan}:`, error);
      throw error;
    }
  }

  /**
   * Create entitlement from an addon
   */
  async createAddonEntitlement(userId: string, addon: string): Promise<ChannelEntitlement> {
    try {
      const addonConfig = this.addons[addon];
      if (!addonConfig) {
        throw new Error(`Addon ${addon} not found`);
      }

      return await ChannelEntitlement.createFromAddon(userId, addon, addonConfig);
    } catch (error) {
      console.error(`Error creating addon entitlement for ${addon}:`, error);
      throw error;
    }
  }

  /**
   * Remove entitlements for a provider
   */
  async removeEntitlements(userId: string, provider: Provider): Promise<void> {
    try {
      const entitlements = await ChannelEntitlement.findAll({
        where: { userId, provider }
      });

      for (const entitlement of entitlements) {
        await entitlement.deactivate();
      }
    } catch (error) {
      console.error(`Error removing entitlements for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has exceeded limits
   */
  async hasExceededLimits(userId: string, provider: Provider): Promise<boolean> {
    try {
      const limits = await this.getLimits(userId, provider);
      const usage = await ChannelUsage.getOrCreate(userId, provider);

      return usage.messagesSent >= limits.messagesPerMonth;
    } catch (error) {
      console.error(`Error checking limits for ${provider}:`, error);
      return true; // Default to exceeded if we can't check
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsage(userId: string, period?: string): Promise<Record<string, any>> {
    try {
      const usage = await ChannelUsage.findByUserAndPeriod(userId, period);
      
      const usageStats: Record<string, any> = {};
      usage.forEach(u => {
        usageStats[u.provider] = {
          messagesSent: u.messagesSent,
          messagesReceived: u.messagesReceived,
          totalMessages: u.getTotalMessages(),
          usageMetrics: u.usageMetrics,
        };
      });

      return usageStats;
    } catch (error) {
      console.error('Error getting user usage:', error);
      throw error;
    }
  }
}

export default EntitlementService;
