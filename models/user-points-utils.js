const { ObjectId } = require('mongodb');

/**
 * User Points Utility Functions
 * Provides easy-to-use functions for managing user points and gamification
 */

/**
 * Add points to a user
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {number} points - Points to add (positive number)
 * @param {string} reason - Reason for adding points
 * @param {string} source - Source of the points (e.g., 'chat', 'image', 'daily_login')
 * @returns {Object} Updated user data and transaction record
 */
async function addUserPoints(db, userId, points, reason = 'Points awarded', source = 'system', fastify = null) {
  if (points <= 0) throw new Error('Points must be positive');
  
  const usersCollection = db.collection('users');
  const pointsHistoryCollection = db.collection('points_history');
  
  // Create transaction record
  const transaction = {
    userId: new ObjectId(userId),
    type: 'credit',
    points: points,
    reason,
    source,
    createdAt: new Date()
  };
  
  // Add points to user and create history record
  const [userResult, historyResult] = await Promise.all([
    usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $inc: { points: points },
        $set: { lastPointsUpdate: new Date() }
      }
    ),
    pointsHistoryCollection.insertOne(transaction)
  ]);
  
  // Get updated user data
  const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });

  // Send refresh notification
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'refreshUserPoints', {
        userId: userId.toString()
      });
    } catch (notificationError) {
      console.error('Error sending refresh points notification:', notificationError);
    }
  }
  
  return {
    success: userResult.modifiedCount > 0,
    user: updatedUser,
    transaction: { ...transaction, _id: historyResult.insertedId }
  };
}

/**
 * Remove points from a user
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {number} points - Points to remove (positive number)
 * @param {string} reason - Reason for removing points
 * @param {string} source - Source of the deduction
 * @returns {Object} Updated user data and transaction record
 */
async function removeUserPoints(db, userId, points, reason = 'Points deducted', source = 'system', fastify = null) {
  if (points <= 0) throw new Error('Points must be positive');
  
  const usersCollection = db.collection('users');
  const pointsHistoryCollection = db.collection('points_history');
  
  // Check if user has enough points
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  const currentPoints = user.points || 0;
  if (currentPoints < points) {
    throw new Error(`Insufficient points. User has ${currentPoints}, trying to deduct ${points}`);
  }
  
  // Create transaction record
  const transaction = {
    userId: new ObjectId(userId),
    type: 'debit',
    points: points,
    reason,
    source,
    createdAt: new Date()
  };
  
  // Remove points from user and create history record
  const [userResult, historyResult] = await Promise.all([
    usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $inc: { points: -points },
        $set: { lastPointsUpdate: new Date() }
      }
    ),
    pointsHistoryCollection.insertOne(transaction)
  ]);
  
  // Get updated user data
  const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
  
  // Send refresh notification
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'refreshUserPoints', {
        userId: userId.toString()
      });
    } catch (notificationError) {
      console.error('Error sending refresh points notification:', notificationError);
    }
  }
  
  return {
    success: userResult.modifiedCount > 0,
    user: updatedUser,
    transaction: { ...transaction, _id: historyResult.insertedId }
  };
}

/**
 * Check user's current points
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @returns {number} Current points balance
 */
async function getUserPoints(db, userId) {
  const usersCollection = db.collection('users');
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  return user ? (user.points || 0) : 0;
}

/**
 * Get user's points history
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {number} limit - Number of records to return
 * @param {number} skip - Number of records to skip
 * @returns {Array} Points history records
 */
async function getUserPointsHistory(db, userId, limit = 50, skip = 0) {
  const pointsHistoryCollection = db.collection('points_history');
  return await pointsHistoryCollection
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .toArray();
}

/**
 * Award first login bonus for subscribed users (once per day)
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Result of the operation
 */
