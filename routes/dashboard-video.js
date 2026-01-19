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
          category: config.category || 'i2v',
          supportedParams: config.supportedParams || [],
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
    console.log('[VideoDashboard] ========== /dashboard/video/generate ==========');
    console.log('[VideoDashboard] Request received at:', new Date().toISOString());
    
    try {
      const user = request.user;
      console.log('[VideoDashboard] User:', user ? `${user._id} (${user.email || 'no email'})` : 'NOT AUTHENTICATED');
      
      if (!user) {
        console.log('[VideoDashboard] ❌ Unauthorized - no user');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const { 
        modelId, baseImageUrl, prompt, basePrompt, duration, aspectRatio, 
        motionIntensity, fps, videoMode, videoFile, faceImageFile 
      } = request.body;

      console.log('[VideoDashboard] Request body received:');
      console.log('[VideoDashboard]   - modelId:', modelId);
      console.log('[VideoDashboard]   - videoMode:', videoMode);
      console.log('[VideoDashboard]   - prompt:', prompt?.substring(0, 100) + (prompt?.length > 100 ? '...' : ''));
      console.log('[VideoDashboard]   - basePrompt:', basePrompt?.substring(0, 100) + (basePrompt?.length > 100 ? '...' : ''));
      console.log('[VideoDashboard]   - duration:', duration);
      console.log('[VideoDashboard]   - aspectRatio:', aspectRatio);
      console.log('[VideoDashboard]   - motionIntensity:', motionIntensity);
      console.log('[VideoDashboard]   - fps:', fps);
      console.log('[VideoDashboard]   - baseImageUrl:', baseImageUrl ? `[BASE64 - ${baseImageUrl.length} chars]` : 'NOT PROVIDED');
      console.log('[VideoDashboard]   - videoFile:', videoFile ? `[BASE64 - ${videoFile.length} chars]` : 'NOT PROVIDED');
      console.log('[VideoDashboard]   - faceImageFile:', faceImageFile ? `[BASE64 - ${faceImageFile.length} chars]` : 'NOT PROVIDED');

      if (!modelId) {
        console.log('[VideoDashboard] ❌ Model ID is missing');
        return reply.status(400).send({ error: 'Model ID is required' });
      }

      const config = VIDEO_MODEL_CONFIGS[modelId];
      console.log('[VideoDashboard] Model config found:', config ? config.name : 'NOT FOUND');
      
      if (!config) {
        console.log('[VideoDashboard] ❌ Invalid model ID:', modelId);
        return reply.status(400).send({ error: 'Invalid model ID' });
      }

      // Validate inputs based on mode/category
      const category = config.category || videoMode || 'i2v';
      console.log('[VideoDashboard] Resolved category:', category);
      
      if (category === 'i2v' && !baseImageUrl) {
        console.log('[VideoDashboard] ❌ I2V mode but no base image provided');
        return reply.status(400).send({ error: 'Base image is required for image-to-video generation' });
      }
      
      if (category === 'face' && (!videoFile || !faceImageFile)) {
        console.log('[VideoDashboard] ❌ Face mode but missing video or face image');
        return reply.status(400).send({ error: 'Both video file and face image are required for video merge face' });
      }
      
      if (category === 't2v' && !prompt && !basePrompt) {
        console.log('[VideoDashboard] ❌ T2V mode but no prompt provided');
        return reply.status(400).send({ error: 'Prompt is required for text-to-video generation' });
      }

      // Get video generation cost
      const totalCost = getVideoGenerationCost();
      console.log('[VideoDashboard] Video generation cost:', totalCost);

      // Check user points
      const userPoints = await getUserPoints(db, user._id);
      console.log('[VideoDashboard] User points:', userPoints, 'Required:', totalCost);
      
      if (userPoints < totalCost) {
        console.log('[VideoDashboard] ❌ Insufficient points');
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
        console.log(`[VideoDashboard] ✅ Deducted ${totalCost} points from user ${user._id}`);
      } catch (pointsError) {
        console.error('[VideoDashboard] ❌ Error deducting points:', pointsError);
        return reply.status(402).send({ error: 'Error deducting points for video generation.' });
      }

      console.log(`[VideoDashboard] 🚀 Starting video generation`);
      console.log(`[VideoDashboard]   - Model: ${modelId} (${config.name})`);
      console.log(`[VideoDashboard]   - Category: ${category}`);
      console.log(`[VideoDashboard]   - Prompt: ${prompt || basePrompt}`);

      // Build params based on category
      const params = {
        prompt: prompt || basePrompt || 'Dynamic video generation',
        duration: duration || '5',
        aspectRatio: aspectRatio || '16:9',
        motionIntensity: motionIntensity,
        fps: fps
      };
      
      // Add category-specific params
      if (category === 'i2v') {
        params.imageUrl = baseImageUrl;
        console.log('[VideoDashboard] Added imageUrl to params (length:', baseImageUrl?.length, ')');
      } else if (category === 'face') {
        params.video_file = videoFile;
        params.face_image_file = faceImageFile;
        console.log('[VideoDashboard] Added video_file and face_image_file to params');
      }
      // T2V doesn't need additional params - just prompt

      console.log('[VideoDashboard] Params to send to initializeVideoTest:', {
        ...params,
        imageUrl: params.imageUrl ? `[BASE64 - ${params.imageUrl.length} chars]` : undefined,
        video_file: params.video_file ? `[BASE64 - ${params.video_file.length} chars]` : undefined,
        face_image_file: params.face_image_file ? `[BASE64 - ${params.face_image_file.length} chars]` : undefined
      });

      // Start generation
      console.log('[VideoDashboard] Calling initializeVideoTest...');
      const task = await initializeVideoTest(modelId, params);
      console.log('[VideoDashboard] ✅ initializeVideoTest returned:', {
        modelId: task.modelId,
        modelName: task.modelName,
        taskId: task.taskId,
        status: task.status,
        async: task.async
      });

      task.originalPrompt = basePrompt || prompt;
      task.finalPrompt = prompt;
      task.duration = duration;
      task.aspectRatio = aspectRatio;
      task.userId = user._id.toString();
      task.videoMode = category;

      console.log('[VideoDashboard] ✅ Sending success response with task');
      console.log('[VideoDashboard] ========== END /dashboard/video/generate ==========');
      
      return reply.send({
        success: true,
        task
      });
    } catch (error) {
      console.error('[VideoDashboard] ❌ Error starting generation:', error);
      console.error('[VideoDashboard] Error message:', error.message);
      console.error('[VideoDashboard] Error stack:', error.stack);
      console.log('[VideoDashboard] ========== END /dashboard/video/generate (ERROR) ==========');
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/video/status/:taskId
   * Check status of a video generation task
   */
  fastify.get('/dashboard/video/status/:taskId', async (request, reply) => {
    const { taskId } = request.params;
    console.log('[VideoDashboard] ========== /dashboard/video/status/:taskId ==========');
    console.log('[VideoDashboard] Task ID:', taskId);
    console.log('[VideoDashboard] Timestamp:', new Date().toISOString());
    
    try {
      const user = request.user;
      console.log('[VideoDashboard] User:', user ? user._id : 'NOT AUTHENTICATED');
      
      if (!user) {
        console.log('[VideoDashboard] ❌ Unauthorized');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      console.log('[VideoDashboard] Calling checkVideoTaskResult...');
      const result = await checkVideoTaskResult(taskId);
      
      console.log('[VideoDashboard] ✅ checkVideoTaskResult returned:');
      console.log('[VideoDashboard]   - status:', result.status);
      console.log('[VideoDashboard]   - progress:', result.progress);
      console.log('[VideoDashboard]   - error:', result.error || 'none');
      console.log('[VideoDashboard]   - videos:', result.videos ? `${result.videos.length} video(s)` : 'none');
      if (result.videos && result.videos.length > 0) {
        console.log('[VideoDashboard]   - video URL:', result.videos[0]?.videoUrl?.substring(0, 100) + '...');
      }
      console.log('[VideoDashboard] ========== END /dashboard/video/status/:taskId ==========');
      
      return reply.send(result);
    } catch (error) {
      console.error('[VideoDashboard] ❌ Error checking status:', error);
      console.error('[VideoDashboard] Error message:', error.message);
      console.error('[VideoDashboard] Error stack:', error.stack);
      console.log('[VideoDashboard] ========== END /dashboard/video/status/:taskId (ERROR) ==========');
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
