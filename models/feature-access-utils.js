/**
 * Feature Access Control
 * Manages feature-based eligibility and access permissions
 */

const { ObjectId } = require('mongodb');

/**
 * Feature tiers
 */
const FEATURE_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  ADMIN: 'admin'
};

/**
 * Feature definitions with access requirements
 */
const FEATURES = {
  // Dashboard Features
  IMAGE_GENERATION: {
    id: 'image_generation',
    name: 'Image Generation',
    tier: FEATURE_TIERS.FREE,
    requiresPoints: true,
    minPoints: 0,
    dailyLimit: {
      free: 10,
      premium: 100,
      admin: null
    }
  },
  
  VIDEO_GENERATION: {
    id: 'video_generation',
    name: 'Video Generation',
    tier: FEATURE_TIERS.FREE,
    requiresPoints: true,
    minPoints: 0,
    dailyLimit: {
      free: 5,
      premium: 50,
      admin: null
    }
  },
  
  // Scheduling Features
  SINGLE_SCHEDULE: {
    id: 'single_schedule',
    name: 'Single Schedule',
    tier: FEATURE_TIERS.FREE,
    requiresPoints: false,
    maxActive: {
      free: 3,
      premium: 20,
      admin: null
    }
  },
  
  RECURRING_SCHEDULE: {
    id: 'recurring_schedule',
    name: 'Recurring Schedule (Cron Jobs)',
    tier: FEATURE_TIERS.PREMIUM,
    requiresPoints: false,
    maxActive: {
      free: 0,
      premium: 10,
      admin: null
    }
  },
  
  // Prompt Features
  PROMPT_MUTATION: {
    id: 'prompt_mutation',
    name: 'Prompt Mutation',
    tier: FEATURE_TIERS.FREE,
    requiresPoints: false
  },
  
  CUSTOM_TEMPLATES: {
    id: 'custom_templates',
    name: 'Custom Templates',
    tier: FEATURE_TIERS.PREMIUM,
    requiresPoints: false,
    maxTemplates: {
      free: 0,
      premium: 50,
      admin: null
    }
  },
  
  // Social Features
  SOCIAL_PUBLISHING: {
    id: 'social_publishing',
    name: 'Social Media Publishing',
    tier: FEATURE_TIERS.FREE,
    requiresPoints: false,
    maxConnections: {
      free: 1,
      premium: 5,
      admin: null
    }
  },
  
  AUTO_PUBLISH: {
    id: 'auto_publish',
    name: 'Auto Publishing',
    tier: FEATURE_TIERS.PREMIUM,
    requiresPoints: false
  },
  
  // Content Features
  NSFW_CONTENT: {
    id: 'nsfw_content',
    name: 'NSFW Content',
    tier: FEATURE_TIERS.PREMIUM,
    requiresPoints: false,
    requiresAgeVerification: true
  },
  
  ADVANCED_MODELS: {
    id: 'advanced_models',
    name: 'Advanced Models',
    tier: FEATURE_TIERS.PREMIUM,
    requiresPoints: true
  },
  
  // Post Features
  UNLIMITED_POSTS: {
    id: 'unlimited_posts',
    name: 'Unlimited Posts',
    tier: FEATURE_TIERS.PREMIUM,
    maxPosts: {
      free: 100,
      premium: null,
      admin: null
    }
  }
};

/**
 * Get user's tier based on subscription status and role
 * @param {Object} user - User object
 * @returns {string} User tier
 */
function getUserTier(user) {
  if (user.role === 'admin') {
    return FEATURE_TIERS.ADMIN;
  }
  
  if (user.subscriptionStatus === 'active') {
    return FEATURE_TIERS.PREMIUM;
  }
  
  return FEATURE_TIERS.FREE;
}

/**
 * Check if user has access to a feature
 * @param {Object} user - User object
 * @param {string} featureId - Feature ID
 * @param {Object} db - Database connection (optional, for usage checks)
 * @returns {Promise<Object>} Access result
 */