async function awardFirstLoginBonus(db, userId, fastify = null) {
  const usersCollection = db.collection('users');
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  // Get translations for the user's language
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};

  // Check if user is subscribed
  if (user.subscriptionStatus !== 'active') {
    return {
      success: false,
      message: 'User is not subscribed',
      reason: 'not_subscribed'
    };
  }

  // Use UTC for date calculations
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const lastFirstLoginBonus = user.lastFirstLoginBonus ? new Date(user.lastFirstLoginBonus) : null;
  const lastFirstLoginBonusUTC = lastFirstLoginBonus ? 
    new Date(Date.UTC(lastFirstLoginBonus.getUTCFullYear(), lastFirstLoginBonus.getUTCMonth(), lastFirstLoginBonus.getUTCDate())) : 
    null;
  
  // Check if first login bonus already claimed today
  if (lastFirstLoginBonusUTC && lastFirstLoginBonusUTC.getTime() === today.getTime()) {
    return {
      success: false,
      message: userPointsTranslations.first_login_bonus_already_claimed || 'First login bonus already claimed today',
      reason: 'already_claimed'
    };
  }

  // Award 100 points for first login bonus
  const pointsAwarded = 100;
  
  const result = await addUserPoints(
    db,
    userId,
    pointsAwarded,
    userPointsTranslations.points?.sources?.first_login_bonus || 'First Login Bonus (Subscriber)',
    'first_login_bonus',
    fastify
  );

  if (result.success) {
    // Update last first login bonus date
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          lastFirstLoginBonus: new Date()
        }
      }
    );

    // Send WebSocket notification
    if (fastify && fastify.sendNotificationToUser) {
      try {
        await fastify.sendNotificationToUser(userId.toString(), 'firstLoginBonus', {
          userId: userId.toString(),
          pointsAwarded,
          newBalance: result.user.points,
          message: userPointsTranslations.points?.sources?.first_login_bonus || 'First Login Bonus (Subscriber)',
          title: userPointsTranslations.subscriber_bonus_title || 'Subscriber Bonus!',
          welcomeMessage: userPointsTranslations.subscriber_welcome_message || 'Welcome back, premium member! Here\'s your daily subscriber bonus.'
        });
      } catch (notificationError) {
        console.error('Error sending first login bonus notification:', notificationError);
      }
    }

    return {
      success: true,
      pointsAwarded,
      user: result.user,
      message: userPointsTranslations.first_login_bonus_claimed?.replace('{points}', pointsAwarded) || `Subscriber bonus claimed! +${pointsAwarded} points`
    };
  } else {
    return {
      success: false,
      message: userPointsTranslations.failed_claim_first_login_bonus || 'Failed to award first login bonus'
    };
  }
}

/**
 * Award daily login bonus to a user
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @returns {Object} Result of the operation
 */
async function awardDailyLoginBonus(db, userId) {
  const usersCollection = db.collection('users');
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  // Use UTC for date calculations
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const lastBonus = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
  const lastBonusUTC = lastBonus ? new Date(Date.UTC(lastBonus.getUTCFullYear(), lastBonus.getUTCMonth(), lastBonus.getUTCDate())) : null;
  
  if (lastBonusUTC && lastBonusUTC.getTime() === today.getTime()) {
    const nextBonus = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return {
      success: false,
      message: 'Daily bonus already claimed today',
      nextBonus
    };
  }

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  let currentStreak = user.loginStreak || 0;

  if (lastBonusUTC && lastBonusUTC.getTime() === yesterday.getTime()) {
    currentStreak++;
  } else {
    currentStreak = 1; // Reset streak
  }

  // Calculate points - base 10 + streak bonus (1 point per day up to 10)
  const basePoints = 10;
  const streakBonus = Math.min(currentStreak, 10);
  const pointsAwarded = basePoints + streakBonus;

  const result = await addUserPoints(
    db,
    userId,
    pointsAwarded,
    `Daily Login Bonus (Day ${currentStreak})`,
    'daily_bonus'
  );

  if (result.success) {
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          lastDailyBonus: new Date(),
          loginStreak: currentStreak
        }
      }
    );

    const nextBonus = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    return {
      success: true,
      pointsAwarded,
      currentStreak,
      user: result.user,
      nextBonus
    };
  } else {
    return {
      success: false,
      message: 'Failed to award points'
    };
  }
}

/**
 * Set user points to a specific amount (admin function)
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {number} points - Points to set
 * @param {string} reason - Reason for setting points
 * @returns {Object} Updated user data
 */
async function setUserPoints(db, userId, points, reason, fastify = null) {
  if (points < 0) throw new Error('Points cannot be negative');
  
  const usersCollection = db.collection('users');
  const pointsHistoryCollection = db.collection('points_history');
  
  // Get user for translations
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user?.lang || 'en') : {};
  
  // Get current points to calculate difference
  const currentPoints = await getUserPoints(db, userId);
  const difference = points - currentPoints;
  
  // Create transaction record
  const transaction = {
    userId: new ObjectId(userId),
    type: difference >= 0 ? 'credit' : 'debit',
    points: Math.abs(difference),
    reason: reason || userPointsTranslations.admin_set_points || 'Points set by admin',
    source: 'admin',
    createdAt: new Date()
  };
  
  // Update user points and create history record
  const [userResult, historyResult] = await Promise.all([
    usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          points: points,
          lastPointsUpdate: new Date()
        }
      }
    ),
    difference !== 0 ? pointsHistoryCollection.insertOne(transaction) : Promise.resolve(null)
  ]);
  
  // Get updated user data
  const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
  
  // Send refresh notification
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'refreshUserPoints', {
        userId: userId.toString()
      });
    } catch (notificationError) {
      console.error('Error sending refresh points notification:', notificationError);
    }
  }
  
  return {
    success: userResult.modifiedCount > 0,
    user: updatedUser,
    transaction: difference !== 0 ? { ...transaction, _id: historyResult.insertedId } : null
  };
}

