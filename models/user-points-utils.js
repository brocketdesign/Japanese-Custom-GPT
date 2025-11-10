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

  // Check if user already has 10000 or more points
  const currentPoints = user.points || 0;
  const MAX_POINTS_CAP = 10000;
  
  if (currentPoints >= MAX_POINTS_CAP) {
    return {
      success: false,
      message: userPointsTranslations.first_login_bonus_max_cap || 'You have reached the maximum points cap',
      reason: 'max_cap_reached',
      currentPoints
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

  // Award 1000 points for first login bonus, but cap at 10000 total
  let pointsAwarded = 1000;
  if (currentPoints + pointsAwarded > MAX_POINTS_CAP) {
    pointsAwarded = MAX_POINTS_CAP - currentPoints;
  }
  
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
async function awardDailyLoginBonus(db, userId, fastify = null) {
  const usersCollection = db.collection('users');
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const lastBonus = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
  const lastBonusUTC = lastBonus
    ? new Date(Date.UTC(lastBonus.getUTCFullYear(), lastBonus.getUTCMonth(), lastBonus.getUTCDate()))
    : null;

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
    currentStreak = 1;
  }

  const baseReward = 100;
  const streakBonus = Math.min(currentStreak, 10) * 10;
  const milestoneBonus = currentStreak % 7 === 0 ? 500 : 0;
  const superMilestoneBonus = currentStreak === 30 ? 1000 : 0;
  const pointsAwarded = baseReward + streakBonus + milestoneBonus + superMilestoneBonus;

  const result = await addUserPoints(
    db,
    userId,
    pointsAwarded,
    `Daily Login Bonus (Day ${currentStreak})`,
    'daily_bonus',
    fastify
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
  }

  return {
    success: false,
    message: 'Failed to award points'
  };
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

  const basePoints = 5; // 5 points per like

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
  
  // Define milestone rewards (images -> points) - Global milestones starting at 15
  const milestones = {
    15: { points: 50, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.fifteen_images || '15 images milestone!' },
    30: { points: 75, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.thirty_images || '30 images milestone!' },
    50: { points: 100, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.fifty_images || '50 images milestone!' },
    100: { points: 200, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.hundred_images || '100 images milestone!' },
    250: { points: 350, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.two_fifty_images || '250 images milestone!' },
    500: { points: 500, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.five_hundred_images || '500 images milestone!' },
    1000: { points: 1000, message: userPointsTranslations.points?.image_generation?.milestone_rewards?.thousand_images || '1000 images milestone!' }
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
  // No base points awarded - only check for milestone achievements
  try {
    const milestoneResult = await awardImageMilestoneReward(db, userId, fastify);
    return {
      success: true,
      pointsAwarded: 0,
      milestoneResult
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to check image generation milestones',
      error: error.message
    };
  }
}

/**
 * Video Generation Milestone Reward Functions
 * Handle rewards for user video generation milestones
 */

/**
 * Award points for video generation milestones
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result with points awarded
 */
async function awardVideoMilestoneReward(db, userId, fastify = null) {
  const usersCollection = db.collection('users');
  const userChatCollection = db.collection('userChat');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};
  
  // Count total videos generated by user across all chats
  const pipeline = [
    { $match: { userId: new ObjectId(userId) } },
    { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
    { $match: { 'messages.video_url': { $exists: true, $ne: null } } },
    { $group: { _id: null, totalVideos: { $sum: 1 } } }
  ];
  
  const result = await userChatCollection.aggregate(pipeline).toArray();
  const totalVideos = result[0]?.totalVideos || 0;
  
  // Define milestone rewards (videos -> points) - Global milestones starting at 15
  const milestones = {
    15: { points: 100, message: userPointsTranslations.points?.video_generation?.milestone_rewards?.fifteen_videos || '15 videos milestone!' },
    30: { points: 150, message: userPointsTranslations.points?.video_generation?.milestone_rewards?.thirty_videos || '30 videos milestone!' },
    50: { points: 250, message: userPointsTranslations.points?.video_generation?.milestone_rewards?.fifty_videos || '50 videos milestone!' },
    100: { points: 400, message: userPointsTranslations.points?.video_generation?.milestone_rewards?.hundred_videos || '100 videos milestone!' },
    250: { points: 750, message: userPointsTranslations.points?.video_generation?.milestone_rewards?.two_fifty_videos || '250 videos milestone!' },
    500: { points: 1200, message: userPointsTranslations.points?.video_generation?.milestone_rewards?.five_hundred_videos || '500 videos milestone!' }
  };
  
  // Check if current video count hits a milestone
  const milestone = milestones[totalVideos];
  if (!milestone) {
    return {
      success: false,
      totalVideos,
      message: 'No milestone reached'
    };
  }
  
  // Check if milestone already granted
  const existingMilestone = await milestonesCollection.findOne({
    userId: new ObjectId(userId),
    type: 'video_milestone',
    milestone: totalVideos
  });
  
  if (existingMilestone) {
    return {
      success: false,
      totalVideos,
      message: 'Milestone already granted',
      alreadyGranted: true
    };
  }
  
  // Award milestone points
  const pointsResult = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    userPointsTranslations.points?.video_generation?.milestone_title || `Video generation milestone: ${milestone.message}`, 
    'video_milestone',
    fastify
  );
  
  // Record milestone as granted
  await milestonesCollection.insertOne({
    userId: new ObjectId(userId),
    type: 'video_milestone',
    milestone: totalVideos,
    points: milestone.points,
    message: milestone.message,
    grantedAt: new Date()
  });
  
  // Send websocket notification for milestone reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'videoGenerationMilestone', {
        userId: userId.toString(),
        points: milestone.points,
        reason: milestone.message,
        source: 'video_milestone',
        milestone: totalVideos,
        totalVideos: totalVideos,
        isMilestone: true
      });
    } catch (notificationError) {
      console.error('Error sending video milestone reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    totalVideos,
    pointsAwarded: milestone.points,
    milestoneMessage: milestone.message,
    ...pointsResult
  };
}

