/**
 * Analytics API Routes
 * Phase 5: Content & Traffic Features
 * Provides analytics endpoints for creator dashboard
 */

const {
  TIME_PERIODS,
  getPostMetrics,
  getPostMetricsOverTime,
  getTopPerformingPosts,
  getSubscriberMetrics,
  getSubscriberGrowthOverTime,
  getRevenueMetrics,
  getRevenueOverTime,
  getFollowerMetrics,
  getAudienceDemographics,
  getCreatorDashboardAnalytics,
  trackPostView,
  getScheduleMetrics,
  getContentTypeDistribution
} = require('../models/analytics-utils');

async function routes(fastify, options) {
  const db = fastify.mongo.db;

  /**
   * GET /api/analytics/dashboard
   * Get comprehensive dashboard analytics for creator
   */
  fastify.get('/api/analytics/dashboard', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS } = request.query;

      const analytics = await getCreatorDashboardAnalytics(db, user._id, { period });

      return reply.send({
        success: true,
        analytics
      });
    } catch (error) {
      console.error('[Analytics API] Dashboard error:', error);
      return reply.code(500).send({ error: 'Failed to get analytics' });
    }
  });

  /**
   * GET /api/analytics/posts
   * Get post performance metrics
   */
  fastify.get('/api/analytics/posts', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS, type } = request.query;

      const metrics = await getPostMetrics(db, user._id, { period, postType: type });

      return reply.send({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('[Analytics API] Post metrics error:', error);
      return reply.code(500).send({ error: 'Failed to get post metrics' });
    }
  });

  /**
   * GET /api/analytics/posts/timeline
   * Get post metrics over time for charts
   */
  fastify.get('/api/analytics/posts/timeline', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { 
        period = TIME_PERIODS.LAST_30_DAYS, 
        granularity = 'day' 
      } = request.query;

      const timeline = await getPostMetricsOverTime(db, user._id, { period, granularity });

      return reply.send({
        success: true,
        timeline
      });
    } catch (error) {
      console.error('[Analytics API] Post timeline error:', error);
      return reply.code(500).send({ error: 'Failed to get post timeline' });
    }
  });

  /**
   * GET /api/analytics/posts/top
   * Get top performing posts
   */
  fastify.get('/api/analytics/posts/top', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { 
        period = TIME_PERIODS.LAST_30_DAYS, 
        limit = 10,
        sortBy = 'views'
      } = request.query;

      const posts = await getTopPerformingPosts(db, user._id, { 
        period, 
        limit: parseInt(limit),
        sortBy 
      });

      return reply.send({
        success: true,
        posts
      });
    } catch (error) {
      console.error('[Analytics API] Top posts error:', error);
      return reply.code(500).send({ error: 'Failed to get top posts' });
    }
  });

  /**
   * GET /api/analytics/subscribers
   * Get subscriber metrics
   */
  fastify.get('/api/analytics/subscribers', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      // Verify user is a creator
      if (!user.isCreator) {
        return reply.code(403).send({ error: 'Creator account required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS } = request.query;

      const metrics = await getSubscriberMetrics(db, user._id, { period });

      return reply.send({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('[Analytics API] Subscriber metrics error:', error);
      return reply.code(500).send({ error: 'Failed to get subscriber metrics' });
    }
  });

  /**
   * GET /api/analytics/subscribers/growth
   * Get subscriber growth over time
   */
  fastify.get('/api/analytics/subscribers/growth', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      if (!user.isCreator) {
        return reply.code(403).send({ error: 'Creator account required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS } = request.query;

      const growth = await getSubscriberGrowthOverTime(db, user._id, { period });

      return reply.send({
        success: true,
        growth
      });
    } catch (error) {
      console.error('[Analytics API] Subscriber growth error:', error);
      return reply.code(500).send({ error: 'Failed to get subscriber growth' });
    }
  });

  /**
   * GET /api/analytics/revenue
   * Get revenue metrics
   */
  fastify.get('/api/analytics/revenue', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      if (!user.isCreator) {
        return reply.code(403).send({ error: 'Creator account required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS } = request.query;

      const metrics = await getRevenueMetrics(db, user._id, { period });

      return reply.send({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('[Analytics API] Revenue metrics error:', error);
      return reply.code(500).send({ error: 'Failed to get revenue metrics' });
    }
  });

  /**
   * GET /api/analytics/revenue/timeline
   * Get revenue over time
   */
  fastify.get('/api/analytics/revenue/timeline', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      if (!user.isCreator) {
        return reply.code(403).send({ error: 'Creator account required' });
      }

      const { 
        period = TIME_PERIODS.LAST_30_DAYS,
        granularity = 'day'
      } = request.query;

      const timeline = await getRevenueOverTime(db, user._id, { period, granularity });

      return reply.send({
        success: true,
        timeline
      });
    } catch (error) {
      console.error('[Analytics API] Revenue timeline error:', error);
      return reply.code(500).send({ error: 'Failed to get revenue timeline' });
    }
  });

  /**
   * GET /api/analytics/followers
   * Get follower metrics
   */
  fastify.get('/api/analytics/followers', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS } = request.query;

      const metrics = await getFollowerMetrics(db, user._id, { period });

      return reply.send({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('[Analytics API] Follower metrics error:', error);
      return reply.code(500).send({ error: 'Failed to get follower metrics' });
    }
  });

  /**
   * GET /api/analytics/demographics
   * Get audience demographics
   */
  fastify.get('/api/analytics/demographics', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      if (!user.isCreator) {
        return reply.code(403).send({ error: 'Creator account required' });
      }

      const demographics = await getAudienceDemographics(db, user._id);

      return reply.send({
        success: true,
        demographics
      });
    } catch (error) {
      console.error('[Analytics API] Demographics error:', error);
      return reply.code(500).send({ error: 'Failed to get demographics' });
    }
  });

  /**
   * GET /api/analytics/schedules
   * Get schedule statistics
   */
  fastify.get('/api/analytics/schedules', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS } = request.query;

      const metrics = await getScheduleMetrics(db, user._id, { period });

      return reply.send({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('[Analytics API] Schedule metrics error:', error);
      return reply.code(500).send({ error: 'Failed to get schedule metrics' });
    }
  });

  /**
   * GET /api/analytics/content-types
   * Get content type distribution
   */
  fastify.get('/api/analytics/content-types', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { period = TIME_PERIODS.LAST_30_DAYS } = request.query;

      const distribution = await getContentTypeDistribution(db, user._id, { period });

      return reply.send({
        success: true,
        distribution
      });
    } catch (error) {
      console.error('[Analytics API] Content types error:', error);
      return reply.code(500).send({ error: 'Failed to get content distribution' });
    }
  });

  /**
   * POST /api/analytics/track/view
   * Track a post view
   */
  fastify.post('/api/analytics/track/view', async (request, reply) => {
    try {
      const user = request.user;
      const { postId } = request.body;

      if (!postId) {
        return reply.code(400).send({ error: 'postId is required' });
      }

      await trackPostView(db, postId, user?._id || null);

      return reply.send({
        success: true,
        message: 'View tracked'
      });
    } catch (error) {
      console.error('[Analytics API] Track view error:', error);
      return reply.code(500).send({ error: 'Failed to track view' });
    }
  });

  /**
   * GET /api/analytics/time-periods
   * Get available time periods
   */
  fastify.get('/api/analytics/time-periods', async (request, reply) => {
    return reply.send({
      success: true,
      periods: Object.entries(TIME_PERIODS).map(([key, value]) => ({
        key,
        value,
        label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      }))
    });
  });
}

module.exports = routes;
