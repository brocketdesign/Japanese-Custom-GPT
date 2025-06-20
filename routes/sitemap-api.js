const { getCachedSitemapData, cacheSitemapData } = require('../models/sitemap-utils');

async function routes(fastify, options) {
  
  // Get sitemap data (from cache or generate new)
  fastify.get('/api/sitemap', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      
      // Try to get cached data first
      let sitemapData = await getCachedSitemapData(db);
      
      // If no cached data, generate new cache
      if (!sitemapData) {
        console.log('[API /sitemap] No cached data found, generating new cache...');
        sitemapData = await cacheSitemapData(db);
      }
      
      return reply.send({
        success: true,
        data: {
          characters: sitemapData.characters,
          tags: sitemapData.tags,
          totalCharacters: sitemapData.totalCharacters,
          totalTags: sitemapData.totalTags,
          lastUpdated: sitemapData.lastUpdated
        }
      });
    } catch (error) {
      console.error('[API /sitemap] Error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch sitemap data'
      });
    }
  });

  // Manual refresh of sitemap cache (admin only)
  fastify.post('/api/sitemap/refresh', async (request, reply) => {
    try {
      const user = request.user;
      const db = fastify.mongo.db;
      
      // Check if user is admin
      const usersCollection = db.collection('users');
      const userData = await usersCollection.findOne({ 
        _id: new fastify.mongo.ObjectId(user._id) 
      });
      
      if (!userData || userData.role !== 'admin') {
        return reply.status(403).send({
          success: false,
          error: 'Admin access required'
        });
      }
      
      console.log('[API /sitemap/refresh] Manual sitemap cache refresh requested by admin');
      const sitemapData = await cacheSitemapData(db);
      
      return reply.send({
        success: true,
        message: 'Sitemap cache refreshed successfully',
        data: {
          totalCharacters: sitemapData.totalCharacters,
          totalTags: sitemapData.totalTags,
          lastUpdated: sitemapData.lastUpdated
        }
      });
    } catch (error) {
      console.error('[API /sitemap/refresh] Error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to refresh sitemap cache'
      });
    }
  });
}

module.exports = routes;