/**
 * Award small points for each video generation action
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result
 */
async function awardVideoGenerationReward(db, userId, fastify = null) {
  // No base points awarded - only check for milestone achievements
  try {
    const milestoneResult = await awardVideoMilestoneReward(db, userId, fastify);
    return {
      success: true,
      pointsAwarded: 0,
      milestoneResult
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to check video generation milestones',
      error: error.message
    };
  }
}

/**
 * Message Count Milestone Reward Functions
 * Handle rewards for user messaging milestones
 */

/**
 * Award points for message count milestones
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID for character-specific milestones
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result with points awarded
 */
async function awardMessageMilestoneReward(db, userId, chatId = null, fastify = null) {
  const usersCollection = db.collection('users');
  const userChatCollection = db.collection('userChat');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};
  
  let totalMessages = 0;
  let milestoneKey = 'global_messages';
  
  if (chatId) {
    // Character-specific message count - count all user messages for this chat
    const pipeline = [
      { $match: { 
          userId: new ObjectId(userId),
          chatId: new ObjectId(chatId)
        }
      },
      { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
      { $match: { 'messages.role': 'user' } },
      { $group: { _id: null, totalMessages: { $sum: 1 } } }
    ];
    
    const result = await userChatCollection.aggregate(pipeline).toArray();
    totalMessages = result[0]?.totalMessages || 0;
    milestoneKey = `chat_${chatId}_messages`;
  } else {
    // Global message count across all chats
    const pipeline = [
      { $match: { userId: new ObjectId(userId) } },
      { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
      { $match: { 'messages.role': 'user' } },
      { $group: { _id: null, totalMessages: { $sum: 1 } } }
    ];
    
    const result = await userChatCollection.aggregate(pipeline).toArray();
    totalMessages = result[0]?.totalMessages || 0;
  }
  
  // Define milestone rewards (messages -> points)
  const milestones = {
    10: { points: 20, message: userPointsTranslations.points?.message_count?.milestone_rewards?.ten_messages || '10 messages milestone!' },
    25: { points: 35, message: userPointsTranslations.points?.message_count?.milestone_rewards?.twenty_five_messages || '25 messages milestone!' },
    50: { points: 50, message: userPointsTranslations.points?.message_count?.milestone_rewards?.fifty_messages || '50 messages milestone!' },
    100: { points: 75, message: userPointsTranslations.points?.message_count?.milestone_rewards?.hundred_messages || '100 messages milestone!' },
    250: { points: 125, message: userPointsTranslations.points?.message_count?.milestone_rewards?.two_fifty_messages || '250 messages milestone!' },
    500: { points: 200, message: userPointsTranslations.points?.message_count?.milestone_rewards?.five_hundred_messages || '500 messages milestone!' },
    1000: { points: 350, message: userPointsTranslations.points?.message_count?.milestone_rewards?.thousand_messages || '1000 messages milestone!' },
    2500: { points: 600, message: userPointsTranslations.points?.message_count?.milestone_rewards?.twenty_five_hundred_messages || '2500 messages milestone!' }
  };
  
  // Check if current message count hits a milestone
  const milestone = milestones[totalMessages];
  if (!milestone) {
    return {
      success: false,
      totalMessages,
      message: 'No milestone reached'
    };
  }
  
  // Check if milestone already granted
  const existingMilestone = await milestonesCollection.findOne({
    userId: new ObjectId(userId),
    type: 'message_milestone',
    milestoneKey: milestoneKey,
    milestone: totalMessages
  });
  
  if (existingMilestone) {
    return {
      success: false,
      totalMessages,
      message: 'Milestone already granted',
      alreadyGranted: true
    };
  }
  
  // Award milestone points
  const pointsResult = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    userPointsTranslations.points?.message_count?.milestone_title || `Message milestone: ${milestone.message}`, 
    'message_milestone',
    fastify
  );
  
  // Record milestone as granted
  await milestonesCollection.insertOne({
    userId: new ObjectId(userId),
    type: 'message_milestone',
    milestoneKey: milestoneKey,
    milestone: totalMessages,
    points: milestone.points,
    message: milestone.message,
    chatId: chatId ? new ObjectId(chatId) : null,
    grantedAt: new Date()
  });
  
  // Send websocket notification for milestone reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'messageMilestone', {
        userId: userId.toString(),
        points: milestone.points,
        reason: milestone.message,
        source: 'message_milestone',
        milestone: totalMessages,
        totalMessages: totalMessages,
        chatId: chatId?.toString(),
        isMilestone: true
      });
    } catch (notificationError) {
      console.error('Error sending message milestone reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    totalMessages,
    pointsAwarded: milestone.points,
    milestoneMessage: milestone.message,
    ...pointsResult
  };
}

