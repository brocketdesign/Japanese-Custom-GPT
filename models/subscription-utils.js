const { ObjectId } = require('mongodb');
const { updateTierSubscriberCount } = require('./tier-utils');

/**
 * Subscription Utilities
 * Handles all subscription-related database operations
 */

/**
 * Subscription status enum
 */
const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  PAST_DUE: 'past_due',
  PAUSED: 'paused',
  PENDING: 'pending'
};

/**
 * Create a new subscription
 * @param {Object} db - MongoDB database instance
 * @param {Object} subscriptionData - Subscription data
 * @returns {Object} - Created subscription or error
 */
async function createSubscription(db, subscriptionData) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');

    // Check if user already has an active subscription to this creator
    const existingSubscription = await subscriptionsCollection.findOne({
      subscriberId: new ObjectId(subscriptionData.subscriberId),
      creatorId: new ObjectId(subscriptionData.creatorId),
      status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PENDING] }
    });

    if (existingSubscription) {
      return { 
        success: false, 
        error: 'Already subscribed to this creator',
        existingSubscription 
      };
    }

    const subscription = {
      subscriberId: new ObjectId(subscriptionData.subscriberId),
      creatorId: new ObjectId(subscriptionData.creatorId),
      tierId: new ObjectId(subscriptionData.tierId),
      
      // Stripe data
      stripeCustomerId: subscriptionData.stripeCustomerId || null,
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId || null,
      stripePriceId: subscriptionData.stripePriceId || null,
      
      // Status
      status: subscriptionData.status || SUBSCRIPTION_STATUS.PENDING,
      
      // Dates
      startDate: subscriptionData.startDate || new Date(),
      currentPeriodStart: subscriptionData.currentPeriodStart || new Date(),
      currentPeriodEnd: subscriptionData.currentPeriodEnd || null,
      cancelledAt: null,
      
      // Metadata
      isFreeSubscription: subscriptionData.isFreeSubscription || false,
      
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await subscriptionsCollection.insertOne(subscription);

    // Update tier subscriber count
    await updateTierSubscriberCount(db, subscriptionData.tierId, 1);

    // Update creator's subscriber count
    await db.collection('users').updateOne(
      { _id: new ObjectId(subscriptionData.creatorId) },
      { $inc: { 'creatorProfile.subscriberCount': 1 } }
    );

    return { 
      success: true, 
      subscription: { ...subscription, _id: result.insertedId } 
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a user's subscription to a specific creator
 * @param {Object} db - MongoDB database instance
 * @param {String} subscriberId - Subscriber's user ID
 * @param {String} creatorId - Creator's user ID
 * @returns {Object} - Subscription or null
 */
async function getSubscription(db, subscriberId, creatorId) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');

    const subscription = await subscriptionsCollection.findOne({
      subscriberId: new ObjectId(subscriberId),
      creatorId: new ObjectId(creatorId),
      status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE] }
    });

    return { success: true, subscription };
  } catch (error) {
    console.error('Error getting subscription:', error);
    return { success: false, error: error.message, subscription: null };
  }
}

/**
 * Get a subscription by ID
 * @param {Object} db - MongoDB database instance
 * @param {String} subscriptionId - Subscription ID
 * @returns {Object} - Subscription or null
 */
async function getSubscriptionById(db, subscriptionId) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');

    const subscription = await subscriptionsCollection.findOne({
      _id: new ObjectId(subscriptionId)
    });

    return { success: true, subscription };
  } catch (error) {
    console.error('Error getting subscription by ID:', error);
    return { success: false, error: error.message, subscription: null };
  }
}

/**
 * Get all subscriptions for a subscriber (creators they're subscribed to)
 * @param {Object} db - MongoDB database instance
 * @param {String} subscriberId - Subscriber's user ID
 * @param {Object} options - Pagination options
 * @returns {Object} - Subscriptions list
 */
