const { ObjectId } = require('mongodb');
const {
  followCharacter,
  unfollowCharacter,
  isFollowing,
  toggleFollow,
  getFollowerCount,
  getCharacterFollowers,
  getUserFollowedCharacters,
  toObjectId
} = require('../models/character-followers-utils');

async function routes(fastify, options) {
  /**
   * POST /character-followers/toggle
   * Toggle follow status for a character
   * Body: { chatId }
   */
  fastify.post('/character-followers/toggle', async (request, reply) => {
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
      const result = await toggleFollow(db, user._id, chatId);

      return reply.send(result);
    } catch (error) {
      console.error('Error in /character-followers/toggle:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * POST /character-followers/follow
   * Follow a character
   * Body: { chatId }
   */
  fastify.post('/character-followers/follow', async (request, reply) => {
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
      const result = await followCharacter(db, user._id, chatId);

      return reply.send(result);
    } catch (error) {
      console.error('Error in /character-followers/follow:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * POST /character-followers/unfollow
   * Unfollow a character
   * Body: { chatId }
   */
  fastify.post('/character-followers/unfollow', async (request, reply) => {
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
      const result = await unfollowCharacter(db, user._id, chatId);

      return reply.send(result);
    } catch (error) {
      console.error('Error in /character-followers/unfollow:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /character-followers/check/:chatId
   * Check if user is following a character
   */
  fastify.get('/character-followers/check/:chatId', async (request, reply) => {
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
      const following = await isFollowing(db, user._id, chatId);

      return reply.send({ isFollowing: following, chatId });
    } catch (error) {
      console.error('Error in /character-followers/check/:chatId:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /character-followers/count/:chatId
   * Get follower count for a character
   */
  fastify.get('/character-followers/count/:chatId', async (request, reply) => {
    try {
      const { chatId } = request.params;
      if (!chatId) {
        return reply.code(400).send({ error: 'chatId is required' });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(chatId)) {
        return reply.code(400).send({ error: 'Invalid chatId format' });
      }

      const db = fastify.mongo.db;
      const count = await getFollowerCount(db, chatId);

      return reply.send({ count, chatId, success: true });
    } catch (error) {
      console.error('Error in /character-followers/count/:chatId:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /character-followers/list/:chatId
   * Get list of followers for a character
   * Query: { page: 1, limit: 100 }
   */
  fastify.get('/character-followers/list/:chatId', async (request, reply) => {
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

      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 100;

      const db = fastify.mongo.db;
      const followers = await getCharacterFollowers(db, chatId, { page, limit });

      return reply.send({ followers, success: true });
    } catch (error) {
      console.error('Error in /character-followers/list/:chatId:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * GET /character-followers/my-follows
   * Get list of characters the user is following
   * Query: { page: 1, limit: 12 }
   */
  fastify.get('/character-followers/my-follows', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || !user._id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 12;

      const db = fastify.mongo.db;
      const result = await getUserFollowedCharacters(db, user._id, { page, limit });

      return reply.send(result);
    } catch (error) {
      console.error('Error in /character-followers/my-follows:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = routes;
