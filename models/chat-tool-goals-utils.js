const { ObjectId } = require('mongodb');
const { getUserMilestoneProgress } = require('./user-points-utils');

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

/**
 * Get milestone goals data for a specific user and chat
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID (for character-specific goals)
 * @returns {Object} Milestone goals data with progress
 */
async function getMilestoneGoalsData(db, userId, chatId) {
    try {
        console.log('📊 [MILESTONE] Getting goals data for user:', userId?.toString(), 'chat:', chatId?.toString());
        
        // Get milestone progress
        const milestoneProgress = await getUserMilestoneProgress(db, userId, chatId);
        
        // Get reward points for next milestones (character-specific rewards)
        const getRewardPoints = (type, nextMilestone) => {
            const rewards = {
                images: {
                    5: 25, 10: 35, 25: 60, 50: 100, 100: 200
                },
                videos: {
                    3: 50, 5: 75, 10: 100, 20: 200, 50: 400
                },
                messages: {
                    10: 25, 25: 35, 50: 60, 100: 100, 
                    250: 200
                }
            };
            return rewards[type][nextMilestone] || 0;
        };
        
        // Format the milestone data for frontend
        const milestoneGoals = {
            images: {
                type: 'images',
                icon: 'bi-image',
                current: milestoneProgress.images.current,
                next: milestoneProgress.images.next,
                progress: Math.min(milestoneProgress.images.progress, 100),
                isCompleted: milestoneProgress.images.isCompleted,
                reward: getRewardPoints('images', milestoneProgress.images.next),
                title: 'Image Generation',
                description: `Generate ${milestoneProgress.images.next} images`
            },
            videos: {
                type: 'videos',
                icon: 'bi-play-circle',
                current: milestoneProgress.videos.current,
                next: milestoneProgress.videos.next,
                progress: Math.min(milestoneProgress.videos.progress, 100),
                isCompleted: milestoneProgress.videos.isCompleted,
                reward: getRewardPoints('videos', milestoneProgress.videos.next),
                title: 'Video Generation',
                description: `Generate ${milestoneProgress.videos.next} videos`
            },
            messages: {
                type: 'messages',
                icon: 'bi-chat-dots',
                current: milestoneProgress.messages.current,
                next: milestoneProgress.messages.next,
                progress: Math.min(milestoneProgress.messages.progress, 100),
                isCompleted: milestoneProgress.messages.isCompleted,
                reward: getRewardPoints('messages', milestoneProgress.messages.next),
                title: 'Messages Sent',
                description: `Send ${milestoneProgress.messages.next} messages`
            }
        };
        
        return milestoneGoals;
    } catch (error) {
        console.error('Error getting milestone goals data:', error);
        throw error;
    }
}

/**
 * Get completed milestones for a user
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID for filtering
 * @param {number} limit - Maximum number of milestones to return
 * @returns {Array} Array of completed milestones
 */
async function getCompletedMilestones(db, userId, chatId = null, limit = 20) {
    try {
        const milestonesCollection = db.collection('user_milestones');
        
        const query = { userId: new ObjectId(userId) };
        if (chatId) {
            // For message milestones, filter by chat
            query.$or = [
                { type: { $in: ['image_milestone', 'video_milestone', 'character_image_milestone', 'character_video_milestone'] } },
                { type: { $in: ['message_milestone', 'character_message_milestone'] }, chatId: new ObjectId(chatId) }
            ];
        }
        
        const milestones = await milestonesCollection
            .find(query)
            .sort({ grantedAt: -1 })
            .limit(limit)
            .toArray();
            
        return milestones;
    } catch (error) {
        console.error('Error getting completed milestones:', error);
        throw error;
    }
}

module.exports = {
    getChatGoalsData,
    getUserGoalsStats,
    getUserGoalsHistory,
    updateGoalsAnalytics,
    getMilestoneGoalsData,
    getCompletedMilestones
};