async function getSubscriberSubscriptions(db, subscriberId, options = {}) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');
    const { page = 1, limit = 20, status = null } = options;

    const query = { subscriberId: new ObjectId(subscriberId) };
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE] };
    }

    const [subscriptions, total] = await Promise.all([
      subscriptionsCollection.aggregate([
        { $match: query },
        { 
          $lookup: {
            from: 'users',
            localField: 'creatorId',
            foreignField: '_id',
            as: 'creator',
            pipeline: [
              { $project: { nickname: 1, profileUrl: 1, creatorProfile: 1 } }
            ]
          }
        },
        {
          $lookup: {
            from: 'creatorTiers',
            localField: 'tierId',
            foreignField: '_id',
            as: 'tier'
          }
        },
        { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$tier', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ]).toArray(),
      subscriptionsCollection.countDocuments(query)
    ]);

    return {
      success: true,
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting subscriber subscriptions:', error);
    return { success: false, error: error.message, subscriptions: [] };
  }
}

/**
 * Get all subscribers for a creator
 * @param {Object} db - MongoDB database instance
 * @param {String} creatorId - Creator's user ID
 * @param {Object} options - Pagination and filter options
 * @returns {Object} - Subscribers list
 */
async function getCreatorSubscribers(db, creatorId, options = {}) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');
    const { page = 1, limit = 20, tierId = null, status = SUBSCRIPTION_STATUS.ACTIVE } = options;

    const query = { 
      creatorId: new ObjectId(creatorId),
      status: status
    };

    if (tierId) {
      query.tierId = new ObjectId(tierId);
    }

    const [subscribers, total] = await Promise.all([
      subscriptionsCollection.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'subscriberId',
            foreignField: '_id',
            as: 'subscriber',
            pipeline: [
              { $project: { nickname: 1, profileUrl: 1, email: 1 } }
            ]
          }
        },
        {
          $lookup: {
            from: 'creatorTiers',
            localField: 'tierId',
            foreignField: '_id',
            as: 'tier'
          }
        },
        { $unwind: { path: '$subscriber', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$tier', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ]).toArray(),
      subscriptionsCollection.countDocuments(query)
    ]);

    return {
      success: true,
      subscribers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting creator subscribers:', error);
    return { success: false, error: error.message, subscribers: [] };
  }
}

/**
 * Update subscription status
 * @param {Object} db - MongoDB database instance
 * @param {String} subscriptionId - Subscription ID
 * @param {String} status - New status
 * @param {Object} additionalData - Additional data to update
 * @returns {Object} - Update result
 */
async function updateSubscriptionStatus(db, subscriptionId, status, additionalData = {}) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');

    const updateFields = {
      status,
      updatedAt: new Date(),
      ...additionalData
    };

    if (status === SUBSCRIPTION_STATUS.CANCELLED) {
      updateFields.cancelledAt = new Date();
    }

    const result = await subscriptionsCollection.updateOne(
      { _id: new ObjectId(subscriptionId) },
      { $set: updateFields }
    );

    // If cancelled, update counts
    if (status === SUBSCRIPTION_STATUS.CANCELLED && result.modifiedCount > 0) {
      const subscription = await subscriptionsCollection.findOne({ 
        _id: new ObjectId(subscriptionId) 
      });

      if (subscription) {
        await updateTierSubscriberCount(db, subscription.tierId, -1);
        await db.collection('users').updateOne(
          { _id: subscription.creatorId },
          { $inc: { 'creatorProfile.subscriberCount': -1 } }
        );
      }
    }

    return { success: result.modifiedCount > 0 };
  } catch (error) {
    console.error('Error updating subscription status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a subscription
 * @param {Object} db - MongoDB database instance
 * @param {String} subscriptionId - Subscription ID
 * @param {String} userId - User ID (for verification)
 * @param {Boolean} immediate - Cancel immediately or at period end
 * @returns {Object} - Cancel result
 */
async function cancelSubscription(db, subscriptionId, userId, immediate = false) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');

    // Verify user owns this subscription
    const subscription = await subscriptionsCollection.findOne({
      _id: new ObjectId(subscriptionId),
      subscriberId: new ObjectId(userId)
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found or unauthorized' };
    }

    if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) {
      return { success: false, error: 'Subscription already cancelled' };
    }

    const updateData = immediate 
      ? {} 
      : { cancelAtPeriodEnd: true };

    return await updateSubscriptionStatus(
      db, 
      subscriptionId, 
      immediate ? SUBSCRIPTION_STATUS.CANCELLED : subscription.status,
      updateData
    );
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upgrade/downgrade subscription tier
 * @param {Object} db - MongoDB database instance
 * @param {String} subscriptionId - Subscription ID
 * @param {String} newTierId - New tier ID
 * @param {String} userId - User ID (for verification)
 * @returns {Object} - Update result
 */
async function changeTier(db, subscriptionId, newTierId, userId) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');

    // Verify user owns this subscription
    const subscription = await subscriptionsCollection.findOne({
      _id: new ObjectId(subscriptionId),
      subscriberId: new ObjectId(userId),
      status: SUBSCRIPTION_STATUS.ACTIVE
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found or unauthorized' };
    }

    const oldTierId = subscription.tierId;

    // Update subscription
    const result = await subscriptionsCollection.updateOne(
      { _id: new ObjectId(subscriptionId) },
      { 
        $set: { 
          tierId: new ObjectId(newTierId),
          updatedAt: new Date()
        } 
      }
    );

    if (result.modifiedCount > 0) {
      // Update tier subscriber counts
      await updateTierSubscriberCount(db, oldTierId, -1);
      await updateTierSubscriberCount(db, newTierId, 1);
    }

    return { success: result.modifiedCount > 0 };
  } catch (error) {
    console.error('Error changing tier:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user has access to a specific tier's content
 * @param {Object} db - MongoDB database instance
 * @param {String} userId - User ID
 * @param {String} creatorId - Creator's user ID
 * @param {String} requiredTierId - Required tier ID (null for free content)
 * @returns {Object} - Access check result
 */
async function checkTierAccess(db, userId, creatorId, requiredTierId = null) {
  try {
    // Free content - everyone has access
    if (!requiredTierId) {
      return { success: true, hasAccess: true, reason: 'free_content' };
    }

    // Check if user is the creator themselves
    if (userId === creatorId || userId === creatorId.toString()) {
      return { success: true, hasAccess: true, reason: 'owner' };
    }

    const subscriptionsCollection = db.collection('subscriptions');
    const tiersCollection = db.collection('creatorTiers');

    // Get user's subscription to this creator
    const subscription = await subscriptionsCollection.findOne({
      subscriberId: new ObjectId(userId),
      creatorId: new ObjectId(creatorId),
      status: SUBSCRIPTION_STATUS.ACTIVE
    });

    if (!subscription) {
      return { success: true, hasAccess: false, reason: 'not_subscribed' };
    }

    // Get required tier and user's tier to compare
    const [requiredTier, userTier] = await Promise.all([
      tiersCollection.findOne({ _id: new ObjectId(requiredTierId) }),
      tiersCollection.findOne({ _id: subscription.tierId })
    ]);

    if (!requiredTier) {
      return { success: true, hasAccess: true, reason: 'tier_not_found' };
    }

    // User has access if their tier price is >= required tier price
    // This allows higher tiers to access lower tier content
    const hasAccess = userTier && userTier.price >= requiredTier.price;

    return { 
      success: true, 
      hasAccess,
      reason: hasAccess ? 'sufficient_tier' : 'insufficient_tier',
      userTier: userTier?.name,
      requiredTier: requiredTier?.name
    };
  } catch (error) {
    console.error('Error checking tier access:', error);
    return { success: false, hasAccess: false, error: error.message };
  }
}

/**
 * Get subscription stats for a creator
 * @param {Object} db - MongoDB database instance
 * @param {String} creatorId - Creator's user ID
 * @returns {Object} - Stats
 */
async function getCreatorSubscriptionStats(db, creatorId) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');

    const stats = await subscriptionsCollection.aggregate([
      { $match: { creatorId: new ObjectId(creatorId) } },
      {
        $group: {
          _id: null,
          totalSubscribers: { 
            $sum: { $cond: [{ $eq: ['$status', SUBSCRIPTION_STATUS.ACTIVE] }, 1, 0] } 
          },
          paidSubscribers: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$status', SUBSCRIPTION_STATUS.ACTIVE] },
                  { $eq: ['$isFreeSubscription', false] }
                ]}, 
                1, 
                0
              ] 
            }
          },
          freeSubscribers: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$status', SUBSCRIPTION_STATUS.ACTIVE] },
                  { $eq: ['$isFreeSubscription', true] }
                ]}, 
                1, 
                0
              ] 
            }
          },
          cancelledSubscribers: {
            $sum: { $cond: [{ $eq: ['$status', SUBSCRIPTION_STATUS.CANCELLED] }, 1, 0] }
          },
          pastDueSubscribers: {
            $sum: { $cond: [{ $eq: ['$status', SUBSCRIPTION_STATUS.PAST_DUE] }, 1, 0] }
          }
        }
      }
    ]).toArray();

    return {
      success: true,
      stats: stats[0] || {
        totalSubscribers: 0,
        paidSubscribers: 0,
        freeSubscribers: 0,
        cancelledSubscribers: 0,
        pastDueSubscribers: 0
      }
    };
  } catch (error) {
    console.error('Error getting subscription stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process Stripe webhook for subscription events
 * @param {Object} db - MongoDB database instance
 * @param {Object} event - Stripe webhook event
 * @returns {Object} - Processing result
 */
async function processStripeSubscriptionEvent(db, event) {
  try {
    const subscriptionsCollection = db.collection('subscriptions');
    const subscription = event.data.object;

    switch (event.type) {
      case 'customer.subscription.created':
        // Handled by checkout flow
        break;

      case 'customer.subscription.updated':
        await subscriptionsCollection.updateOne(
          { stripeSubscriptionId: subscription.id },
          {
            $set: {
              status: mapStripeStatus(subscription.status),
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              updatedAt: new Date()
            }
          }
        );
        break;

      case 'customer.subscription.deleted':
        const existingSub = await subscriptionsCollection.findOne({ 
          stripeSubscriptionId: subscription.id 
        });
        
        if (existingSub) {
          await updateSubscriptionStatus(db, existingSub._id.toString(), SUBSCRIPTION_STATUS.CANCELLED);
        }
        break;

      case 'invoice.payment_failed':
        await subscriptionsCollection.updateOne(
          { stripeSubscriptionId: subscription.subscription },
          {
            $set: {
              status: SUBSCRIPTION_STATUS.PAST_DUE,
              updatedAt: new Date()
            }
          }
        );
        break;

      case 'invoice.paid':
        await subscriptionsCollection.updateOne(
          { stripeSubscriptionId: subscription.subscription },
          {
            $set: {
              status: SUBSCRIPTION_STATUS.ACTIVE,
              currentPeriodEnd: new Date(subscription.period_end * 1000),
              updatedAt: new Date()
            }
          }
        );
        break;
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing Stripe subscription event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Map Stripe subscription status to internal status
 * @param {String} stripeStatus - Stripe status
 * @returns {String} - Internal status
 */
function mapStripeStatus(stripeStatus) {
  const statusMap = {
    'active': SUBSCRIPTION_STATUS.ACTIVE,
    'canceled': SUBSCRIPTION_STATUS.CANCELLED,
    'past_due': SUBSCRIPTION_STATUS.PAST_DUE,
    'paused': SUBSCRIPTION_STATUS.PAUSED,
    'incomplete': SUBSCRIPTION_STATUS.PENDING,
    'incomplete_expired': SUBSCRIPTION_STATUS.CANCELLED,
    'trialing': SUBSCRIPTION_STATUS.ACTIVE,
    'unpaid': SUBSCRIPTION_STATUS.PAST_DUE
  };
  return statusMap[stripeStatus] || SUBSCRIPTION_STATUS.PENDING;
}

/**
 * Subscribe to free tier (no Stripe required)
 * @param {Object} db - MongoDB database instance
 * @param {String} subscriberId - Subscriber's user ID
 * @param {String} creatorId - Creator's user ID
 * @param {String} tierId - Free tier ID
 * @returns {Object} - Subscription result
 */
async function subscribeToFreeTier(db, subscriberId, creatorId, tierId) {
  try {
    // Verify tier is free
    const tiersCollection = db.collection('creatorTiers');
    const tier = await tiersCollection.findOne({ _id: new ObjectId(tierId) });

    if (!tier || !tier.isFree) {
      return { success: false, error: 'Invalid free tier' };
    }

    return await createSubscription(db, {
      subscriberId,
      creatorId,
      tierId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      isFreeSubscription: true,
      currentPeriodEnd: null // Free tiers don't expire
    });
  } catch (error) {
    console.error('Error subscribing to free tier:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  SUBSCRIPTION_STATUS,
  createSubscription,
  getSubscription,
  getSubscriptionById,
  getSubscriberSubscriptions,
  getCreatorSubscribers,
  updateSubscriptionStatus,
  cancelSubscription,
  changeTier,
  checkTierAccess,
  getCreatorSubscriptionStats,
  processStripeSubscriptionEvent,
  mapStripeStatus,
  subscribeToFreeTier
};