async function checkFeatureAccess(user, featureId, db = null) {
  const feature = FEATURES[featureId];
  
  if (!feature) {
    return {
      hasAccess: false,
      reason: 'feature_not_found',
      message: 'Feature not found'
    };
  }
  
  const userTier = getUserTier(user);
  
  // Check tier requirement
  const tierLevel = {
    [FEATURE_TIERS.FREE]: 0,
    [FEATURE_TIERS.PREMIUM]: 1,
    [FEATURE_TIERS.ADMIN]: 2
  };
  
  const requiredLevel = tierLevel[feature.tier];
  const userLevel = tierLevel[userTier];
  
  if (userLevel < requiredLevel) {
    return {
      hasAccess: false,
      reason: 'tier_required',
      message: `This feature requires ${feature.tier} tier`,
      requiredTier: feature.tier,
      currentTier: userTier,
      upgradeRequired: true
    };
  }
  
  // Check points requirement
  if (feature.requiresPoints && user.points < feature.minPoints) {
    return {
      hasAccess: false,
      reason: 'insufficient_points',
      message: `Insufficient points. Required: ${feature.minPoints}, Current: ${user.points}`,
      requiredPoints: feature.minPoints,
      currentPoints: user.points,
      needsPoints: true
    };
  }
  
  // Check age verification for NSFW
  if (feature.requiresAgeVerification && !user.ageVerified) {
    return {
      hasAccess: false,
      reason: 'age_verification_required',
      message: 'Age verification required for this feature',
      needsVerification: true
    };
  }
  
  // Check usage limits if database is provided
  if (db) {
    const usageCheck = await checkUsageLimits(user, feature, userTier, db);
    if (!usageCheck.hasAccess) {
      return usageCheck;
    }
  }
  
  return {
    hasAccess: true,
    tier: userTier,
    feature: feature.name
  };
}

/**
 * Check usage limits for features with limits
 * @param {Object} user - User object
 * @param {Object} feature - Feature object
 * @param {string} userTier - User tier
 * @param {Object} db - Database connection
 * @returns {Promise<Object>} Usage check result
 */
async function checkUsageLimits(user, feature, userTier, db) {
  // Check daily limits for generation features
  if (feature.dailyLimit) {
    const limit = feature.dailyLimit[userTier];
    
    if (limit !== null) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let collection;
      if (feature.id === 'image_generation') {
        collection = 'imageModelTests';
      } else if (feature.id === 'video_generation') {
        collection = 'videoModelTests';
      }
      
      if (collection) {
        const count = await db.collection(collection).countDocuments({
          userId: new ObjectId(user._id),
          createdAt: { $gte: today }
        });
        
        if (count >= limit) {
          return {
            hasAccess: false,
            reason: 'daily_limit_reached',
            message: `Daily limit reached (${limit}/${limit})`,
            limit,
            current: count,
            upgradeRequired: userTier === FEATURE_TIERS.FREE
          };
        }
      }
    }
  }
  
  // Check max active schedules
  if (feature.maxActive) {
    const limit = feature.maxActive[userTier];
    
    if (limit !== null && limit === 0) {
      return {
        hasAccess: false,
        reason: 'feature_locked',
        message: 'This feature is not available for your tier',
        upgradeRequired: true
      };
    }
    
    if (limit !== null) {
      const count = await db.collection('schedules').countDocuments({
        userId: new ObjectId(user._id),
        status: { $in: ['pending', 'active'] }
      });
      
      if (count >= limit) {
        return {
          hasAccess: false,
          reason: 'max_active_reached',
          message: `Maximum active schedules reached (${limit}/${limit})`,
          limit,
          current: count,
          upgradeRequired: userTier === FEATURE_TIERS.FREE
        };
      }
    }
  }
  
  // Check max templates
  if (feature.maxTemplates) {
    const limit = feature.maxTemplates[userTier];
    
    if (limit !== null && limit === 0) {
      return {
        hasAccess: false,
        reason: 'feature_locked',
        message: 'This feature is not available for your tier',
        upgradeRequired: true
      };
    }
    
    if (limit !== null) {
      const count = await db.collection('promptTemplates').countDocuments({
        userId: new ObjectId(user._id)
      });
      
      if (count >= limit) {
        return {
          hasAccess: false,
          reason: 'max_templates_reached',
          message: `Maximum templates reached (${limit}/${limit})`,
          limit,
          current: count,
          upgradeRequired: userTier === FEATURE_TIERS.FREE
        };
      }
    }
  }
  
  // Check max posts
  if (feature.maxPosts) {
    const limit = feature.maxPosts[userTier];
    
    if (limit !== null) {
      const count = await db.collection('unifiedPosts').countDocuments({
        userId: new ObjectId(user._id)
      });
      
      if (count >= limit) {
        return {
          hasAccess: false,
          reason: 'max_posts_reached',
          message: `Maximum posts reached (${limit}/${limit})`,
          limit,
          current: count,
          upgradeRequired: true
        };
      }
    }
  }
  
  // Check max social connections
  if (feature.maxConnections) {
    const limit = feature.maxConnections[userTier];
    
    if (limit !== null) {
      const userData = await db.collection('users').findOne(
        { _id: new ObjectId(user._id) },
        { projection: { snsConnections: 1 } }
      );
      
      const count = userData?.snsConnections?.length || 0;
      
      if (count >= limit) {
        return {
          hasAccess: false,
          reason: 'max_connections_reached',
          message: `Maximum social connections reached (${limit}/${limit})`,
          limit,
          current: count,
          upgradeRequired: userTier === FEATURE_TIERS.FREE
        };
      }
    }
  }
  
  return { hasAccess: true };
}

