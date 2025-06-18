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
async function addUserPoints(db, userId, points, reason = 'Points awarded', source = 'system') {
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
async function removeUserPoints(db, userId, points, reason = 'Points deducted', source = 'system') {
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
 * Set user points to a specific amount (admin function)
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {number} points - Points to set
 * @param {string} reason - Reason for setting points
 * @returns {Object} Updated user data
 */
async function setUserPoints(db, userId, points, reason = 'Points set by admin') {
  if (points < 0) throw new Error('Points cannot be negative');
  
  const usersCollection = db.collection('users');
  const pointsHistoryCollection = db.collection('points_history');
  
  // Get current points to calculate difference
  const currentPoints = await getUserPoints(db, userId);
  const difference = points - currentPoints;
  
  // Create transaction record
  const transaction = {
    userId: new ObjectId(userId),
    type: difference >= 0 ? 'credit' : 'debit',
    points: Math.abs(difference),
    reason,
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
 * Award daily login bonus
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @returns {Object} Bonus award result
 */
async function awardDailyLoginBonus(db, userId) {
  const usersCollection = db.collection('users');
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  
  if (!user) throw new Error('User not found');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastLogin = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
  const lastLoginDate = lastLogin ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()) : null;
  
  // Check if already claimed today
  if (lastLoginDate && lastLoginDate.getTime() === today.getTime()) {
    return {
      success: false,
      message: 'Daily bonus already claimed today',
      nextBonus: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    };
  }
  
  // Calculate streak
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const isConsecutive = lastLoginDate && lastLoginDate.getTime() === yesterday.getTime();
  const currentStreak = isConsecutive ? (user.loginStreak || 0) + 1 : 1;
  
  // Calculate bonus points (base 10 + streak bonus)
  const baseBonus = 10;
  const streakBonus = Math.min(currentStreak - 1, 10) * 2; // Max 20 bonus points
  const totalBonus = baseBonus + streakBonus;
  
  // Award points and update streak
  const result = await addUserPoints(db, userId, totalBonus, `Daily login bonus (${currentStreak} day streak)`, 'daily_login');
  
  // Update user's daily bonus info
  await usersCollection.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        lastDailyBonus: new Date(),
        loginStreak: currentStreak
      }
    }
  );
  
  return {
    success: true,
    pointsAwarded: totalBonus,
    currentStreak,
    nextBonus: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    ...result
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
  
  // Get current user data
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  
  // Count total likes by user
  const totalLikes = await imagesLikesCollection.countDocuments({ userId: new ObjectId(userId) });
  // Define milestone rewards (likes -> points)
  const milestones = {
    1: { points: 5, message: 'First like!' },
    5: { points: 10, message: '5 likes milestone!' },
    10: { points: 15, message: '10 likes milestone!' },
    25: { points: 25, message: '25 likes milestone!' },
    50: { points: 50, message: '50 likes milestone!' },
    100: { points: 100, message: '100 likes milestone!' },
    250: { points: 150, message: '250 likes milestone!' },
    500: { points: 250, message: '500 likes milestone!' },
    1000: { points: 500, message: '1000 likes milestone!' }
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
  
  // Award milestone points
  const result = await addUserPoints(
    db, 
    userId, 
    milestone.points, 
    `Like milestone: ${milestone.message}`, 
    'like_milestone'
  );
  
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
  const basePoints = 1; // 1 point per like
  
  const result = await addUserPoints(
    db, 
    userId, 
    basePoints, 
    'Liked an image', 
    'like_action'
  );
  
  // Send websocket notification for action reward
  if (fastify && fastify.sendNotificationToUser) {
    try {
      await fastify.sendNotificationToUser(userId.toString(), 'likeRewardNotification', {
        userId: userId.toString(),
        points: basePoints,
        reason: 'Liked an image',
        source: 'like_action',
        isMilestone: false
      });
    } catch (notificationError) {
      console.error('Error sending like action reward notification:', notificationError);
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
  setUserPoints,
  checkUserPoints,
  awardDailyLoginBonus,
  getPointsLeaderboard,
  // Like reward functions
  awardLikeMilestoneReward,
  awardLikeActionReward
};
