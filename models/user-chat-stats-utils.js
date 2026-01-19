const { ObjectId } = require('mongodb');

/**
 * Increment message count for a user's chat with a character
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID (character ID)
 * @param {string} userChatId - UserChat document ID (optional)
 * @param {number} increment - Number to increment by (default: 1)
 */
async function incrementMessageCount(db, userId, chatId, userChatId = null, increment = 1) {
    try {
        if (!userId || !chatId) {
            console.warn('[incrementMessageCount] Missing userId or chatId');
            return;
        }

        const collection = db.collection('user_chat_stats');
        const now = new Date();

        // Build the query - prefer userChatId if provided for accuracy
        const query = {
            userId: new ObjectId(userId),
            chatId: new ObjectId(chatId)
        };

        const updateDoc = {
            $inc: { messageCount: increment },
            $set: { updatedAt: now },
            $setOnInsert: {
                userId: new ObjectId(userId),
                chatId: new ObjectId(chatId),
                createdAt: now
            }
        };

        // Add userChatId if provided
        if (userChatId && ObjectId.isValid(userChatId)) {
            updateDoc.$setOnInsert.userChatId = new ObjectId(userChatId);
        }

        await collection.updateOne(query, updateDoc, { upsert: true });

    } catch (error) {
        console.error('[incrementMessageCount] Error:', error.message);
    }
}

/**
 * Get message count for a user's chat with a character
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID (character ID)
 * @returns {number} Message count (0 if not found)
 */
async function getMessageCount(db, userId, chatId) {
    try {
        if (!userId || !chatId) {
            return 0;
        }

        const collection = db.collection('user_chat_stats');
        
        // Handle both ObjectId and string formats
        const stats = await collection.findOne({
            $or: [
                { userId: new ObjectId(userId), chatId: new ObjectId(chatId) },
                { userId: new ObjectId(userId), chatId: chatId.toString() }
            ]
        });

        return stats?.messageCount || 0;

    } catch (error) {
        console.error('[getMessageCount] Error:', error.message);
        return 0;
    }
}

/**
 * Get all stats for a user's chat with a character
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID (character ID)
 * @returns {Object|null} Stats object or null if not found
 */
async function getUserChatStats(db, userId, chatId) {
    try {
        if (!userId || !chatId) {
            return null;
        }

        const collection = db.collection('user_chat_stats');
        
        // Handle both ObjectId and string formats
        const stats = await collection.findOne({
            $or: [
                { userId: new ObjectId(userId), chatId: new ObjectId(chatId) },
                { userId: new ObjectId(userId), chatId: chatId.toString() }
            ]
        });

        return stats || null;

    } catch (error) {
        console.error('[getUserChatStats] Error:', error.message);
        return null;
    }
}

/**
 * Set the message count directly (useful for recalculation/sync)
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID (character ID)
 * @param {number} count - Message count to set
 * @param {string} userChatId - UserChat document ID (optional)
 */
async function setMessageCount(db, userId, chatId, count, userChatId = null) {
    try {
        if (!userId || !chatId) {
            console.warn('[setMessageCount] Missing userId or chatId');
            return;
        }

        const collection = db.collection('user_chat_stats');
        const now = new Date();

        const query = {
            userId: new ObjectId(userId),
            chatId: new ObjectId(chatId)
        };

        const updateDoc = {
            $set: { 
                messageCount: count,
                updatedAt: now 
            },
            $setOnInsert: {
                userId: new ObjectId(userId),
                chatId: new ObjectId(chatId),
                createdAt: now
            }
        };

        if (userChatId && ObjectId.isValid(userChatId)) {
            updateDoc.$setOnInsert.userChatId = new ObjectId(userChatId);
        }

        await collection.updateOne(query, updateDoc, { upsert: true });

    } catch (error) {
        console.error('[setMessageCount] Error:', error.message);
    }
}

/**
 * Recalculate message count from userChat document
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID (character ID)
 */
async function recalculateMessageCount(db, userId, chatId) {
    try {
        if (!userId || !chatId) {
            return;
        }

        const userChatCollection = db.collection('userChat');
        
        // Find the userChat document
        const userChat = await userChatCollection.findOne({
            $or: [
                { userId: new ObjectId(userId), chatId: new ObjectId(chatId) },
                { userId: new ObjectId(userId), chatId: chatId.toString() }
            ]
        });

        if (!userChat) {
            return;
        }

        // Count messages (only user and assistant roles)
        let messageCount = 0;
        if (userChat.messages && Array.isArray(userChat.messages)) {
            messageCount = userChat.messages.filter(msg => 
                msg.role === 'user' || msg.role === 'assistant'
            ).length;
        }

        // Update the stats
        await setMessageCount(db, userId, chatId, messageCount, userChat._id);

        console.log(`[recalculateMessageCount] Updated count for user ${userId}, chat ${chatId}: ${messageCount}`);

    } catch (error) {
        console.error('[recalculateMessageCount] Error:', error.message);
    }
}

module.exports = {
    incrementMessageCount,
    getMessageCount,
    getUserChatStats,
    setMessageCount,
    recalculateMessageCount
};
