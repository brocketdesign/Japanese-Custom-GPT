const { ObjectId } = require('mongodb');
const { 
  getUserImageGenerationStats,
  getUserImageGenerationStatsByChat,
  getUserImageLikeStats,
  getUserImageLikeStatsByChat,
  debugUserImageStats,
  debugUserLikeStats
} = require('../models/user-analytics-utils');

async function routes(fastify, options) {

fastify.get('/user/:userId/image-stats', async (request, reply) => {
  try {
    const userId = new ObjectId(request.params.userId);
    const chatId = request.query.chatId; // Optional query parameter
    
    const db = fastify.mongo.db;
    const imagesGeneratedCollection = db.collection('images_generated');
    
    // Build the match filter
    let matchFilter = {
      userId: userId
    };
    
    // Add chatId filter if provided
    if (chatId && ObjectId.isValid(chatId)) {
      matchFilter.chatId = new ObjectId(chatId);
    }
    
    // Aggregate to sum generation counts
    const result = await imagesGeneratedCollection.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalImages: { $sum: '$generationCount' },
          totalEntries: { $sum: 1 } // Number of unique images
        }
      }
    ]).toArray();
    
    // If no images found
    if (result.length === 0) {
      return reply.send({
        userId,
        chatId: chatId || null,
        totalImages: 0,
        totalEntries: 0
      });
    }
    
    const stats = result[0];
    
    return reply.send({
      userId,
      chatId: chatId || null,
      totalImages: stats.totalImages, // Total generation count across all images
      totalEntries: stats.totalEntries // Number of unique images generated
    });
    
  } catch (err) {
    console.error('Error getting user image stats:', err);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

  fastify.get('/user/:userId/analytics/images', async (request, reply) => {
    try {
      const userId = new ObjectId(request.params.userId);
      const db = fastify.mongo.db;
      
      const [totalStats, statsByChat] = await Promise.all([
        getUserImageGenerationStats(db, userId),
        getUserImageGenerationStatsByChat(db, userId)
      ]);
      
      return reply.send({
        userId,
        total: totalStats,
        byChat: statsByChat
      });
    } catch (err) {
      console.error('Error getting user image analytics:', err);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/user/:userId/analytics/likes', async (request, reply) => {
    try {
      const userId = new ObjectId(request.params.userId);
      const db = fastify.mongo.db;
      
      const [totalStats, statsByChat] = await Promise.all([
        getUserImageLikeStats(db, userId),
        getUserImageLikeStatsByChat(db, userId)
      ]);
      
      return reply.send({
        userId,
        total: totalStats,
        byChat: statsByChat
      });
    } catch (err) {
      console.error('Error getting user like analytics:', err);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/user/:userId/debug/image-stats', async (request, reply) => {
    try {
      const userId = new ObjectId(request.params.userId);
      const db = fastify.mongo.db;
      
      // Extract debug context from request body if available
      const debugContext = request.body || {};
      
      const debugData = await debugUserImageStats(db, userId, fastify, debugContext);
      
      return reply.send({
        message: 'Debug data logged successfully',
        data: debugData
      });
    } catch (err) {
      console.error('Error debugging user image stats:', err);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/user/:userId/debug/like-stats', async (request, reply) => {
    try {
      const userId = new ObjectId(request.params.userId);
      const db = fastify.mongo.db;
      
      // Extract debug context from request body if available
      const debugContext = request.body || {};
      
      const debugData = await debugUserLikeStats(db, userId, fastify, debugContext);
      
      return reply.send({
        message: 'Debug data logged successfully',
        data: debugData
      });
    } catch (err) {
      console.error('Error debugging user like stats:', err);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
  
  fastify.get('/user/analytics/leaderboard/images', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const usersCollection = db.collection('users');
      const imagesGeneratedCollection = db.collection('images_generated');
      
      // Aggregate image generation stats by user
      const imageStats = await imagesGeneratedCollection.aggregate([
        {
          $group: {
            _id: '$userId',
            totalImages: { $sum: '$generationCount' },
            totalEntries: { $sum: 1 }
          }
        },
        {
          $sort: { totalImages: -1 }
        },
        {
          $limit: 50 // Top 50 users
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $match: {
            'user.isTemporary': { $ne: true }
          }
        },
        {
          $project: {
            _id: '$user._id',
            nickname: '$user.nickname',
            profileUrl: '$user.profileUrl',
            totalImages: 1,
            totalEntries: 1,
            joinedDate: '$user.createdAt'
          }
        }
      ]).toArray();
      
      return reply.send({
        success: true,
        leaderboard: imageStats,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error getting image generation leaderboard:', err);
      reply.code(500).send({ 
        success: false,
        error: 'Internal Server Error' 
      });
    }
  });
}
module.exports = routes;