/**
 * Check if user has enough points for an action
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {number} requiredPoints - Points required
 * @returns {Object} Check result with user points info
 */
async function checkUserPoints(db, userId, requiredPoints) {
  const currentPoints = await getUserPoints(db, userId);
  return {
    hasEnough: currentPoints >= requiredPoints,
    currentPoints,
    requiredPoints,
    shortfall: Math.max(0, requiredPoints - currentPoints)
  };
}

/**
 * Get leaderboard
 * @param {Object} db - MongoDB database instance
 * @param {number} limit - Number of top users to return
 * @returns {Array} Top users by points
 */
async function getPointsLeaderboard(db, limit = 10) {
  const usersCollection = db.collection('users');
  return await usersCollection
    .find({ 
      isTemporary: { $ne: true },
      points: { $gt: 0 }
    })
    .sort({ points: -1 })
    .limit(limit)
    .project({
      _id: 1,
      nickname: 1,
      profileUrl: 1,
      points: 1,
      loginStreak: 1
    })
    .toArray();
}

/**
 * Like Reward Management Functions
 * Handle rewards for user engagement with likes
 */

/**
 * Award points for liking images based on milestones
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result with points awarded
 */
async function awardLikeMilestoneReward(db, userId, fastify = null) {
  const usersCollection = db.collection('users');
  const imagesLikesCollection = db.collection('images_likes');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};
  
  // Count total likes by user
  const totalLikes = await imagesLikesCollection.countDocuments({ userId: new ObjectId(userId) });
  
  // Define milestone rewards (likes -> points)
  const milestones = {
    1: { points: 5, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.first_like || 'First like!' },
    5: { points: 10, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.fifth_like || '5 likes milestone!' },
    10: { points: 15, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.tenth_like || '10 likes milestone!' },
    25: { points: 25, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.twenty_fifth_like || '25 likes milestone!' },
    50: { points: 50, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.fiftieth_like || '50 likes milestone!' },
    100: { points: 100, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.hundredth_like || '100 likes milestone!' },
    250: { points: 150, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.two_fifty_like || '250 likes milestone!' },
    500: { points: 250, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.five_hundred_like || '500 likes milestone!' },
    1000: { points: 500, message: userPointsTranslations.points?.like_rewards?.milestone_rewards?.thousand_like || '1000 likes milestone!' }
  };
  
  // Check if current like count hits a milestone
  const milestone = milestones[totalLikes];
  if (!milestone) {
    return {
      success: false,
      totalLikes,
      message: 'No milestone reached'
    };
  }
  
  // Check if milestone already granted
  const existingMilestone = await milestonesCollection.findOne({
    userId: new ObjectId(userId),
    type: 'like_milestone',
    milestone: totalLikes
  });
  
  if (existingMilestone) {
    return {
      success: false,
      totalLikes,
      message: 'Milestone already granted',
      alreadyGranted: true
    };
  }
  
  // Award milestone points
  const result = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    userPointsTranslations.points?.like_rewards?.milestone_title || `Like milestone: ${milestone.message}`, 
    'like_milestone',
    fastify
  );
  
  // Record milestone as granted
  await milestonesCollection.insertOne({
    userId: new ObjectId(userId),
    type: 'like_milestone',
    milestone: totalLikes,
    points: milestone.points,
    message: milestone.message,
    grantedAt: new Date()
  });
  
  // Send websocket notification for milestone reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'likeRewardNotification', {
        userId: userId.toString(),
        points: milestone.points,
        reason: milestone.message,
        source: 'like_milestone',
        isMilestone: true,
        milestoneMessage: milestone.message,
        totalLikes: totalLikes
      });
    } catch (notificationError) {
      console.error('Error sending milestone reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    totalLikes,
    pointsAwarded: milestone.points,
    milestoneMessage: milestone.message,
    ...result
  };
}

