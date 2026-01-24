const { ObjectId } = require('mongodb');
const { searchImages, searchVideos, searchImagesGroupedByCharacter } = require('../models/gallery-search-utils');
const { parseUserState, updateSeenState, updateTagPreferences } = require('../models/content-sequencing-utils');
const { 
  getUserInteractionState, 
  recordCharacterView, 
  recordTagInteraction 
} = require('../models/user-interaction-utils');

async function routes(fastify, options) {
  /**
   * Explore endpoint - Returns images grouped by character for swipe gallery
   * GET /api/gallery/explore
   * Query parameters: query, page, limit, nsfw (include/exclude), groupByCharacter
   * Body (optional): userState - client-side interaction state for non-logged-in users
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
      // Handle both boolean true and string 'true' for user.showNSFW
      const userWantsNSFW = user.showNSFW === true || user.showNSFW === 'true';
      const showNSFW = nsfwFilter === 'include' && 
                       userWantsNSFW && 
                       user.subscriptionStatus === 'active';
      
      // Get user interaction state
      // For logged-in users: from database
      // For temporary users: accept from request body/header (with size limit)
      let userState = null;
      
      if (!user.isTemporary) {
        // Logged-in user - get from database
        userState = await getUserInteractionState(db, user._id);
      } else {
        // Temporary user - get from client (localStorage) with validation
        const clientState = request.headers['x-user-state'];
        if (clientState) {
          try {
            // Limit size to prevent abuse (100KB max)
            if (clientState.length > 102400) {
              console.warn('[gallery-search] User state too large, ignoring');
            } else {
              userState = parseUserState(clientState);
            }
          } catch (error) {
            console.error('[gallery-search] Error parsing client user state:', error);
          }
        }
      }
      
      const result = await searchImagesGroupedByCharacter(db, user, queryStr, page, limit, showNSFW, userState);

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

  /**
   * Record character view - track user interactions for personalization
   * POST /api/gallery/track/character-view
   * Body: { characterId, imageIds, tags }
   */
  fastify.post('/api/gallery/track/character-view', async (request, reply) => {
    try {
      const user = request.user;
      const { characterId, imageIds = [], tags = [] } = request.body;

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!characterId) {
        return reply.code(400).send({ error: 'characterId is required' });
      }

      const db = fastify.mongo.db;

      // For logged-in users, store in database
      if (!user.isTemporary) {
        await recordCharacterView(db, user._id, characterId, imageIds, tags);
        return reply.send({ success: true, stored: 'database' });
      } else {
        // For temporary users, return updated state for client to store
        // Client will store this in localStorage
        const clientState = request.headers['x-user-state'];
        let userState = clientState ? parseUserState(clientState) : {};
        
        userState = updateSeenState(userState, characterId, imageIds);
        if (tags.length > 0) {
          userState = updateTagPreferences(userState, tags, 0.5);
        }
        
        return reply.send({ 
          success: true, 
          stored: 'client', 
          userState 
        });
      }
    } catch (err) {
      console.error('[gallery-search] Error in /api/gallery/track/character-view:', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * Record tag interaction - track when user interacts with tags
   * POST /api/gallery/track/tag-interaction
   * Body: { tags, strength }
   */
  fastify.post('/api/gallery/track/tag-interaction', async (request, reply) => {
    try {
      const user = request.user;
      const { tags = [], strength = 1.0 } = request.body;

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!tags || tags.length === 0) {
        return reply.code(400).send({ error: 'tags are required' });
      }

      const db = fastify.mongo.db;

      // For logged-in users, store in database
      if (!user.isTemporary) {
        await recordTagInteraction(db, user._id, tags, strength);
        return reply.send({ success: true, stored: 'database' });
      } else {
        // For temporary users, return updated state
        const clientState = request.headers['x-user-state'];
        let userState = clientState ? parseUserState(clientState) : {};
        
        userState = updateTagPreferences(userState, tags, strength);
        
        return reply.send({ 
          success: true, 
          stored: 'client', 
          userState 
        });
      }
    } catch (err) {
      console.error('[gallery-search] Error in /api/gallery/track/tag-interaction:', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = routes;