/**
 * Get all features accessible to user
 * @param {Object} user - User object
 * @param {Object} db - Database connection (optional)
 * @returns {Promise<Object>} Features with access status
 */
async function getUserFeatures(user, db = null) {
  const userTier = getUserTier(user);
  const features = {};
  
  for (const [key, feature] of Object.entries(FEATURES)) {
    const access = await checkFeatureAccess(user, key, db);
    features[key] = {
      ...feature,
      ...access
    };
  }
  
  return {
    tier: userTier,
    features
  };
}

/**
 * Get feature limits for user
 * @param {Object} user - User object
 * @returns {Object} Feature limits
 */
function getUserLimits(user) {
  const tier = getUserTier(user);
  
  return {
    tier,
    limits: {
      imageGeneration: FEATURES.IMAGE_GENERATION.dailyLimit[tier],
      videoGeneration: FEATURES.VIDEO_GENERATION.dailyLimit[tier],
      singleSchedules: FEATURES.SINGLE_SCHEDULE.maxActive[tier],
      recurringSchedules: FEATURES.RECURRING_SCHEDULE.maxActive[tier],
      customTemplates: FEATURES.CUSTOM_TEMPLATES.maxTemplates?.[tier] || 0,
      socialConnections: FEATURES.SOCIAL_PUBLISHING.maxConnections[tier],
      maxPosts: FEATURES.UNLIMITED_POSTS.maxPosts[tier]
    }
  };
}

/**
 * Middleware to check feature access
 * @param {string} featureId - Feature ID to check
 * @returns {Function} Fastify middleware
 */
function requireFeatureAccess(featureId) {
  return async (request, reply) => {
    const user = request.user;
    
    if (!user || user.isTemporary) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    
    const db = request.server.mongo.db;
    const access = await checkFeatureAccess(user, featureId, db);
    
    if (!access.hasAccess) {
      return reply.code(403).send({
        error: 'Access denied',
        ...access
      });
    }
    
    // Attach access info to request
    request.featureAccess = access;
  };
}

module.exports = {
  FEATURE_TIERS,
  FEATURES,
  getUserTier,
  checkFeatureAccess,
  getUserFeatures,
  getUserLimits,
  requireFeatureAccess
};