/**
 * Award small points for each like action (optional base reward)
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result
 */
async function awardLikeActionReward(db, userId, fastify = null) {
  
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user?.lang || 'en') : {};

  const basePoints = 1; // 1 point per like
  
  const result = await addUserPoints(
    db, 
    userId, 
    basePoints, 
    userPointsTranslations.points?.actions?.liked_an_image || 'Liked an image', 
    'like_action',
    fastify
  );
  
  return {
    success: true,
    pointsAwarded: basePoints,
    ...result
  };
}

/**
 * Image Generation Reward Management Functions
 * Handle rewards for user image generation milestones
 */

/**
 * Award points for image generation milestones
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result with points awarded
 */
async function awardImageMilestoneReward(db, userId, fastify = null) {
  const usersCollection = db.collection('users');
  const galleryCollection = db.collection('gallery');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};
  
  // Count total images generated by user
  const userGallery = await galleryCollection.findOne({ userId: new ObjectId(userId) });
  const totalImages = userGallery?.images?.length || 0;
  
  // Define milestone rewards (images -> points)
  const milestones = {
    1: { points: 10, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.first_image || 'First image generated!' },
    5: { points: 20, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.fifth_image || '5 images milestone!' },
    10: { points: 30, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.tenth_image || '10 images milestone!' },
    25: { points: 50, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.twenty_fifth_image || '25 images milestone!' },
    50: { points: 75, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.fiftieth_image || '50 images milestone!' },
    100: { points: 150, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.hundredth_image || '100 images milestone!' },
    250: { points: 250, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.two_fifty_image || '250 images milestone!' },
    500: { points: 400, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.five_hundred_image || '500 images milestone!' },
    1000: { points: 750, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.thousand_image || '1000 images milestone!' }
  };
  
  // Check if current image count hits a milestone
  const milestone = milestones[totalImages];
  if (!milestone) {
    return {
      success: false,
      totalImages,
      message: 'No milestone reached'
    };
  }
  
  // Check if milestone already granted
  const existingMilestone = await milestonesCollection.findOne({
    userId: new ObjectId(userId),
    type: 'image_milestone',
    milestone: totalImages
  });
  
  if (existingMilestone) {
    return {
      success: false,
      totalImages,
      message: 'Milestone already granted',
      alreadyGranted: true
    };
  }
  
  // Award milestone points
  const result = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    userPointsTranslations.points?.image_generation?.milestone_title || `Image generation milestone: ${milestone.message}`, 
    'image_milestone',
    fastify
  );
  
  // Record milestone as granted
  await milestonesCollection.insertOne({
    userId: new ObjectId(userId),
    type: 'image_milestone',
    milestone: totalImages,
    points: milestone.points,
    message: milestone.message,
    grantedAt: new Date()
  });
  
  // Send websocket notification for milestone reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'imageGenerationMilestone', {
        userId: userId.toString(),
        points: milestone.points,
        reason: milestone.message,
        source: 'image_milestone',
        milestone: totalImages,
        totalImages: totalImages,
        isMilestone: true
      });
    } catch (notificationError) {
      console.error('Error sending image milestone reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    totalImages,
    pointsAwarded: milestone.points,
    milestoneMessage: milestone.message,
    ...result
  };
}

/**
 * Award small points for each image generation action
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result
 */
async function awardImageGenerationReward(db, userId, fastify = null) {
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user?.lang || 'en') : {};
  
  const basePoints = 2; // 2 points per image generated
  
  const result = await addUserPoints(
    db, 
    userId, 
    basePoints, 
    userPointsTranslations.points?.sources?.image || 'Generated an image',  
    'image_generation',
    fastify
  );
  
  // Send websocket notification for image generation reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'imageGenerationReward', {
        userId: userId.toString(),
        points: basePoints,
        reason: userPointsTranslations.points?.sources?.image || 'Generated an image',
        source: 'image_generation',
        isMilestone: false
      });
    } catch (notificationError) {
      console.error('Error sending image generation reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    pointsAwarded: basePoints,
    ...result
  };
}

module.exports = {
  addUserPoints,
  removeUserPoints,
  getUserPoints,
  getUserPointsHistory,
  awardFirstLoginBonus,
  awardDailyLoginBonus,
  setUserPoints,
  checkUserPoints,
  getPointsLeaderboard,
  // Like reward functions
  awardLikeMilestoneReward,
  awardLikeActionReward,
  // Image generation reward functions
  awardImageMilestoneReward,
  awardImageGenerationReward
};
