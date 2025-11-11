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

/**
 * Get total messages for a user
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Message statistics
 */
async function getUserMessageStats(db, userId) {
  try {
    const userChatCollection = db.collection('userChat');
    
    const result = await userChatCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      { $unwind: '$messages' },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          totalChats: { $addToSet: '$chatId' }
        }
      },
      {
        $project: {
          totalMessages: 1,
          totalChats: { $size: '$totalChats' }
        }
      }
    ]).toArray();
    
    return result.length > 0 ? result[0] : { totalMessages: 0, totalChats: 0 };
  } catch (error) {
    console.error('Error getting user message stats:', error);
    return { totalMessages: 0, totalChats: 0 };
  }
}

/**
 * Get message statistics for a user by chat
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Array>} Array of chat message statistics
 */
async function getUserMessageStatsByChat(db, userId) {
  try {
    const userChatCollection = db.collection('userChat');
    const chatsCollection = db.collection('chats');
    
    const result = await userChatCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $project: {
          chatId: 1,
          messageCount: { $size: { $ifNull: ['$messages', []] } }
        }
      },
      {
        $lookup: {
          from: 'chats',
          localField: 'chatId',
          foreignField: '_id',
          as: 'chatInfo'
        }
      },
      {
        $unwind: { path: '$chatInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          chatId: 1,
          chatName: { $ifNull: ['$chatInfo.name', 'Unknown Chat'] },
          messageCount: 1
        }
      },
      { $sort: { messageCount: -1 } }
    ]).toArray();
    
    return result;
  } catch (error) {
    console.error('Error getting user message stats by chat:', error);
    return [];
  }
}

/**
 * Get combined content statistics for a user
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Combined content statistics
 */
async function getUserContentStats(db, userId) {
  try {
    const [imageStats, messageStats] = await Promise.all([
      getUserImageGenerationStats(db, userId),
      getUserMessageStats(db, userId)
    ]);

    return {
      images: imageStats,
      messages: messageStats,
      totalContent: (imageStats.totalImages || 0) + (messageStats.totalMessages || 0)
    };
  } catch (error) {
    console.error('Error getting user content stats:', error);
    return {
      images: { totalImages: 0, totalEntries: 0 },
      messages: { totalMessages: 0, totalChats: 0 },
      totalContent: 0
    };
  }
}

/**
 * Export comprehensive user analytics
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Complete analytics export
 */
async function exportUserAnalytics(db, userId) {
  try {
    const [
      imageStats,
      imageStatsByChat,
      messageStats,
      messageStatsByChat,
      contentStats
    ] = await Promise.all([
      getUserImageGenerationStats(db, userId),
      getUserImageGenerationStatsByChat(db, userId),
      getUserMessageStats(db, userId),
      getUserMessageStatsByChat(db, userId),
      getUserContentStats(db, userId)
    ]);

    return {
      userId,
      summary: {
        totalImages: imageStats.totalImages || 0,
        totalMessages: messageStats.totalMessages || 0,
        totalChats: messageStats.totalChats || 0,
        totalContent: contentStats.totalContent || 0
      },
      detailed: {
        imagesByChat: imageStatsByChat,
        messagesByChat: messageStatsByChat
      },
      exportDate: new Date()
    };
  } catch (error) {
    console.error('Error exporting user analytics:', error);
    throw error;
  }
}

/**
 * Enhanced user export utility with comprehensive field handling
 * @param {Object} db - MongoDB database instance
 * @param {Object} options - Export options
 * @returns {Promise<Array>} Array of user data for export
 */