/**
 * Character-Specific Milestone Functions
 * Handle rewards for character-specific milestones (images, videos, messages per chat)
 */

/**
 * Award points for character-specific image generation milestones
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID for character-specific tracking
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result with points awarded
 */
async function awardCharacterImageMilestoneReward(db, userId, chatId, fastify = null) {
  const usersCollection = db.collection('users');
  const galleryCollection = db.collection('gallery');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};
  
  // Count images generated for this specific character/chat
  const userGallery = await galleryCollection.findOne({
    userId: new ObjectId(userId),
    chatId: new ObjectId(chatId)
  });
  const totalImages = userGallery?.images?.length || 0;
  
  // Define character-specific milestone rewards (lower thresholds than global)
  const milestones = {
    5: { points: 25, message: userPointsTranslations.points?.character_image?.milestone_rewards?.five_images || '5 images with this character!' },
    10: { points: 35, message: userPointsTranslations.points?.character_image?.milestone_rewards?.ten_images || '10 images with this character!' },
    25: { points: 60, message: userPointsTranslations.points?.character_image?.milestone_rewards?.twenty_five_images || '25 images with this character!' },
    50: { points: 100, message: userPointsTranslations.points?.character_image?.milestone_rewards?.fifty_images || '50 images with this character!' },
    100: { points: 200, message: userPointsTranslations.points?.character_image?.milestone_rewards?.hundred_images || '100 images with this character!' }
  };
  
  // Check if current image count hits a milestone
  const milestone = milestones[totalImages];
  if (!milestone) {
    // Send goals refresh notification even if no milestone is reached
    if (fastify && fastify.sendNotificationToUser) {
      try {
        await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
          userId: userId.toString(),
          chatId: chatId.toString(),
          type: 'character_image_progress',
          totalImages: totalImages
        });
      } catch (notificationError) {
        console.error('Error sending character image progress notification:', notificationError);
      }
    }
    
    return {
      success: false,
      totalImages,
      message: 'No character milestone reached'
    };
  }
  
  // Check if milestone already granted for this character
  const existingMilestone = await milestonesCollection.findOne({
    userId: new ObjectId(userId),
    type: 'character_image_milestone',
    chatId: new ObjectId(chatId),
    milestone: totalImages
  });
  
  if (existingMilestone) {
    // Send goals refresh notification even if milestone is already granted
    if (fastify && fastify.sendNotificationToUser) {
      try {
        await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
          userId: userId.toString(),
          chatId: chatId.toString(),
          type: 'character_image_already_granted',
          totalImages: totalImages
        });
      } catch (notificationError) {
        console.error('Error sending character image already granted notification:', notificationError);
      }
    }
    
    return {
      success: false,
      totalImages,
      message: 'Character milestone already granted',
      alreadyGranted: true
    };
  }
  
  // Award milestone points
  const pointsResult = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    userPointsTranslations.points?.character_image?.milestone_title || `Character image milestone: ${milestone.message}`, 
    'character_image_milestone',
    fastify
  );
  
  // Record milestone as granted
  await milestonesCollection.insertOne({
    userId: new ObjectId(userId),
    type: 'character_image_milestone',
    chatId: new ObjectId(chatId),
    milestone: totalImages,
    points: milestone.points,
    message: milestone.message,
    grantedAt: new Date()
  });
  
  // Send websocket notification for milestone reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'characterImageMilestone', {
        userId: userId.toString(),
        points: milestone.points,
        reason: milestone.message,
        source: 'character_image_milestone',
        milestone: totalImages,
        totalImages: totalImages,
        chatId: chatId.toString(),
        isMilestone: true
      });
      
      // Also send goals refresh notification
      await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
        userId: userId.toString(),
        chatId: chatId.toString(),
        type: 'character_image_milestone'
      });
    } catch (notificationError) {
      console.error('Error sending character image milestone reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    totalImages,
    pointsAwarded: milestone.points,
    milestoneMessage: milestone.message,
    ...pointsResult
  };
}

