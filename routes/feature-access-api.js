/**
 * Feature Access API Routes
 */

const {
  checkFeatureAccess,
  getUserFeatures,
  getUserLimits
} = require('../models/feature-access-utils');

async function routes(fastify, options) {
  const db = fastify.mongo.db;

  /**
   * GET /api/features/access/:featureId
   * Check access to a specific feature
   */
  fastify.get('/api/features/access/:featureId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { featureId } = request.params;
      const access = await checkFeatureAccess(user, featureId, db);

      return reply.send({
        success: true,
        featureId,
        ...access
      });
    } catch (error) {
      console.error('[Feature Access] Check error:', error);
      return reply.code(500).send({ error: 'Failed to check feature access' });
    }
  });

  /**
   * GET /api/features
   * Get all features with access status
   */
  fastify.get('/api/features', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const features = await getUserFeatures(user, db);

      return reply.send({
        success: true,
        ...features
      });
    } catch (error) {
      console.error('[Feature Access] Get features error:', error);
      return reply.code(500).send({ error: 'Failed to get features' });
    }
  });

  /**
   * GET /api/features/limits
   * Get user's feature limits
   */
  fastify.get('/api/features/limits', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const limits = getUserLimits(user);

      return reply.send({
        success: true,
        ...limits
      });
    } catch (error) {
      console.error('[Feature Access] Get limits error:', error);
      return reply.code(500).send({ error: 'Failed to get limits' });
    }
  });
}

module.exports = routes;
