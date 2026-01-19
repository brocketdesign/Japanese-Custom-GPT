const { ObjectId } = require('mongodb');

/**
 * Tier Utilities
 * Handles all tier-related database operations for creator subscription tiers
 */

/**
 * Default tier configuration for new creators
 */
const DEFAULT_FREE_TIER = {
  name: 'Free',
  description: 'Follow for free content updates',
  price: 0,
  currency: 'USD',
  benefits: ['Access to free posts', 'Follow updates'],
  order: 0,
  isActive: true,
  isFree: true
};

/**
 * Suggested tier templates creators can use
 */
const TIER_TEMPLATES = {
  en: [
    {
      name: 'Bronze',
      description: 'Basic supporter tier with exclusive content access',
      price: 499, // $4.99
      currency: 'USD',
      benefits: ['Exclusive posts', 'Behind-the-scenes content', 'Supporter badge']
    },
    {
      name: 'Silver',
      description: 'Enhanced access with priority features',
      price: 999, // $9.99
      currency: 'USD',
      benefits: ['All Bronze benefits', 'Early access to content', 'Monthly exclusive content', 'Discord access']
    },
    {
      name: 'Gold',
      description: 'Premium tier with full access and perks',
      price: 1999, // $19.99
      currency: 'USD',
      benefits: ['All Silver benefits', 'Custom requests', 'Direct messaging', 'Name in credits']
    }
  ],
  ja: [
    {
      name: 'ブロンズ',
      description: '限定コンテンツにアクセスできる基本サポーターティア',
      price: 500, // ¥500
      currency: 'JPY',
      benefits: ['限定投稿', '舞台裏コンテンツ', 'サポーターバッジ']
    },
    {
      name: 'シルバー',
      description: '優先機能付きの拡張アクセス',
      price: 1000, // ¥1000
      currency: 'JPY',
      benefits: ['ブロンズ特典すべて', 'コンテンツへの先行アクセス', '毎月の限定コンテンツ', 'Discordアクセス']
    },
    {
      name: 'ゴールド',
      description: 'フルアクセスと特典付きのプレミアムティア',
      price: 2000, // ¥2000
      currency: 'JPY',
      benefits: ['シルバー特典すべて', 'カスタムリクエスト', 'ダイレクトメッセージ', 'クレジット掲載']
    }
  ]
};

/**
 * Get tier templates for a language
 * @param {String} lang - Language code
 * @returns {Array} - Tier templates
 */
function getTierTemplates(lang = 'en') {
  return TIER_TEMPLATES[lang] || TIER_TEMPLATES['en'];
}

/**
 * Create a new tier for a creator
 * @param {Object} db - MongoDB database instance
 * @param {String} creatorId - Creator's user ID
 * @param {Object} tierData - Tier data
 * @returns {Object} - Created tier or error
 */
async function createTier(db, creatorId, tierData) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    // Validate required fields
    if (!tierData.name || tierData.price === undefined) {
      return { success: false, error: 'Name and price are required' };
    }

    // Get current tier count for ordering
    const tierCount = await tiersCollection.countDocuments({ 
      creatorId: new ObjectId(creatorId),
      isActive: true 
    });

    // Create tier document
    const tier = {
      creatorId: new ObjectId(creatorId),
      name: tierData.name,
      description: tierData.description || '',
      price: parseInt(tierData.price), // Price in smallest currency unit (cents/yen)
      currency: tierData.currency || 'USD',
      benefits: tierData.benefits || [],
      order: tierData.order !== undefined ? tierData.order : tierCount,
      isActive: true,
      isFree: tierData.price === 0,
      stripePriceId: null, // Will be set when Stripe product is created
      stripeProductId: null,
      subscriberCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await tiersCollection.insertOne(tier);

    return { 
      success: true, 
      tier: { ...tier, _id: result.insertedId } 
    };
  } catch (error) {
    console.error('Error creating tier:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all tiers for a creator
 * @param {Object} db - MongoDB database instance
 * @param {String} creatorId - Creator's user ID
 * @param {Boolean} includeInactive - Whether to include inactive tiers
 * @returns {Array} - Creator's tiers
 */
async function getCreatorTiers(db, creatorId, includeInactive = false) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    const query = { creatorId: new ObjectId(creatorId) };
    if (!includeInactive) {
      query.isActive = true;
    }

    const tiers = await tiersCollection
      .find(query)
      .sort({ order: 1, price: 1 })
      .toArray();

    return { success: true, tiers };
  } catch (error) {
    console.error('Error getting creator tiers:', error);
    return { success: false, error: error.message, tiers: [] };
  }
}

/**
 * Get a single tier by ID
 * @param {Object} db - MongoDB database instance
 * @param {String} tierId - Tier ID
 * @returns {Object} - Tier or null
 */
async function getTierById(db, tierId) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    const tier = await tiersCollection.findOne({ 
      _id: new ObjectId(tierId) 
    });

    return { success: true, tier };
  } catch (error) {
    console.error('Error getting tier:', error);
    return { success: false, error: error.message, tier: null };
  }
}

/**
 * Update a tier
 * @param {Object} db - MongoDB database instance
 * @param {String} tierId - Tier ID
 * @param {String} creatorId - Creator's user ID (for verification)
 * @param {Object} updateData - Data to update
 * @returns {Object} - Update result
 */