/**
 * Award points for character-specific video generation milestones
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID for character-specific tracking
 * @param {Object} fastify - Fastify instance for sending notifications
 * @returns {Object} Reward result with points awarded
 */
async function awardCharacterVideoMilestoneReward(db, userId, chatId, fastify = null) {
  const usersCollection = db.collection('users');
  const userChatCollection = db.collection('userChat');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};
  
  // Count videos generated for this specific character/chat
  const pipeline = [
    { $match: { 
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId)
      }
    },
    { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
    { $match: { 'messages.video_url': { $exists: true, $ne: null } } },
    { $group: { _id: null, totalVideos: { $sum: 1 } } }
  ];
  
  const result = await userChatCollection.aggregate(pipeline).toArray();
  const totalVideos = result[0]?.totalVideos || 0;
  
  // Define character-specific milestone rewards (lower thresholds than global)
  const milestones = {
    3: { points: 50, message: userPointsTranslations.points?.character_video?.milestone_rewards?.three_videos || '3 videos with this character!' },
    5: { points: 75, message: userPointsTranslations.points?.character_video?.milestone_rewards?.five_videos || '5 videos with this character!' },
    10: { points: 100, message: userPointsTranslations.points?.character_video?.milestone_rewards?.ten_videos || '10 videos with this character!' },
    20: { points: 200, message: userPointsTranslations.points?.character_video?.milestone_rewards?.twenty_videos || '20 videos with this character!' },
    50: { points: 400, message: userPointsTranslations.points?.character_video?.milestone_rewards?.fifty_videos || '50 videos with this character!' }
  };
  
  // Check if current video count hits a milestone
  const milestone = milestones[totalVideos];
  if (!milestone) {
    // Send goals refresh notification even if no milestone is reached
    if (fastify && fastify.sendNotificationToUser) {
      try {
        await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
          userId: userId.toString(),
          chatId: chatId.toString(),
          type: 'character_video_progress',
          totalVideos: totalVideos
        });
      } catch (notificationError) {
        console.error('Error sending character video progress notification:', notificationError);
      }
    }
    
    return {
      success: false,
      totalVideos,
      message: 'No character milestone reached'
    };
  }
  
  // Check if milestone already granted for this character
  const existingMilestone = await milestonesCollection.findOne({
    userId: new ObjectId(userId),
    type: 'character_video_milestone',
    chatId: new ObjectId(chatId),
    milestone: totalVideos
  });
  
  if (existingMilestone) {
    // Send goals refresh notification even if milestone is already granted
    if (fastify && fastify.sendNotificationToUser) {
      try {
        await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
          userId: userId.toString(),
          chatId: chatId.toString(),
          type: 'character_video_already_granted',
          totalVideos: totalVideos
        });
      } catch (notificationError) {
        console.error('Error sending character video already granted notification:', notificationError);
      }
    }
    
    return {
      success: false,
      totalVideos,
      message: 'Character milestone already granted',
      alreadyGranted: true
    };
  }
  
  // Award milestone points
  const pointsResult = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    userPointsTranslations.points?.character_video?.milestone_title || `Character video milestone: ${milestone.message}`, 
    'character_video_milestone',
    fastify
  );
  
  // Record milestone as granted
  await milestonesCollection.insertOne({
    userId: new ObjectId(userId),
    type: 'character_video_milestone',
    chatId: new ObjectId(chatId),
    milestone: totalVideos,
    points: milestone.points,
    message: milestone.message,
    grantedAt: new Date()
  });
  
  // Send websocket notification for milestone reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'characterVideoMilestone', {
        userId: userId.toString(),
        points: milestone.points,
        reason: milestone.message,
        source: 'character_video_milestone',
        milestone: totalVideos,
        totalVideos: totalVideos,
        chatId: chatId.toString(),
        isMilestone: true
      });
      
      // Also send goals refresh notification
      await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
        userId: userId.toString(),
        chatId: chatId.toString(),
        type: 'character_video_milestone'
      });
    } catch (notificationError) {
      console.error('Error sending character video milestone reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    totalVideos,
    pointsAwarded: milestone.points,
    milestoneMessage: milestone.message,
    ...pointsResult
  };
}

