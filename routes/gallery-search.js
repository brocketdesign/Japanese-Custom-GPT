const { ObjectId } = require('mongodb');
const { searchImages, searchVideos, searchImagesGroupedByCharacter } = require('../models/gallery-search-utils');

async function routes(fastify, options) {
  /**
   * Explore endpoint - Returns images grouped by character for swipe gallery
   * GET /api/gallery/explore
   * Query parameters: query, page, limit, nsfw (include/exclude), groupByCharacter
   */
  fastify.get('/api/gallery/explore', async (request, reply) => {
    try {
      const user = request.user;
      const queryStr = request.query.query || '';
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 20;
      const nsfwFilter = request.query.nsfw || 'exclude'; // 'include' or 'exclude'

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      
      // Check user's NSFW preference and subscription status
      const showNSFW = nsfwFilter === 'include' && 
                       user.showNSFW === true && 
                       user.subscriptionStatus === 'active';
      
      const result = await searchImagesGroupedByCharacter(db, user, queryStr, page, limit, showNSFW);

      return reply.send(result);
    } catch (err) {
      console.error('[gallery-search] Error in /api/gallery/explore:', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * Search images endpoint
   * GET /api/gallery/search/images
   * Query parameters: query, page, limit
   */
  fastify.get('/api/gallery/search/images', async (request, reply) => {
    try {
      const user = request.user;
      const queryStr = request.query.query || '';
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 24;

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const result = await searchImages(db, user, queryStr, page, limit);

      return reply.send(result);
    } catch (err) {
      console.error('[gallery-search] Error in /api/gallery/search/images:', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * Search videos endpoint
   * GET /api/gallery/search/videos
   * Query parameters: query, page, limit
   */
  fastify.get('/api/gallery/search/videos', async (request, reply) => {
    try {
      const user = request.user;
      const queryStr = request.query.query || '';
      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 24;

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const result = await searchVideos(db, user, queryStr, page, limit);

      return reply.send(result);
    } catch (err) {
      console.error('[gallery-search] Error in /api/gallery/search/videos:', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = routes;