async function updateTier(db, tierId, creatorId, updateData) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    // Build update object
    const updateFields = {
      updatedAt: new Date()
    };

    // Only update allowed fields
    const allowedFields = ['name', 'description', 'price', 'currency', 'benefits', 'order', 'isActive'];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    // Update isFree based on price
    if (updateData.price !== undefined) {
      updateFields.isFree = updateData.price === 0;
    }

    const result = await tiersCollection.updateOne(
      { 
        _id: new ObjectId(tierId),
        creatorId: new ObjectId(creatorId)
      },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'Tier not found or unauthorized' };
    }

    return { success: true, modified: result.modifiedCount > 0 };
  } catch (error) {
    console.error('Error updating tier:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete (deactivate) a tier
 * @param {Object} db - MongoDB database instance
 * @param {String} tierId - Tier ID
 * @param {String} creatorId - Creator's user ID (for verification)
 * @returns {Object} - Delete result
 */
async function deleteTier(db, tierId, creatorId) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    // Check if tier has active subscribers
    const subscriptionsCollection = db.collection('subscriptions');
    const activeSubscribers = await subscriptionsCollection.countDocuments({
      tierId: new ObjectId(tierId),
      status: 'active'
    });

    if (activeSubscribers > 0) {
      return { 
        success: false, 
        error: 'Cannot delete tier with active subscribers. Deactivate it instead.' 
      };
    }

    // Soft delete by setting isActive to false
    const result = await tiersCollection.updateOne(
      { 
        _id: new ObjectId(tierId),
        creatorId: new ObjectId(creatorId)
      },
      { 
        $set: { 
          isActive: false,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'Tier not found or unauthorized' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting tier:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reorder tiers
 * @param {Object} db - MongoDB database instance
 * @param {String} creatorId - Creator's user ID
 * @param {Array} tierOrder - Array of tier IDs in new order
 * @returns {Object} - Reorder result
 */
async function reorderTiers(db, creatorId, tierOrder) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    // Update each tier's order
    const updatePromises = tierOrder.map((tierId, index) => 
      tiersCollection.updateOne(
        { 
          _id: new ObjectId(tierId),
          creatorId: new ObjectId(creatorId)
        },
        { 
          $set: { 
            order: index,
            updatedAt: new Date()
          } 
        }
      )
    );

    await Promise.all(updatePromises);

    return { success: true };
  } catch (error) {
    console.error('Error reordering tiers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create default free tier for a new creator
 * @param {Object} db - MongoDB database instance
 * @param {String} creatorId - Creator's user ID
 * @returns {Object} - Created tier
 */
async function createDefaultFreeTier(db, creatorId) {
  return await createTier(db, creatorId, DEFAULT_FREE_TIER);
}

/**
 * Update tier's Stripe IDs
 * @param {Object} db - MongoDB database instance
 * @param {String} tierId - Tier ID
 * @param {String} stripeProductId - Stripe Product ID
 * @param {String} stripePriceId - Stripe Price ID
 * @returns {Object} - Update result
 */
async function updateTierStripeIds(db, tierId, stripeProductId, stripePriceId) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    const result = await tiersCollection.updateOne(
      { _id: new ObjectId(tierId) },
      { 
        $set: { 
          stripeProductId,
          stripePriceId,
          updatedAt: new Date()
        } 
      }
    );

    return { success: result.modifiedCount > 0 };
  } catch (error) {
    console.error('Error updating tier Stripe IDs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Increment/decrement subscriber count for a tier
 * @param {Object} db - MongoDB database instance
 * @param {String} tierId - Tier ID
 * @param {Number} increment - Amount to increment (negative to decrement)
 * @returns {Object} - Update result
 */
async function updateTierSubscriberCount(db, tierId, increment) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    const result = await tiersCollection.updateOne(
      { _id: new ObjectId(tierId) },
      { 
        $inc: { subscriberCount: increment },
        $set: { updatedAt: new Date() }
      }
    );

    return { success: result.modifiedCount > 0 };
  } catch (error) {
    console.error('Error updating tier subscriber count:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get public tiers for a creator (for subscription modal)
 * @param {Object} db - MongoDB database instance
 * @param {String} creatorId - Creator's user ID
 * @returns {Array} - Public tiers
 */
async function getPublicTiers(db, creatorId) {
  try {
    const tiersCollection = db.collection('creatorTiers');

    const tiers = await tiersCollection
      .find({ 
        creatorId: new ObjectId(creatorId),
        isActive: true
      })
      .project({
        name: 1,
        description: 1,
        price: 1,
        currency: 1,
        benefits: 1,
        order: 1,
        isFree: 1,
        subscriberCount: 1
      })
      .sort({ order: 1, price: 1 })
      .toArray();

    return { success: true, tiers };
  } catch (error) {
    console.error('Error getting public tiers:', error);
    return { success: false, error: error.message, tiers: [] };
  }
}

module.exports = {
  DEFAULT_FREE_TIER,
  TIER_TEMPLATES,
  getTierTemplates,
  createTier,
  getCreatorTiers,
  getTierById,
  updateTier,
  deleteTier,
  reorderTiers,
  createDefaultFreeTier,
  updateTierStripeIds,
  updateTierSubscriberCount,
  getPublicTiers
};
