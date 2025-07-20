const { ObjectId } = require('mongodb');

/**
 * Get chat goals data for a specific user chat
 * @param {Object} db - MongoDB database instance
 * @param {string} userChatId - User chat ID
 * @returns {Object} Goals data including current and completed goals
 */
async function getChatGoalsData(db, userChatId) {
    try {
        const userChatCollection = db.collection('userChat');
        
        const userData = await userChatCollection.findOne(
            { _id: new ObjectId(userChatId) },
            { 
                projection: { 
                    currentGoal: 1, 
                    completedGoals: 1, 
                    messages: 1,
                    goalCreatedAt: 1 
                } 
            }
        );

        if (!userData) {
            throw new Error('User chat not found');
        }

        return {
            currentGoal: userData.currentGoal || null,
            completedGoals: userData.completedGoals || [],
            messages: userData.messages || [],
            goalCreatedAt: userData.goalCreatedAt || null
        };
    } catch (error) {
        console.error('Error getting chat goals data:', error);
        throw error;
    }
}

/**
 * Get chat goals statistics for a user across all chats
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @returns {Object} Goals statistics
 */
async function getUserGoalsStats(db, userId) {
    try {
        const userChatCollection = db.collection('userChat');
        
        const pipeline = [
            { $match: { userId: new ObjectId(userId) } },
            {
                $group: {
                    _id: null,
                    totalCompletedGoals: {
                        $sum: { $size: { $ifNull: ['$completedGoals', []] } }
                    },
                    activeGoals: {
                        $sum: { $cond: [{ $ne: ['$currentGoal', null] }, 1, 0] }
                    },
                    totalChatsWithGoals: { $sum: 1 }
                }
            }
        ];

        const stats = await userChatCollection.aggregate(pipeline).toArray();
        
        return stats[0] || {
            totalCompletedGoals: 0,
            activeGoals: 0,
            totalChatsWithGoals: 0
        };
    } catch (error) {
        console.error('Error getting user goals stats:', error);
        throw error;
    }
}

/**
 * Get goals completion history for a user
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of recent completed goals to return
 * @returns {Array} Array of completed goals with chat info
 */
async function getUserGoalsHistory(db, userId, limit = 20) {
    try {
        const userChatCollection = db.collection('userChat');
        const chatsCollection = db.collection('chats');
        
        const pipeline = [
            { $match: { userId: new ObjectId(userId) } },
            { $unwind: { path: '$completedGoals', preserveNullAndEmptyArrays: false } },
            {
                $lookup: {
                    from: 'chats',
                    localField: 'chatId',
                    foreignField: '_id',
                    as: 'chatInfo'
                }
            },
            {
                $addFields: {
                    chatInfo: { $arrayElemAt: ['$chatInfo', 0] }
                }
            },
            {
                $project: {
                    goal: '$completedGoals',
                    chatName: '$chatInfo.name',
                    chatId: '$chatId',
                    userChatId: '$_id'
                }
            },
            { $sort: { 'goal.completedAt': -1 } },
            { $limit: limit }
        ];

        const history = await userChatCollection.aggregate(pipeline).toArray();
        return history;
    } catch (error) {
        console.error('Error getting user goals history:', error);
        throw error;
    }
}

/**
 * Update goal completion count for analytics
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 * @param {string} difficulty - Goal difficulty
 */
async function updateGoalsAnalytics(db, userId, chatId, difficulty) {
    try {
        const analyticsCollection = db.collection('goalsAnalytics');
        const today = new Date().toISOString().split('T')[0];
        
        await analyticsCollection.updateOne(
            { 
                userId: new ObjectId(userId),
                chatId: new ObjectId(chatId),
                date: today
            },
            {
                $inc: {
                    [`completionsByDifficulty.${difficulty}`]: 1,
                    totalCompletions: 1
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('Error updating goals analytics:', error);
        // Don't throw error as this is non-critical
    }
}

module.exports = {
    getChatGoalsData,
    getUserGoalsStats,
    getUserGoalsHistory,
    updateGoalsAnalytics
};
