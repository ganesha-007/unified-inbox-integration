const config = require('../config');
const { User, ChannelEntitlement, ChannelUsage } = require('../models');

class EntitlementService {
  constructor() {
    this.pricingMode = config.pricing.mode;
    this.plans = config.pricing.plans;
    this.addons = config.pricing.addons;
  }

  /**
   * Get user's entitlements for all providers
   */
  async getUserEntitlements(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const plan = user.subscription?.plan || 'starter';
      const activeEntitlements = await ChannelEntitlement.findActiveByUser(userId);
      
      const access = {
        whatsapp: false,
        instagram: false,
        email: false,
      };

      // Check plan-based entitlements
      if (this.pricingMode === 'bundled') {
        const planConfig = this.plans[plan];
        if (planConfig && planConfig.includes) {
          planConfig.includes.forEach(provider => {
            if (access.hasOwnProperty(provider)) {
              access[provider] = true;
            }
          });
        }
      }

      // Check add-on entitlements
      activeEntitlements.forEach(entitlement => {
        if (entitlement.isValid() && access.hasOwnProperty(entitlement.provider)) {
          access[entitlement.provider] = true;
        }
      });

      return {
        access,
        plan,
        entitlements: activeEntitlements,
        pricingMode: this.pricingMode,
      };
    } catch (error) {
      console.error('Error getting user entitlements:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to a specific provider
   */
  async hasAccess(userId, provider) {
    try {
      const entitlements = await this.getUserEntitlements(userId);
      return entitlements.access[provider] || false;
    } catch (error) {
      console.error('Error checking access:', error);
      return false;
    }
  }

  /**
   * Get usage limits for a provider
   */
  async getUsageLimits(userId, provider) {
    try {
      const entitlements = await this.getUserEntitlements(userId);
      
      if (!entitlements.access[provider]) {
        return null; // No access
      }

      // Find the most relevant entitlement (addon takes precedence over plan)
      const addonEntitlement = entitlements.entitlements.find(
        e => e.provider === provider && e.source === 'addon' && e.isValid()
      );

      if (addonEntitlement) {
        return addonEntitlement.getLimits();
      }

      // Check plan limits
      const plan = entitlements.plan;
      const planConfig = this.plans[plan];
      if (planConfig && planConfig.limits) {
        return planConfig.limits;
      }

      return {}; // No specific limits
    } catch (error) {
      console.error('Error getting usage limits:', error);
      return null;
    }
  }

  /**
   * Check if user has exceeded usage limits
   */
  async checkUsageLimits(userId, provider) {
    try {
      const limits = await this.getUsageLimits(userId, provider);
      if (!limits || !limits.messagesPerMonth) {
        return { allowed: true, remaining: null };
      }

      const currentPeriod = ChannelUsage.getCurrentPeriod();
      const usage = await ChannelUsage.findByUserAndProvider(userId, provider, currentPeriod);
      
      const totalMessages = usage ? usage.getTotalMessages() : 0;
      const remaining = Math.max(0, limits.messagesPerMonth - totalMessages);
      
      return {
        allowed: totalMessages < limits.messagesPerMonth,
        remaining,
        used: totalMessages,
        limit: limits.messagesPerMonth,
      };
    } catch (error) {
      console.error('Error checking usage limits:', error);
      return { allowed: false, remaining: 0 };
    }
  }

  /**
   * Enforce usage limits (throws error if exceeded)
   */
  async enforceUsageLimits(userId, provider) {
    const usageCheck = await this.checkUsageLimits(userId, provider);
    
    if (!usageCheck.allowed) {
      const error = new Error('Monthly usage limit reached');
      error.status = 402;
      error.code = 'USAGE_LIMIT_EXCEEDED';
      error.details = {
        provider,
        used: usageCheck.used,
        limit: usageCheck.limit,
        remaining: usageCheck.remaining,
      };
      throw error;
    }

    return usageCheck;
  }

  /**
   * Create entitlements from plan
   */
  async createPlanEntitlements(userId, plan) {
    try {
      const planConfig = this.plans[plan];
      if (!planConfig) {
        throw new Error(`Invalid plan: ${plan}`);
      }

      // Remove existing plan entitlements
      await ChannelEntitlement.destroy({
        where: { user_id: userId, source: 'plan' },
      });

      // Create new plan entitlements
      const entitlements = [];
      for (const provider of planConfig.includes || []) {
        const entitlement = await ChannelEntitlement.create({
          user_id: userId,
          provider,
          source: 'plan',
          limits: planConfig.limits || {},
          metadata: { plan },
        });
        entitlements.push(entitlement);
      }

      return entitlements;
    } catch (error) {
      console.error('Error creating plan entitlements:', error);
      throw error;
    }
  }

  /**
   * Create add-on entitlement
   */
  async createAddonEntitlement(userId, addon) {
    try {
      const addonConfig = this.addons[addon];
      if (!addonConfig) {
        throw new Error(`Invalid addon: ${addon}`);
      }

      // Check if addon already exists
      const existing = await ChannelEntitlement.findByUserAndProvider(userId, addon);
      if (existing) {
        existing.is_active = true;
        existing.limits = addonConfig.limits || {};
        return await existing.save();
      }

      // Create new addon entitlement
      return await ChannelEntitlement.create({
        user_id: userId,
        provider: addon,
        source: 'addon',
        limits: addonConfig.limits || {},
        metadata: { addon },
      });
    } catch (error) {
      console.error('Error creating addon entitlement:', error);
      throw error;
    }
  }

  /**
   * Remove add-on entitlement
   */
  async removeAddonEntitlement(userId, addon) {
    try {
      const entitlement = await ChannelEntitlement.findByUserAndProvider(userId, addon);
      if (entitlement && entitlement.source === 'addon') {
        entitlement.is_active = false;
        return await entitlement.save();
      }
      return null;
    } catch (error) {
      console.error('Error removing addon entitlement:', error);
      throw error;
    }
  }

  /**
   * Update user plan
   */
  async updateUserPlan(userId, plan) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user subscription
      user.subscription = {
        ...user.subscription,
        plan,
      };
      await user.save();

      // Update entitlements if in bundled mode
      if (this.pricingMode === 'bundled') {
        await this.createPlanEntitlements(userId, plan);
      }

      return user;
    } catch (error) {
      console.error('Error updating user plan:', error);
      throw error;
    }
  }

  /**
   * Get pricing configuration
   */
  getPricingConfig() {
    return {
      mode: this.pricingMode,
      plans: this.plans,
      addons: this.addons,
    };
  }

  /**
   * Switch pricing mode (admin function)
   */
  switchPricingMode(mode) {
    if (!['bundled', 'addons'].includes(mode)) {
      throw new Error('Invalid pricing mode');
    }
    this.pricingMode = mode;
    return this.getPricingConfig();
  }
}

module.exports = EntitlementService;