async function getUsersForExport(db, options = {}) {
  try {
    if (!db) {
      throw new Error('Database instance is required');
    }

    const {
      userType = 'registered',
      fields = ['createdAt', 'email', 'nickname', 'gender', 'subscriptionStatus'],
      sortBy = 'createdAt',
      sortOrder = -1,
      limit = null,
      skip = 0
    } = options;

    // Validate sortOrder
    const validSortOrder = [-1, 1].includes(sortOrder) ? sortOrder : -1;

    // Build user query based on type
    let userQuery = {};
    if (userType === 'registered') {
      userQuery = { 
        email: { $exists: true },
        isTemporary: { $ne: true } // Exclude temporary users
      };
    } else if (userType === 'recent') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      userQuery = {
        createdAt: { $gte: yesterday, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
        isTemporary: { $ne: true }
      };
    } else {
      // For 'all', still exclude temporary users by default
      userQuery = { isTemporary: { $ne: true } };
    }

    // Create projection based on requested fields
    const projection = {};
    fields.forEach(field => {
      if (typeof field === 'string' && field.trim()) {
        projection[field] = 1;
      }
    });

    let query = db.collection('users')
      .find(userQuery)
      .project(projection)
      .sort({ [sortBy]: validSortOrder });

    if (skip > 0) {
      query = query.skip(skip);
    }

    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    const users = await query.toArray();

    console.log(`Exported ${users.length} users with type: ${userType}`);
    return users;
  } catch (error) {
    console.error('Error getting users for export:', error);
    throw new Error(`Failed to get users for export: ${error.message}`);
  }
}

/**
 * Format user data for CSV export
 * @param {Array} users - Array of user documents
 * @param {Array} fields - Fields to include in export
 * @returns {Object} Formatted CSV data
 */
function formatUsersForCsv(users, fields) {
  try {
    if (!Array.isArray(users)) {
      throw new Error('Users must be an array');
    }
    
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('Fields must be a non-empty array');
    }

    const escapeCsvField = (field) => {
      if (field == null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatFieldValue = (user, fieldName) => {
      if (!user || typeof user !== 'object') {
        return '';
      }

      let value = user[fieldName];
      
      // Handle different field types
      switch (fieldName) {
        case 'createdAt':
        case 'updatedAt':
        case 'lastLogin':
        case 'lastPointsUpdate':
          if (value instanceof Date) {
            return value.toISOString().split('T')[0]; // YYYY-MM-DD format
          } else if (typeof value === 'string') {
            try {
              return new Date(value).toISOString().split('T')[0];
            } catch (e) {
              return value;
            }
          }
          return value || '';
        
        case 'birthDate':
          if (value && typeof value === 'object' && value.year) {
            const month = String(value.month || 1).padStart(2, '0');
            const day = String(value.day || 1).padStart(2, '0');
            return `${value.year}-${month}-${day}`;
          }
          return value || '';
        
        case 'ageVerification':
        case 'showNSFW':
          return value === true ? 'Yes' : (value === false ? 'No' : '');
        
        case 'points':
        case 'totalImages':
        case 'totalMessages':
        case 'totalChats':
          return (value && !isNaN(value)) ? Number(value) : 0;
        
        case 'subscriptionStatus':
          return value === 'premium' || value === 'active' ? 'Premium' : 'Free';
        
        default:
          return value || '';
      }
    };

    const header = fields.join(',');
    const rows = users.map(user => {
      try {
        return fields.map(field => escapeCsvField(formatFieldValue(user, field))).join(',');
      } catch (rowError) {
        console.error(`Error formatting row for user ${user._id}:`, rowError);
        return fields.map(() => '').join(','); // Return empty row on error
      }
    });

    return {
      header,
      rows,
      csv: [header, ...rows].join('\n'),
      totalRecords: users.length
    };
  } catch (error) {
    console.error('Error formatting CSV data:', error);
    throw new Error(`Failed to format CSV data: ${error.message}`);
  }
}

/**
 * Get user statistics for export enhancement
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} User statistics
 */
async function getUserExportStats(db, userId) {
  try {
    const [imageStats, messageStats] = await Promise.all([
      getUserImageGenerationStats(db, userId),
      getUserMessageStats(db, userId)
    ]);

    return {
      totalImages: imageStats.totalImages || 0,
      totalMessages: messageStats.totalMessages || 0,
      totalChats: messageStats.totalChats || 0
    };
  } catch (error) {
    console.error('Error getting user export stats:', error);
    return {
      totalImages: 0,
      totalMessages: 0,
      totalChats: 0
    };
  }
}

module.exports = {
  getUserImageGenerationStats,
  getUserImageGenerationStatsByChat,
  getUserMessageStats,
  getUserMessageStatsByChat,
  getUserContentStats,
  exportUserAnalytics,
  getUsersForExport,
  formatUsersForCsv,
  getUserExportStats
};
