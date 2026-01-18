/**
 * Video Dashboard Routes
 * Dashboard for video generation with prompt variation, scheduling, and automation
 */

const { ObjectId } = require('mongodb');
const { checkUserAdmin } = require('../models/tool');
const {
  VIDEO_MODEL_CONFIGS,
  DURATION_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  initializeVideoTest,
  checkVideoTaskResult,
  saveVideoTestResult,
  getVideoModelStats,
  getRecentVideoTests,
  saveVideoRating,
  getVideoRating
} = require('../models/dashboard-video-utils');
const { removeUserPoints, getUserPoints } = require('../models/user-points-utils');
const { PRICING_CONFIG, getVideoGenerationCost } = require('../config/pricing');

async function routes(fastify, options) {
  
  /**
   * GET /dashboard/video
   * Render the video generation dashboard
   */
  fastify.get('/dashboard/video', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.redirect('/login');
      }

      const db = fastify.mongo.db;
      const translations = request.translations;
      
      // Check if user is admin
      const isAdmin = await checkUserAdmin(fastify, user._id);

      // Get video model statistics (only for admins)
      const modelStats = isAdmin ? await getVideoModelStats(db) : [];
      
      // Get recent video tests - filter by user if not admin
      const userId = isAdmin ? null : user._id.toString();
      const recentTests = await getRecentVideoTests(db, 20, null, userId);

      // Prepare model list for view
      const models = Object.entries(VIDEO_MODEL_CONFIGS).map(([id, config]) => {
        const stats = modelStats.find(s => s.modelId === id) || {};
        return {
          id,
          name: config.name,
          description: config.description,
          async: config.async,
          totalTests: stats.totalTests || 0,
          averageTime: stats.averageTime || 0,
          recentAverageTime: stats.recentAverageTime || 0,
          lastTested: stats.lastTested,
          minTime: stats.minTime || 0,
          maxTime: stats.maxTime || 0,
          averageRating: stats.averageRating || null,
          totalRatings: stats.totalRatings || 0
        };
      });

      // Get user's current points
      const userPoints = await getUserPoints(db, user._id);

      return reply.view('/admin/video-dashboard', {
        title: 'Video Dashboard',
        user,
        translations,
        models,
        durationOptions: DURATION_OPTIONS,
        aspectRatioOptions: ASPECT_RATIO_OPTIONS,
        recentTests,
        modelConfigs: VIDEO_MODEL_CONFIGS,
        userPoints,
        videoCostPerUnit: PRICING_CONFIG.VIDEO_GENERATION.COST,
        isAdmin
      });
    } catch (error) {
      console.error('[VideoDashboard] Error loading dashboard:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * POST /dashboard/video/generate
   * Start video generation
   */
  fastify.post('/dashboard/video/generate', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const { modelId, baseImageUrl, prompt, basePrompt, duration, aspectRatio, motionIntensity, fps } = request.body;

      if (!modelId) {
        return reply.status(400).send({ error: 'Model ID is required' });
      }

      if (!baseImageUrl) {
        return reply.status(400).send({ error: 'Base image URL is required' });
      }

      // Get video generation cost
      const totalCost = getVideoGenerationCost();

      // Check user points
      const userPoints = await getUserPoints(db, user._id);
      if (userPoints < totalCost) {
        return reply.status(402).send({ 
          error: 'Insufficient points', 
          required: totalCost, 
          available: userPoints,
          message: `You need ${totalCost} points but only have ${userPoints} points.`
        });
      }

      // Deduct points before starting generation
      try {
        await removeUserPoints(
          db, 
          user._id, 
          totalCost, 
          request.translations?.points?.deduction_reasons?.video_generation || 'Video generation', 
          'video_generation', 
          fastify
        );
        console.log(`[VideoDashboard] Deducted ${totalCost} points from user ${user._id} for video generation`);
      } catch (pointsError) {
        console.error('[VideoDashboard] Error deducting points:', pointsError);
        return reply.status(402).send({ error: 'Error deducting points for video generation.' });
      }

      console.log(`[VideoDashboard] Starting video generation for model: ${modelId}`);
      console.log(`[VideoDashboard] Prompt: ${prompt}`);

      // Start generation
      const task = await initializeVideoTest(modelId, {
        imageUrl: baseImageUrl,
        prompt: prompt || basePrompt || 'Dynamic video from image',
        duration: duration || '5',
        aspectRatio: aspectRatio || '16:9',
        motionIntensity: motionIntensity,
        fps: fps
      });

      task.originalPrompt = basePrompt || prompt;
      task.finalPrompt = prompt;
      task.duration = duration;
      task.aspectRatio = aspectRatio;
      task.userId = user._id.toString();

      return reply.send({
        success: true,
        task
      });
    } catch (error) {
      console.error('[VideoDashboard] Error starting generation:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/video/status/:taskId
   * Check status of a video generation task
   */
  fastify.get('/dashboard/video/status/:taskId', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { taskId } = request.params;

      const result = await checkVideoTaskResult(taskId);
      
      return reply.send(result);
    } catch (error) {
      console.error('[VideoDashboard] Error checking status:', error);
      return reply.status(500).send({ 
        status: 'error', 
        error: error.message 
      });
    }
  });

  /**
   * POST /dashboard/video/save-result
   * Save a completed test result
   */
  fastify.post('/dashboard/video/save-result', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const result = request.body;

      result.userId = user._id.toString();
      const testId = await saveVideoTestResult(db, result);

      return reply.send({ success: true, testId });
    } catch (error) {
      console.error('[VideoDashboard] Error saving result:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/video/stats
   * Get model statistics
   */
  fastify.get('/dashboard/video/stats', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const stats = await getVideoModelStats(db);

      return reply.send({ stats });
    } catch (error) {
      console.error('[VideoDashboard] Error getting stats:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/video/history
   * Get recent test history
   */
  fastify.get('/dashboard/video/history', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const limit = parseInt(request.query.limit) || 50;
      const modelId = request.query.modelId || null;
      
      // Check if user is admin - non-admins can only see their own history
      const isAdmin = await checkUserAdmin(fastify, user._id);
      const userId = isAdmin ? null : user._id.toString();
      
      const history = await getRecentVideoTests(db, limit, modelId, userId);

      return reply.send({ history });
    } catch (error) {
      console.error('[VideoDashboard] Error getting history:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * DELETE /dashboard/video/stats/reset
   * Reset model statistics (admin only)
   */
  fastify.delete('/dashboard/video/stats/reset', async (request, reply) => {
    try {
      const user = request.user;
      const isAdmin = await checkUserAdmin(fastify, user._id);
      
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied. Admin only.' });
      }

      const db = fastify.mongo.db;
      const { modelId } = request.query;

      if (modelId) {
        await db.collection('videoModelStats').deleteOne({ modelId });
        await db.collection('videoModelTests').deleteMany({ modelId });
      } else {
        await db.collection('videoModelStats').deleteMany({});
        await db.collection('videoModelTests').deleteMany({});
      }

      return reply.send({ 
        success: true, 
        message: modelId ? `Stats reset for ${modelId}` : 'All stats reset' 
      });
    } catch (error) {
      console.error('[VideoDashboard] Error resetting stats:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /dashboard/video/rate-video
   * Save a video rating
   */
  fastify.post('/dashboard/video/rate-video', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const { modelId, modelName, videoUrl, rating, testId } = request.body;

      if (!modelId || !videoUrl || !rating) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      if (rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Rating must be between 1 and 5' });
      }

      await saveVideoRating(db, modelId, videoUrl, rating, testId, user._id.toString());

      return reply.send({ success: true });
    } catch (error) {
      console.error('[VideoDashboard] Error saving rating:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/video/rating/:testId
   * Get rating for a test
   */
  fastify.get('/dashboard/video/rating/:testId', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const { testId } = request.params;

      const rating = await getVideoRating(db, testId);

      if (rating) {
        return reply.send({ success: true, rating: rating.rating });
      } else {
        return reply.send({ success: false, rating: null });
      }
    } catch (error) {
      console.error('[VideoDashboard] Error getting rating:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}

module.exports = routes;
