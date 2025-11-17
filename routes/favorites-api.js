const { ObjectId } = require('mongodb');
const {
  addFavorite,
  removeFavorite,
  isFavorited,
  getUserFavorites,
  checkFavoritesStatus,
  toggleFavorite,
  getFavoriteCount,
  toObjectId
} = require('../models/favorites-utils');

async function routes(fastify, options) {
  /**
   * POST /favorites/toggle
   * Toggle favorite status for a chat
   * Body: { chatId }
   */
  fastify.post('/favorites/toggle', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { chatId } = request.body;
      if (!chatId) {
        return reply.code(400).send({ error: 'chatId is required' });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(chatId)) {
        return reply.code(400).send({ error: 'Invalid chatId format' });
      }

      const db = fastify.mongo.db;
      const result = await toggleFavorite(db, user._id, chatId);

      return reply.send(result);
    } catch (error) {
      console.error('Error in /favorites/toggle:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * POST /favorites/add
   * Add a chat to favorites
   * Body: { chatId }
   */
  fastify.post('/favorites/add', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { chatId } = request.body;
      if (!chatId) {
        return reply.code(400).send({ error: 'chatId is required' });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(chatId)) {
        return reply.code(400).send({ error: 'Invalid chatId format' });
      }

      const db = fastify.mongo.db;
      const result = await addFavorite(db, user._id, chatId);

      return reply.send(result);
    } catch (error) {
      console.error('Error in /favorites/add:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * POST /favorites/remove
   * Remove a chat from favorites
   * Body: { chatId }
   */
  fastify.post('/favorites/remove', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { chatId } = request.body;
      if (!chatId) {
        return reply.code(400).send({ error: 'chatId is required' });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(chatId)) {
        return reply.code(400).send({ error: 'Invalid chatId format' });
      }

      const db = fastify.mongo.db;
      const result = await removeFavorite(db, user._id, chatId);

      return reply.send(result);
    } catch (error) {
      console.error('Error in /favorites/remove:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /favorites/check/:chatId
   * Check if a chat is favorited by the current user
   */
  fastify.get('/favorites/check/:chatId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { chatId } = request.params;
      if (!chatId) {
        return reply.code(400).send({ error: 'chatId is required' });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(chatId)) {
        return reply.code(400).send({ error: 'Invalid chatId format' });
      }

      const db = fastify.mongo.db;
      const isFav = await isFavorited(db, user._id, chatId);

      return reply.send({ isFavorited: isFav, chatId });
    } catch (error) {
      console.error('Error in /favorites/check/:chatId:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /favorites/check-multiple
   * Check favorite status for multiple chats
   * Query: { chatIds: 'id1,id2,id3' }
   */
  fastify.get('/favorites/check-multiple', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { chatIds } = request.query;
      if (!chatIds) {
        return reply.code(400).send({ error: 'chatIds query parameter is required' });
      }

      const chatIdArray = chatIds.split(',').filter(id => id.trim() !== '');
      if (chatIdArray.length === 0) {
        return reply.code(400).send({ error: 'At least one chatId is required' });
      }

      // Validate all ObjectId formats
      const invalidIds = chatIdArray.filter(id => !ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return reply.code(400).send({ error: `Invalid chatId format: ${invalidIds.join(', ')}` });
      }

      const db = fastify.mongo.db;
      const statusMap = await checkFavoritesStatus(db, user._id, chatIdArray);

      // Convert Map to object for JSON serialization
      const statusObject = {};
      statusMap.forEach((value, key) => {
        statusObject[key] = value;
      });

      return reply.send({ favorites: statusObject });
    } catch (error) {
      console.error('Error in /favorites/check-multiple:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /favorites
   * Get user's favorite chats with pagination
   * Query: { page: 1, limit: 12 }
   */
  fastify.get('/favorites', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 12;

      const db = fastify.mongo.db;
      const result = await getUserFavorites(db, user._id, { page, limit });

      return reply.send(result);
    } catch (error) {
      console.error('Error in /favorites:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /favorites/count
   * Get total number of user's favorite chats
   */
  fastify.get('/favorites/count', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const count = await getFavoriteCount(db, user._id);

      return reply.send({ count, success: true });
    } catch (error) {
      console.error('Error in /favorites/count:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = routes;
