const { ObjectId } = require('mongodb');
const { checkGoalCompletion } = require('../models/openai');
const { getLanguageName } = require('../models/tool');
const {
    getChatGoalsData,
    getUserGoalsStats,
    getUserGoalsHistory,
    updateGoalsAnalytics
} = require('../models/chat-tool-goals-utils');
const { getUserChatToolSettings } = require('../models/chat-tool-settings-utils');

async function routes(fastify, options) {
    
    // Get goals data for a specific user chat
    fastify.get('/api/chat-goals/:userChatId', async (request, reply) => {
        try {
            const { userChatId } = request.params;
            const userId = request.user._id;
            
            if (!ObjectId.isValid(userChatId)) {
                return reply.status(400).send({ error: 'Invalid user chat ID format' });
            }

            // Verify the user chat belongs to the authenticated user
            const userChatCollection = fastify.mongo.db.collection('userChat');
            const userChatDoc = await userChatCollection.findOne({
                _id: new ObjectId(userChatId),
                userId: new ObjectId(userId)
            });

            if (!userChatDoc) {
                return reply.status(404).send({ error: 'User chat not found or access denied' });
            }

            const goalsData = await getChatGoalsData(fastify.mongo.db, userChatId);
            
            // Check completion status if there's a current goal
            let goalStatus = null;
            if (goalsData.currentGoal) {
                const language = getLanguageName(request.user.lang || 'ja');
                goalStatus = await checkGoalCompletion(
                    goalsData.currentGoal, 
                    goalsData.messages, 
                    language
                );
            }
            
            // Get goals enabled setting
            const userSettings = await getUserChatToolSettings(fastify.mongo.db, userId, userChatDoc.chatId);
            const goalsEnabled = userSettings.goalsEnabled !== false; // Default to true
            
            return reply.send({
                currentGoal: goalsData.currentGoal,
                completedGoals: goalsData.completedGoals,
                goalStatus,
                goalCreatedAt: goalsData.goalCreatedAt,
                goalsEnabled
            });
        } catch (error) {
            console.error('Error fetching chat goals:', error);
            return reply.status(500).send({ error: 'Failed to fetch chat goals' });
        }
    });

    // Get user's goals statistics across all chats
    fastify.get('/api/user/goals-stats', async (request, reply) => {
        try {
            const userId = request.user._id;
            
            const stats = await getUserGoalsStats(fastify.mongo.db, userId);
            
            return reply.send({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Error fetching user goals stats:', error);
            return reply.status(500).send({ error: 'Failed to fetch goals statistics' });
        }
    });

    // Get user's goals completion history
    fastify.get('/api/user/goals-history', async (request, reply) => {
        try {
            const userId = request.user._id;
            const limit = parseInt(request.query.limit) || 20;
            
            const history = await getUserGoalsHistory(fastify.mongo.db, userId, limit);
            
            return reply.send({
                success: true,
                history
            });
        } catch (error) {
            console.error('Error fetching user goals history:', error);
            return reply.status(500).send({ error: 'Failed to fetch goals history' });
        }
    });

    // Force refresh/regenerate current goal for a chat
    fastify.post('/api/chat-goals/:userChatId/refresh', async (request, reply) => {
        try {
            const { userChatId } = request.params;
            const userId = request.user._id;
            
            if (!ObjectId.isValid(userChatId)) {
                return reply.status(400).send({ error: 'Invalid user chat ID format' });
            }

            // Verify ownership
            const userChatCollection = fastify.mongo.db.collection('userChat');
            const userChatDoc = await userChatCollection.findOne({
                _id: new ObjectId(userChatId),
                userId: new ObjectId(userId)
            });

            if (!userChatDoc) {
                return reply.status(404).send({ error: 'User chat not found or access denied' });
            }

            // Clear current goal to trigger regeneration
            await userChatCollection.updateOne(
                { _id: new ObjectId(userChatId) },
                { 
                    $unset: { currentGoal: "" },
                    $set: { goalRefreshedAt: new Date() }
                }
            );

            return reply.send({
                success: true,
                message: 'Goal refresh initiated. A new goal will be generated in the next conversation turn.'
            });
        } catch (error) {
            console.error('Error refreshing chat goal:', error);
            return reply.status(500).send({ error: 'Failed to refresh chat goal' });
        }
    });

    fastify.post('/api/chat-goals/goals-enabled', async (request, reply) => {
        try {
            const db = fastify.mongo.db;
            const { chatId, enabled } = request.body;
            const userId = request.user._id;

            await db.collection('chatToolSettings').updateOne(
                { userId: new ObjectId(userId), chatId: new ObjectId(chatId) },
                { 
                    $set: { 
                        goalsEnabled: enabled,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            
            reply.send({ success: true, enabled });
        } catch (error) {
            console.error('Error updating goals setting:', error);
            reply.status(500).send({ error: 'Failed to update goals setting' });
        }
    });
}

module.exports = routes;