/**
 * Award milestone rewards for character-specific messages
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID (required for character-specific milestones)
 * @param {Object} fastify - Fastify instance for notifications (optional)
 * @returns {Object} Result of milestone check and potential reward
 */
async function awardCharacterMessageMilestoneReward(db, userId, chatId, fastify = null) {
  console.log('🔥 [MILESTONE FUNCTION] Called for user:', userId?.toString(), 'chat:', chatId?.toString());
  
  const usersCollection = db.collection('users');
  const userChatCollection = db.collection('userChat');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) {
    console.log('❌ [DEBUG] User not found for userId:', userId);
    throw new Error('User not found');
  }
  
  console.log('✅ [DEBUG] User found:', { userId: user._id.toString(), lang: user.lang });
  
  const userPointsTranslations = fastify ? fastify.getUserPointsTranslations(user.lang || 'en') : {};
  
  // Count messages sent to this specific character/chat
  const pipeline = [
    { $match: { 
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId)
      }
    },
    { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
    { $match: { 'messages.role': 'user' } },
    { $group: { _id: null, totalMessages: { $sum: 1 } } }
  ];
  
  console.log('🔍 [DEBUG] Message count pipeline:', JSON.stringify(pipeline, null, 2));
  
  const result = await userChatCollection.aggregate(pipeline).toArray();
  const totalMessages = result[0]?.totalMessages || 0;
  
  console.log('📊 [DEBUG] Message count result:', {
    aggregationResult: result,
    totalMessages,
    chatId: chatId?.toString()
  });
  
  // Define character-specific milestone rewards (lower thresholds than global)
  const milestones = {
    10: { points: 25, message: userPointsTranslations.points?.character_messages?.milestone_rewards?.ten_messages || '10 messages with this character!' },
    25: { points: 35, message: userPointsTranslations.points?.character_messages?.milestone_rewards?.twenty_five_messages || '25 messages with this character!' },
    50: { points: 60, message: userPointsTranslations.points?.character_messages?.milestone_rewards?.fifty_messages || '50 messages with this character!' },
    100: { points: 100, message: userPointsTranslations.points?.character_messages?.milestone_rewards?.hundred_messages || '100 messages with this character!' },
    250: { points: 200, message: userPointsTranslations.points?.character_messages?.milestone_rewards?.two_fifty_messages || '250 messages with this character!' }
  };
  
  console.log('🎯 [MILESTONE CHECK] Current message count:', totalMessages, '- Checking milestones...');
  
  // Check if current message count hits a milestone
  const milestone = milestones[totalMessages];
  
  if (milestone) {
    console.log('� [MILESTONE HIT] Found milestone for', totalMessages, 'messages! Points:', milestone.points);
  } else {
    console.log('⚪ [MILESTONE] No milestone at', totalMessages, 'messages. Next milestones: 10, 25, 50, 100, 250');
  }
  
  if (!milestone) {
<<<<<<< Updated upstream
    console.log('⚠️ [DEBUG] No milestone reached for count:', totalMessages);
=======
    // Send goals refresh notification even if no milestone is reached
    if (fastify && fastify.sendNotificationToUser) {
      try {
        await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
          userId: userId.toString(),
          chatId: chatId.toString(),
          type: 'character_message_progress',
          totalMessages: totalMessages
        });
      } catch (notificationError) {
        console.error('Error sending character message progress notification:', notificationError);
      }
    }
    
