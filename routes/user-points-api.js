const { ObjectId } = require('mongodb');
const {
  addUserPoints,
  removeUserPoints,
  getUserPoints,
  getUserPointsHistory,
  setUserPoints,
  checkUserPoints,
  awardFirstLoginBonus,
  awardDailyLoginBonus,
  getPointsLeaderboard
} = require('../models/user-points-utils');
const { checkUserAdmin } = require('../models/tool');

async function routes(fastify, options) {

  // Get user's current points balance
  fastify.get('/api/user-points/:userId/balance', async (request, reply) => {
    try {
      const { userId } = request.params;
      
      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const points = await getUserPoints(fastify.mongo.db, userId);
      
      return reply.send({
        success: true,
        points,
        userId
      });
    } catch (error) {
      console.error('Error getting user points balance:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get points balance' 
      });
    }
  });

  // Add points to user
  fastify.post('/api/user-points/:userId/add', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { points, reason, source } = request.body;

      // Validate input
      if (!points || points <= 0) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Points must be a positive number' 
        });
      }

      // Check permissions (admin or self for specific sources)
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      const isSelf = request.user._id.toString() === userId;
      
      if (!isAdmin && !isSelf) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Non-admin users can only add points from limited sources
      if (!isAdmin && !['achievement', 'bonus'].includes(source)) {
        return reply.status(403).send({ error: 'Invalid source for non-admin user' });
      }

      const result = await addUserPoints(
        fastify.mongo.db, 
        userId, 
        parseInt(points), 
        reason || 'Points added',
        source || 'system'
      );

      if (result.success) {
        // Send WebSocket notification to user
        fastify.sendNotificationToUser(userId, 'pointsAdded', {
          points: parseInt(points),
          newBalance: result.user.points,
          reason
        });

        return reply.send({
          success: true,
          message: 'Points added successfully',
          newBalance: result.user.points,
          transaction: result.transaction
        });
      } else {
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to add points' 
        });
      }
    } catch (error) {
      console.error('Error adding user points:', error);
      return reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to add points' 
      });
    }
  });

  // Remove points from user
  fastify.post('/api/user-points/:userId/remove', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { points, reason, source } = request.body;

      // Validate input
      if (!points || points <= 0) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Points must be a positive number' 
        });
      }

      // Check permissions (admin or self for specific sources)
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      const isSelf = request.user._id.toString() === userId;
      
      if (!isAdmin && !isSelf) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Non-admin users can only remove points from limited sources
      if (!isAdmin && !['purchase'].includes(source)) {
        return reply.status(403).send({ error: 'Invalid source for non-admin user' });
      }

      const result = await removeUserPoints(
        fastify.mongo.db, 
        userId, 
        parseInt(points), 
        reason || 'Points deducted',
        source || 'system'
      );

      if (result.success) {
        // Send WebSocket notification to user
        fastify.sendNotificationToUser(userId, 'pointsRemoved', {
          points: parseInt(points),
          newBalance: result.user.points,
          reason
        });

        return reply.send({
          success: true,
          message: 'Points removed successfully',
          newBalance: result.user.points,
          transaction: result.transaction
        });
      } else {
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to remove points' 
        });
      }
    } catch (error) {
      console.error('Error removing user points:', error);
      return reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to remove points' 
      });
    }
  });

  // Set user points (admin only)
  fastify.post('/api/user-points/:userId/set', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { points, reason } = request.body;

      // Check admin permissions
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      // Validate input
      if (points === undefined || points < 0) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Points must be a non-negative number' 
        });
      }

      const result = await setUserPoints(
        fastify.mongo.db, 
        userId, 
        parseInt(points), 
        reason || 'Points set by admin'
      );

      if (result.success) {
        // Send WebSocket notification to user
        fastify.sendNotificationToUser(userId, 'pointsSet', {
          newBalance: result.user.points,
          reason: reason || 'Points set by admin'
        });

        return reply.send({
          success: true,
          message: 'Points set successfully',
          newBalance: result.user.points,
          transaction: result.transaction
        });
      } else {
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to set points' 
        });
      }
    } catch (error) {
      console.error('Error setting user points:', error);
      return reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to set points' 
      });
    }
  });

  // Get user's points history
  fastify.get('/api/user-points/:userId/history', async (request, reply) => {
    try {
      const { userId } = request.params;
      const page = parseInt(request.query.page) || 1;
      const limit = Math.min(parseInt(request.query.limit) || 20, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const history = await getUserPointsHistory(fastify.mongo.db, userId, limit, skip);
      
      // Get total count for pagination
      const totalCount = await fastify.mongo.db.collection('points_history')
        .countDocuments({ userId: new ObjectId(userId) });
      const totalPages = Math.ceil(totalCount / limit);

      return reply.send({
        success: true,
        history,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Error getting user points history:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get points history' 
      });
    }
  });

  // Add the missing general history route that accepts userId as query parameter
  fastify.get('/api/user-points/history', async (request, reply) => {
    try {
      const userId = request.query.userId;
      const page = parseInt(request.query.page) || 1;
      const limit = Math.min(parseInt(request.query.limit) || 20, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      if (!userId) {
        return reply.status(400).send({ 
          success: false, 
          error: 'userId parameter is required' 
        });
      }

      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const history = await getUserPointsHistory(fastify.mongo.db, userId, limit, skip);
      
      // Get total count for pagination
      const totalCount = await fastify.mongo.db.collection('points_history')
        .countDocuments({ userId: new ObjectId(userId) });
      const totalPages = Math.ceil(totalCount / limit);

      return reply.send({
        success: true,
        history,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Error getting user points history:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get points history' 
      });
    }
  });

  // Check if user has enough points
  fastify.get('/api/user-points/:userId/check/:amount', async (request, reply) => {
    try {
      const { userId, amount } = request.params;
      const requiredPoints = parseInt(amount);

      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (isNaN(requiredPoints) || requiredPoints < 0) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Invalid amount' 
        });
      }

      const result = await checkUserPoints(fastify.mongo.db, userId, requiredPoints);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error checking user points:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to check points' 
      });
    }
  });

  // Claim daily bonus
  fastify.post('/api/user-points/:userId/daily-bonus', async (request, reply) => {
    try {
      const { userId } = request.params;

      // Check if user can access this
      if (request.user._id.toString() !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const result = await awardDailyLoginBonus(fastify.mongo.db, userId);

      if (result.success) {
        // Send WebSocket notification to user
        fastify.sendNotificationToUser(userId, 'dailyBonusClaimed', {
          userId,
          pointsAwarded: result.pointsAwarded,
          currentStreak: result.currentStreak,
          newBalance: result.user.points
        });

        return reply.send({
          success: true,
          message: 'Daily bonus claimed successfully',
          pointsAwarded: result.pointsAwarded,
          currentStreak: result.currentStreak,
          newBalance: result.user.points,
          nextBonus: result.nextBonus
        });
      } else {
        return reply.send({
          success: false,
          message: result.message,
          nextBonus: result.nextBonus
        });
      }
    } catch (error) {
      console.error('Error claiming daily bonus:', error);
      return reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to claim daily bonus' 
      });
    }
  });

  // Get daily bonus status
  fastify.get('/api/user-points/:userId/daily-bonus-status', async (request, reply) => {
    try {
      const { userId } = request.params;

      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const usersCollection = fastify.mongo.db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastBonus = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
      const lastBonusDate = lastBonus ? new Date(lastBonus.getFullYear(), lastBonus.getMonth(), lastBonus.getDate()) : null;

      const canClaim = !lastBonusDate || lastBonusDate.getTime() !== today.getTime();
      const nextBonus = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      return reply.send({
        success: true,
        canClaim,
        currentStreak: user.loginStreak || 0,
        lastBonus: user.lastDailyBonus,
        nextBonus
      });
    } catch (error) {
      console.error('Error getting daily bonus status:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get bonus status' 
      });
    }
  });

  // Get daily rewards calendar data
  fastify.get('/api/user-points/:userId/daily-rewards-calendar', async (request, reply) => {
    try {
      const { userId } = request.params;

      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const usersCollection = fastify.mongo.db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const today = new Date();
      const lastBonus = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
      const lastBonusDate = lastBonus ? new Date(Date.UTC(lastBonus.getUTCFullYear(), lastBonus.getUTCMonth(), lastBonus.getUTCDate())) : null;
      const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      
      const currentStreak = user.loginStreak || 0;
      const canClaimToday = !lastBonusDate || lastBonusDate.getTime() !== todayDate.getTime();

      // Generate 30-day streak data
      const streakDays = [];
      for (let day = 1; day <= 30; day++) {
        // Calculate reward amount for each streak day
        const baseReward = 100;
        const streakBonus = Math.min(day, 10);
        const milestoneBonus = (day % 7 === 0) ? 500 : 0; // Weekly milestone
        const superMilestoneBonus = (day === 30) ? 1000 : 0; // 30-day milestone
        const rewardAmount = baseReward + (streakBonus * 10) + milestoneBonus + superMilestoneBonus;

        // Determine status
        let status = 'future'; // Default
        let canClaim = false;
        
        if (day <= currentStreak) {
          status = 'completed';
        } else if (day === currentStreak + 1 && canClaimToday) {
          status = 'current';
          canClaim = true;
        }

        const isMilestone = (day % 7 === 0) || day === 30;

        streakDays.push({
          day,
          points: rewardAmount,
          status, // 'completed', 'current', 'future'
          canClaim,
          isMilestone,
          isWeeklyMilestone: day % 7 === 0,
          isFinalMilestone: day === 30
        });
      }

      return reply.send({
        success: true,
        streak: {
          days: streakDays,
          currentStreak,
          maxStreak: 30
        },
        user: {
          currentStreak,
          canClaimToday,
          lastBonus: user.lastDailyBonus,
          totalPoints: user.points || 0
        }
      });
    } catch (error) {
      console.error('Error getting daily rewards streak:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get streak data' 
      });
    }
  });

  // Claim daily reward from calendar
  fastify.post('/api/user-points/:userId/claim-daily-reward', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { day, month, year } = request.body;

      // Check if user can access this
      if (request.user._id.toString() !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Validate that it's today's reward being claimed using UTC
      const today = new Date();
      const currentDay = today.getUTCDate();
      const currentMonth = today.getUTCMonth();
      const currentYear = today.getUTCFullYear();

      if (day !== currentDay || month !== currentMonth || year !== currentYear) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Can only claim today\'s reward' 
        });
      }

      // Use existing daily bonus claim logic
      const result = await awardDailyLoginBonus(fastify.mongo.db, userId, fastify);

      if (result.success) {
        // Send WebSocket notification to user
        if (fastify.sendNotificationToUser) {
          fastify.sendNotificationToUser(userId, 'dailyRewardClaimed', {
            userId,
            pointsAwarded: result.pointsAwarded,
            currentStreak: result.currentStreak,
            newBalance: result.user.points,
            day: currentDay
          });
        }

        return reply.send({
          success: true,
          message: 'Daily reward claimed successfully',
          pointsAwarded: result.pointsAwarded,
          currentStreak: result.currentStreak,
          newBalance: result.user.points,
          day: currentDay,
          nextReward: result.nextBonus
        });
      } else {
        return reply.send({
          success: false,
          message: result.message,
          nextReward: result.nextBonus
        });
      }
    } catch (error) {
      console.error('Error claiming daily reward:', error);
      return reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to claim daily reward' 
      });
    }
  });

  // Get upcoming rewards preview
  fastify.get('/api/user-points/:userId/upcoming-rewards', async (request, reply) => {
    try {
      const { userId } = request.params;
      const days = parseInt(request.query.days) || 7; // Get next 7 days by default

      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const usersCollection = fastify.mongo.db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const today = new Date();
      const currentStreak = user.loginStreak || 0;
      const upcomingRewards = [];

      // Calculate upcoming rewards using UTC
      for (let i = 1; i <= days; i++) {
        const futureDate = new Date(today);
        futureDate.setUTCDate(today.getUTCDate() + i);

        const day = futureDate.getUTCDate();
        const potentialStreak = currentStreak + i;

        const baseReward = 100;
        const streakBonus = Math.min(potentialStreak, 10) * 10;
        const milestoneBonus = potentialStreak % 7 === 0 ? 500 : 0;
        const superMilestoneBonus = potentialStreak === 30 ? 1000 : 0;
        const weekendBonus = futureDate.getUTCDay() === 0 || futureDate.getUTCDay() === 6 ? 0 : 0;
        const rewardAmount = baseReward + streakBonus + milestoneBonus + superMilestoneBonus + weekendBonus;

        upcomingRewards.push({
          date: futureDate.toISOString().split('T')[0],
          day,
          points: rewardAmount,
          streak: potentialStreak,
          isWeekend: futureDate.getUTCDay() === 0 || futureDate.getUTCDay() === 6,
          isMilestone: potentialStreak % 7 === 0 || potentialStreak === 30,
          daysFromNow: i
        });
      }

      return reply.send({
        success: true,
        currentStreak,
        upcomingRewards,
        totalUpcomingPoints: upcomingRewards.reduce((sum, reward) => sum + reward.points, 0)
      });
    } catch (error) {
      console.error('Error getting upcoming rewards:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get upcoming rewards' 
      });
    }
  });

  // Get points leaderboard
  fastify.get('/api/user-points/leaderboard', async (request, reply) => {
    try {
      const limit = Math.min(parseInt(request.query.limit) || 10, 50); // Max 50 users
      
      const leaderboard = await getPointsLeaderboard(fastify.mongo.db, limit);

      return reply.send({
        success: true,
        leaderboard
      });
    } catch (error) {
      console.error('Error getting points leaderboard:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get leaderboard' 
      });
    }
  });

  // Admin: Get all users' points summary
  fastify.get('/api/user-points/admin/summary', async (request, reply) => {
    try {
      // Check admin permissions
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const usersCollection = fastify.mongo.db.collection('users');
      const pointsHistoryCollection = fastify.mongo.db.collection('points_history');

      // Get stats
      const [totalUsers, totalPoints, totalTransactions] = await Promise.all([
        usersCollection.countDocuments({ isTemporary: { $ne: true } }),
        usersCollection.aggregate([
          { $match: { isTemporary: { $ne: true } } },
          { $group: { _id: null, total: { $sum: '$points' } } }
        ]).toArray(),
        pointsHistoryCollection.countDocuments({})
      ]);

      const totalPointsInSystem = totalPoints[0]?.total || 0;

      // Get recent transactions
      const recentTransactions = await pointsHistoryCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      return reply.send({
        success: true,
        summary: {
          totalUsers,
          totalPointsInSystem,
          totalTransactions,
          recentTransactions
        }
      });
    } catch (error) {
      console.error('Error getting admin points summary:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get summary' 
      });
    }
  });
  // Claim first login bonus (subscriber only)
  fastify.post('/api/user-points/:userId/first-login-bonus', async (request, reply) => {
    try {
      const { userId } = request.params;

      // Check if user can access this
      if (request.user._id.toString() !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const result = await awardFirstLoginBonus(fastify.mongo.db, userId, fastify);

      if (result.success) {
        // Send WebSocket notification to user
        if (fastify.sendNotificationToUser) {
          fastify.sendNotificationToUser(userId, 'firstLoginBonusClaimed', {
            userId,
            pointsAwarded: result.pointsAwarded,
            newBalance: result.user.points,
            message: result.message
          });
        }

        return reply.send({
          success: true,
          message: result.message,
          pointsAwarded: result.pointsAwarded,
          newBalance: result.user.points
        });
      } else {
        return reply.send({
          success: false,
          message: result.message,
          reason: result.reason
        });
      }
    } catch (error) {
      console.error('Error claiming first login bonus:', error);
      return reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to claim first login bonus' 
      });
    }
  });

  // Get first login bonus status
  fastify.get('/api/user-points/:userId/first-login-bonus-status', async (request, reply) => {
    try {
      const { userId } = request.params;

      // Check if user can access this data
      if (request.user._id.toString() !== userId && !await checkUserAdmin(fastify, request.user._id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const usersCollection = fastify.mongo.db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const isSubscribed = user.subscriptionStatus === 'active';
      
      if (!isSubscribed) {
        return reply.send({
          success: true,
          canClaim: false,
          isSubscribed: false,
          message: 'User is not subscribed'
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastFirstLoginBonus = user.lastFirstLoginBonus ? new Date(user.lastFirstLoginBonus) : null;
      const lastFirstLoginBonusDate = lastFirstLoginBonus ? 
        new Date(lastFirstLoginBonus.getFullYear(), lastFirstLoginBonus.getMonth(), lastFirstLoginBonus.getDate()) : 
        null;

      const canClaim = !lastFirstLoginBonusDate || lastFirstLoginBonusDate.getTime() !== today.getTime();

      return reply.send({
        success: true,
        canClaim,
        isSubscribed: true,
        lastFirstLoginBonus: user.lastFirstLoginBonus,
        pointsAmount: 100
      });
    } catch (error) {
      console.error('Error getting first login bonus status:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get first login bonus status' 
      });
    }
  });
}

module.exports = routes;