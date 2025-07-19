const { ObjectId } = require('mongodb');

/**
 * Get total generated images for a user
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Analytics data
 */
async function getUserImageGenerationStats(db, userId) {
  try {
    const imagesGeneratedCollection = db.collection('images_generated');
    
    const result = await imagesGeneratedCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalImages: { $sum: '$generationCount' },
          totalEntries: { $sum: 1 }
        }
      }
    ]).toArray();
    
    return result.length > 0 ? result[0] : { totalImages: 0, totalEntries: 0 };
  } catch (error) {
    console.error('Error getting user image generation stats:', error);
    throw error;
  }
}

/**
 * Get total generated images for a user by chat
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Array>} Array of chat analytics
 */
async function getUserImageGenerationStatsByChat(db, userId) {
  try {
    const imagesGeneratedCollection = db.collection('images_generated');
    const chatsCollection = db.collection('chats');
    
    const result = await imagesGeneratedCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: '$chatId',
          totalImages: { $sum: '$generationCount' },
          totalEntries: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'chats',
          localField: '_id',
          foreignField: '_id',
          as: 'chat'
        }
      },
      { $unwind: { path: '$chat', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          chatId: '$_id',
          chatName: '$chat.name',
          chatSlug: '$chat.slug',
          totalImages: 1,
          totalEntries: 1
        }
      },
      { $sort: { totalImages: -1 } }
    ]).toArray();
    
    return result;
  } catch (error) {
    console.error('Error getting user image generation stats by chat:', error);
    throw error;
  }
}

/**
 * Get total liked images for a user
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Like analytics data
 */
async function getUserImageLikeStats(db, userId) {
  try {
    const imagesLikesCollection = db.collection('images_likes');
    
    const totalLikes = await imagesLikesCollection.countDocuments({ userId: new ObjectId(userId) });
    
    return { totalLikes };
  } catch (error) {
    console.error('Error getting user image like stats:', error);
    throw error;
  }
}

/**
 * Get total liked images for a user by chat
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Array>} Array of chat like analytics
 */
async function getUserImageLikeStatsByChat(db, userId) {
  try {
    const imagesLikesCollection = db.collection('images_likes');
    const galleryCollection = db.collection('gallery');
    const chatsCollection = db.collection('chats');
    
    const result = await imagesLikesCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $lookup: {
          from: 'gallery',
          let: { imageId: '$imageId' },
          pipeline: [
            { $unwind: '$images' },
            { $match: { $expr: { $eq: ['$images._id', '$$imageId'] } } },
            { $project: { chatId: 1 } }
          ],
          as: 'gallery'
        }
      },
      { $unwind: { path: '$gallery', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$gallery.chatId',
          totalLikes: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'chats',
          localField: '_id',
          foreignField: '_id',
          as: 'chat'
        }
      },
      { $unwind: { path: '$chat', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          chatId: '$_id',
          chatName: '$chat.name',
          chatSlug: '$chat.slug',
          totalLikes: 1
        }
      },
      { $sort: { totalLikes: -1 } }
    ]).toArray();
    
    return result;
  } catch (error) {
    console.error('Error getting user image like stats by chat:', error);
    throw error;
  }
}

/**
 * Debug function to log current user total images
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for logging
 * @param {Object} debugContext - Additional debug context from request
 */
async function debugUserImageStats(db, userId, fastify, debugContext = {}) {
  try {
    const [generationStats, likeStats] = await Promise.all([
      getUserImageGenerationStats(db, userId),
      getUserImageLikeStats(db, userId)
    ]);
    
    const logData = {
      userId: userId.toString(),
      timestamp: new Date().toISOString(),
      debugContext,
      imageGeneration: {
        totalImages: generationStats.totalImages,
        totalEntries: generationStats.totalEntries
      },
      imageLikes: {
        totalLikes: likeStats.totalLikes
      }
    };
    
    console.log('[USER-ANALYTICS-DEBUG]', JSON.stringify(logData, null, 2));
    
    // Log to fastify if available
    if (fastify && fastify.log) {
      fastify.log.info(logData, 'User image analytics debug');
    }
    
    return logData;
  } catch (error) {
    console.error('[USER-ANALYTICS-DEBUG] Error:', error);
    throw error;
  }
}

/**
 * Debug function to log current user total likes
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @param {Object} fastify - Fastify instance for logging
 * @param {Object} debugContext - Additional debug context from request
 */
async function debugUserLikeStats(db, userId, fastify, debugContext = {}) {
  try {
    const likeStatsByChat = await getUserImageLikeStatsByChat(db, userId);
    const totalLikes = likeStatsByChat.reduce((sum, chat) => sum + chat.totalLikes, 0);
    
    const logData = {
      userId: userId.toString(),
      timestamp: new Date().toISOString(),
      debugContext,
      totalLikes,
      likesByChat: likeStatsByChat
    };
    
    console.log('[USER-LIKES-DEBUG]', JSON.stringify(logData, null, 2));
    
    // Log to fastify if available
    if (fastify && fastify.log) {
      fastify.log.info(logData, 'User likes analytics debug');
    }
    
    return logData;
  } catch (error) {
    console.error('[USER-LIKES-DEBUG] Error:', error);
    throw error;
  }
}

module.exports = {
  getUserImageGenerationStats,
  getUserImageGenerationStatsByChat,
  getUserImageLikeStats,
  getUserImageLikeStatsByChat,
  debugUserImageStats,
  debugUserLikeStats
};