>>>>>>> Stashed changes
    return {
      success: false,
      totalMessages,
      message: 'No character milestone reached'
    };
  }
  
  // Check if this milestone was already granted for this character
  const milestoneQuery = {
    userId: new ObjectId(userId),
    type: 'character_message_milestone',
    chatId: new ObjectId(chatId),
    milestone: totalMessages
  };
  
  console.log('🔍 [DEBUG] Checking existing milestone with query:', milestoneQuery);
  
  const existingMilestone = await milestonesCollection.findOne(milestoneQuery);
  
  console.log('🔍 [DEBUG] Existing milestone found:', existingMilestone);
  
  if (existingMilestone) {
    console.log('⚠️ [DEBUG] Milestone already granted, skipping');
    return {
      success: false,
      totalMessages,
      message: 'Character milestone already granted',
      alreadyGranted: true
    };
  }
  
  console.log('💰 [DEBUG] Awarding points:', {
    points: milestone.points,
    message: milestone.message,
    userId: userId?.toString()
  });
  
  // Award milestone points
  const pointsResult = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    userPointsTranslations.points?.character_messages?.milestone_title || `Character message milestone: ${milestone.message}`, 
    'character_message_milestone',
    fastify
  );
  
  console.log('💰 [DEBUG] Points awarded result:', pointsResult);
  
  // Record milestone as granted
  await milestonesCollection.insertOne({
    userId: new ObjectId(userId),
    type: 'character_message_milestone',
    chatId: new ObjectId(chatId),
    milestone: totalMessages,
    points: milestone.points,
    message: milestone.message,
    grantedAt: new Date()
  });
  
  // Send websocket notification for milestone reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      console.log('🔔 [WEBSOCKET] >>> Sending milestone notification to user:', userId.toString());
      console.log('🔔 [WEBSOCKET] Milestone data - Points:', milestone.points, 'Messages:', totalMessages, 'Type: messages');
      
      // Send milestone achievement notification
      await fastify.sendNotificationToUser(userId.toString(), 'milestoneAchieved', {
        userId: userId.toString(),
        points: milestone.points,
        reason: milestone.message,
        source: 'character_message_milestone',
        milestone: totalMessages,
        totalMessages: totalMessages,
        chatId: chatId.toString(),
        isMilestone: true,
        milestoneMessage: milestone.message,
        milestoneType: 'messages'
      });
      
<<<<<<< Updated upstream
      console.log('🔔 [WEBSOCKET] Milestone notification sent successfully!');
=======
      // Also send goals refresh notification
      await fastify.sendNotificationToUser(userId.toString(), 'refreshGoals', {
        userId: userId.toString(),
        chatId: chatId.toString(),
        type: 'character_message_milestone'
      });
      
>>>>>>> Stashed changes
    } catch (notificationError) {
      console.error('❌ [DEBUG] Error sending character message milestone reward notification:', notificationError);
    }
  }
  
  return {
    success: true,
    totalMessages,
    pointsAwarded: milestone.points,
    milestoneMessage: milestone.message,
    ...pointsResult
  };
}

/**
 * Get user's milestone progress for all types
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Optional chat ID for character-specific goals
 * @returns {Object} Milestone progress data
 */
async function getUserMilestoneProgress(db, userId, chatId = null) {
  const usersCollection = db.collection('users');
  const userChatCollection = db.collection('userChat');
  const galleryCollection = db.collection('gallery');
  const milestonesCollection = db.collection('user_milestones');
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  let totalImages = 0;
  let totalVideos = 0;
  
  if (chatId) {
    // Character-specific counts
    const userGallery = await galleryCollection.findOne({ 
      userId: new ObjectId(userId),
      chatId: new ObjectId(chatId)
    });
    totalImages = userGallery?.images?.length || 0;
    
    const videoPipeline = [
      { $match: { 
          userId: new ObjectId(userId),
          chatId: new ObjectId(chatId)
        }
      },
      { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
      { $match: { 'messages.video_url': { $exists: true, $ne: null } } },
      { $group: { _id: null, totalVideos: { $sum: 1 } } }
    ];
    const videoResult = await userChatCollection.aggregate(videoPipeline).toArray();
    totalVideos = videoResult[0]?.totalVideos || 0;
  } else {
    // Global counts
    const userGallery = await galleryCollection.findOne({ userId: new ObjectId(userId) });
    totalImages = userGallery?.images?.length || 0;
    
    const videoPipeline = [
      { $match: { userId: new ObjectId(userId) } },
      { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
      { $match: { 'messages.video_url': { $exists: true, $ne: null } } },
      { $group: { _id: null, totalVideos: { $sum: 1 } } }
    ];
    const videoResult = await userChatCollection.aggregate(videoPipeline).toArray();
    totalVideos = videoResult[0]?.totalVideos || 0;
  }
  
  // Message count progress
  let totalMessages = 0;
  if (chatId) {
    console.log('📈 [MESSAGE COUNT] Counting messages for chat:', chatId?.toString());
    
    // Character-specific message count - count all user messages for this chat
    const messagePipeline = [
      { $match: { 
          userId: new ObjectId(userId),
          chatId: new ObjectId(chatId)
        }
      },
      { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
      { $match: { 'messages.role': 'user' } },
      { $group: { _id: null, totalMessages: { $sum: 1 } } }
    ];
    
    const messageResult = await userChatCollection.aggregate(messagePipeline).toArray();
    totalMessages = messageResult[0]?.totalMessages || 0;
    
    console.log('📈 [MESSAGE COUNT] Found', totalMessages, 'user messages for chat:', chatId?.toString());
  } else {
    // Global message count
    const messagePipeline = [
      { $match: { userId: new ObjectId(userId) } },
      { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
      { $match: { 'messages.role': 'user' } },
      { $group: { _id: null, totalMessages: { $sum: 1 } } }
    ];
    const messageResult = await userChatCollection.aggregate(messagePipeline).toArray();
    totalMessages = messageResult[0]?.totalMessages || 0;
  }
  
  // Define milestone thresholds based on scope
  let imageMilestones, videoMilestones, messageMilestones;
  
  if (chatId) {
    // Character-specific thresholds (lower)
    imageMilestones = [5, 10, 25, 50, 100];
    videoMilestones = [3, 5, 10, 20, 50];
    messageMilestones = [10, 25, 50, 100, 250, 500, 1000, 2500];
  } else {
    // Global thresholds (higher)
    imageMilestones = [15, 30, 50, 100, 250, 500, 1000];
    videoMilestones = [15, 30, 50, 100, 250, 500];
    messageMilestones = [10, 25, 50, 100, 250, 500, 1000, 2500]; // Messages are always character-specific
  }
  
  // Helper function to get next milestone and progress
  const getNextMilestone = (current, milestones) => {
    const next = milestones.find(m => m > current);
    const previous = milestones.filter(m => m <= current).pop() || 0;
    return {
      current,
      next: next || milestones[milestones.length - 1],
      previous,
      progress: next ? (current / next) * 100 : 100,
      isCompleted: !next
    };
  };
  
  return {
    images: {
      ...getNextMilestone(totalImages, imageMilestones),
      milestones: imageMilestones
    },
    videos: {
      ...getNextMilestone(totalVideos, videoMilestones),
      milestones: videoMilestones
    },
    messages: {
      ...getNextMilestone(totalMessages, messageMilestones),
      milestones: messageMilestones
    }
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
  // Global milestone reward functions
  awardImageMilestoneReward,
  awardImageGenerationReward,
  awardVideoMilestoneReward,
  awardVideoGenerationReward,
  // Character-specific milestone reward functions
  awardCharacterImageMilestoneReward,
  awardCharacterVideoMilestoneReward,
  awardCharacterMessageMilestoneReward,
  // Message milestone reward functions
  awardMessageMilestoneReward,
  getUserMilestoneProgress
};
