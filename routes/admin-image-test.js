/**
 * Admin Image Model Test Routes
 * Dashboard for testing multiple Novita AI image generation models
 */

const { ObjectId } = require('mongodb');
const { checkUserAdmin } = require('../models/tool');
const {
  MODEL_CONFIGS,
  SIZE_OPTIONS,
  STYLE_PRESETS,
  initializeModelTest,
  checkTaskResult,
  saveTestResult,
  getModelStats,
  getRecentTests,
  getDefaultCharacterModels,
  setDefaultCharacterModel,
  uploadTestImageToS3,
  saveImageRating,
  getImageRating
} = require('../models/admin-image-test-utils');
const { removeUserPoints, getUserPoints } = require('../models/user-points-utils');
const { PRICING_CONFIG, getImageGenerationCost } = require('../config/pricing');

async function routes(fastify, options) {
  
  /**
   * GET /dashboard/image
   * Render the image model test dashboard (accessible to all authenticated users)
   */
  fastify.get('/dashboard/image', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.redirect('/login');
      }

      const db = fastify.mongo.db;
      const translations = request.translations;
      
      // Check if user is admin
      const isAdmin = await checkUserAdmin(fastify, user._id);

      // Get model statistics (only for admins)
      const modelStats = isAdmin ? await getModelStats(db) : [];
      
      // Get recent tests - filter by user if not admin
      const userId = isAdmin ? null : user._id.toString();
      const recentTests = await getRecentTests(db, 20, null, userId);
      
      // Get default character creation models (only for admins)
      const defaultModels = isAdmin ? await getDefaultCharacterModels(db) : {};
      
      // Get active SD models from database
      const activeSDModels = await db.collection('myModels').find({}).toArray();

      // Group SD models by style
      const sdModelsByStyle = {
        anime: [],
        photorealistic: [],
        other: []
      };

      activeSDModels.forEach(model => {
        const style = model.style || '';
        if (style === 'anime') {
          sdModelsByStyle.anime.push(model);
        } else if (style === 'photorealistic') {
          sdModelsByStyle.photorealistic.push(model);
        } else {
          sdModelsByStyle.other.push(model);
        }
      });

      // Prepare model list for view
      const models = Object.entries(MODEL_CONFIGS).map(([id, config]) => {
        const stats = modelStats.find(s => s.modelId === id) || {};
        return {
          id,
          name: config.name,
          description: config.description,
          async: config.async,
          requiresModel: config.requiresModel || false,
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

      return reply.view('/admin/image-test', {
        title: 'Image Dashboard',
        user,
        translations,
        models,
        activeSDModels,
        sdModelsByStyle,
        sizeOptions: SIZE_OPTIONS,
        stylePresets: STYLE_PRESETS,
        recentTests,
        defaultModels,
        modelConfigs: MODEL_CONFIGS,
        userPoints,
        imageCostPerUnit: PRICING_CONFIG.IMAGE_GENERATION.BASE_COST_PER_IMAGE,
        isAdmin
      });
    } catch (error) {
      console.error('[AdminImageTest] Error loading dashboard:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * POST /dashboard/image/generate
   * Start image generation test for selected models
   */
  fastify.post('/dashboard/image/generate', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const { models, selectedSDModels, prompt, basePrompt, size, style, skipStyleApplication, negativePrompt, steps, guidanceScale, samplerName, imagesPerModel } = request.body;

      if ((!models || !Array.isArray(models) || models.length === 0) && 
          (!selectedSDModels || !Array.isArray(selectedSDModels) || selectedSDModels.length === 0)) {
        return reply.status(400).send({ error: 'No models selected' });
      }

      if (!prompt || prompt.trim() === '') {
        return reply.status(400).send({ error: 'Prompt is required' });
      }

      // Calculate total cost
      const numImages = Math.max(1, Math.min(4, parseInt(imagesPerModel) || 1));
      const standardModelCount = models?.length || 0;
      const sdModelCount = selectedSDModels?.length || 0;
      const totalModels = standardModelCount + sdModelCount;
      const totalImages = totalModels * numImages;
      const totalCost = getImageGenerationCost(totalImages);

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
          request.translations?.points?.deduction_reasons?.image_generation || 'Image generation', 
          'image_generation', 
          fastify
        );
        console.log(`[AdminImageTest] Deducted ${totalCost} points from user ${user._id} for ${totalImages} images`);
      } catch (pointsError) {
        console.error('[AdminImageTest] Error deducting points:', pointsError);
        return reply.status(402).send({ error: 'Error deducting points for image generation.' });
      }

      console.log(`[AdminImageTest] Starting generation for ${models?.length || 0} standard models and ${selectedSDModels?.length || 0} SD models`);
      console.log(`[AdminImageTest] Prompt: ${prompt}`);
      console.log(`[AdminImageTest] Base Prompt: ${basePrompt || 'N/A'}`);
      console.log(`[AdminImageTest] Size: ${size}`);
      console.log(`[AdminImageTest] Style: ${style}`);
      console.log(`[AdminImageTest] Skip Style Application: ${skipStyleApplication}`);

      // Use prompt directly if style was already applied on frontend
      // Otherwise apply style preset if selected
      let finalPrompt = prompt;
      if (!skipStyleApplication && style && STYLE_PRESETS[style]) {
        const preset = STYLE_PRESETS[style];
        finalPrompt = preset.promptPrefix + prompt + preset.promptSuffix;
      }

      // Start generation for each selected model
      const tasks = [];
      
      // Process standard models
      if (models && Array.isArray(models)) {
        for (const modelId of models) {
          try {
            const numImages = Math.max(1, Math.min(4, parseInt(imagesPerModel) || 1));
            const config = MODEL_CONFIGS[modelId];
            
            // For models that support multiple images natively, pass the parameter
            if (numImages > 1 && config) {
              if (modelId === 'flux-2-flex' && config.supportedParams.includes('images')) {
                // Flux 2 Flex supports 'images' parameter
                const params = {
                  prompt: finalPrompt,
                  size: size || '1024*1024',
                  images: numImages
                };

                const task = await initializeModelTest(modelId, params);
                task.originalPrompt = basePrompt || prompt;
                task.finalPrompt = finalPrompt;
                task.size = size;
                task.style = style;
                task.userId = user._id.toString();
                tasks.push(task);
              } else {
                // For other models, create multiple tasks (generate multiple times)
                for (let i = 0; i < numImages; i++) {
                  const params = {
                    prompt: finalPrompt,
                    size: size || '1024*1024'
                  };

                  const task = await initializeModelTest(modelId, params);
                  task.originalPrompt = basePrompt || prompt;
                  task.finalPrompt = finalPrompt;
                  task.size = size;
                  task.style = style;
                  task.userId = user._id.toString();
                  // Add index suffix to model name for multiple generations
                  if (numImages > 1) {
                    task.modelName = `${config?.name || modelId} (#${i + 1})`;
                    task.cardId = `${modelId}-${i}`;
                  }
                  tasks.push(task);
                }
              }
            } else {
              // Single image generation
              const params = {
                prompt: finalPrompt,
                size: size || '1024*1024'
              };

              const task = await initializeModelTest(modelId, params);
              task.originalPrompt = basePrompt || prompt;
              task.finalPrompt = finalPrompt;
              task.size = size;
              task.style = style;
              task.userId = user._id.toString();
              tasks.push(task);
            }
          } catch (error) {
            console.error(`[AdminImageTest] Error starting ${modelId}:`, error.message);
            tasks.push({
              modelId,
              modelName: MODEL_CONFIGS[modelId]?.name || modelId,
              status: 'failed',
              error: error.message,
              startTime: Date.now()
            });
          }
        }
      }
      
      // Process SD models
      if (selectedSDModels && Array.isArray(selectedSDModels)) {
        for (const sdModel of selectedSDModels) {
          try {
            const numImages = Math.max(1, Math.min(4, parseInt(imagesPerModel) || 1));
            const params = {
              prompt: finalPrompt,
              model_name: sdModel.model || sdModel.model_name,
              size: size || '1024*1024',
              negative_prompt: negativePrompt || '',
              steps: steps ? parseInt(steps) : undefined,
              guidance_scale: guidanceScale ? parseFloat(guidanceScale) : undefined,
              sampler_name: samplerName || undefined,
              image_num: numImages // SD models support image_num parameter
            };

            const task = await initializeModelTest('sd-txt2img', params);
            task.originalPrompt = basePrompt || prompt;
            task.finalPrompt = finalPrompt;
            task.size = size;
            task.style = style;
            task.modelName = `${MODEL_CONFIGS['sd-txt2img'].name} - ${sdModel.name || sdModel.model}`;
            task.sdModelName = sdModel.name || sdModel.model;
            task.userId = user._id.toString();
            tasks.push(task);
          } catch (error) {
            console.error(`[AdminImageTest] Error starting SD model ${sdModel.model}:`, error.message);
            tasks.push({
              modelId: 'sd-txt2img',
              modelName: `${MODEL_CONFIGS['sd-txt2img'].name} - ${sdModel.name || sdModel.model}`,
              status: 'failed',
              error: error.message,
              startTime: Date.now()
            });
          }
        }
      }

      return reply.send({
        success: true,
        tasks
      });
    } catch (error) {
      console.error('[AdminImageTest] Error starting generation:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/image/status/:taskId
   * Check status of an async generation task
   */
  fastify.get('/dashboard/image/status/:taskId', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { taskId } = request.params;

      if (!taskId || taskId.startsWith('sync-')) {
        return reply.send({ status: 'completed', sync: true });
      }

      const result = await checkTaskResult(taskId);
      
      return reply.send(result);
    } catch (error) {
      console.error('[ImageDashboard] Error checking status:', error);
      return reply.status(500).send({ 
        status: 'error', 
        error: error.message 
      });
    }
  });

  /**
   * POST /dashboard/image/save-result
   * Save a completed test result
   */
  fastify.post('/dashboard/image/save-result', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const result = request.body;

      // Optionally upload images to S3
      if (result.images && Array.isArray(result.images)) {
        for (let i = 0; i < result.images.length; i++) {
          const img = result.images[i];
          if (img.imageUrl && !img.s3Url) {
            try {
              const s3Url = await uploadTestImageToS3(img.imageUrl, result.modelId);
              result.images[i].s3Url = s3Url;
            } catch (err) {
              console.error(`[ImageDashboard] Failed to upload to S3:`, err.message);
            }
          }
        }
      }

      result.userId = user._id.toString();
      const testId = await saveTestResult(db, result);

      return reply.send({ success: true, testId });
    } catch (error) {
      console.error('[ImageDashboard] Error saving result:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/image/stats
   * Get model statistics
   */
  fastify.get('/dashboard/image/stats', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const stats = await getModelStats(db);

      return reply.send({ stats });
    } catch (error) {
      console.error('[ImageDashboard] Error getting stats:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/image/history
   * Get recent test history
   */
  fastify.get('/dashboard/image/history', async (request, reply) => {
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
      
      const history = await getRecentTests(db, limit, modelId, userId);

      return reply.send({ history });
    } catch (error) {
      console.error('[ImageDashboard] Error getting history:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * PUT /dashboard/image/default-model
   * Set the default character creation model for a style
   */
  fastify.put('/dashboard/image/default-model', async (request, reply) => {
    try {
      const user = request.user;
      const isAdmin = await checkUserAdmin(fastify, user._id);
      
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied. Admin only.' });
      }

      const { style, modelId } = request.body;

      if (!style || !['anime', 'photorealistic'].includes(style)) {
        return reply.status(400).send({ error: 'Invalid style' });
      }

      if (!modelId || !MODEL_CONFIGS[modelId]) {
        return reply.status(400).send({ error: 'Invalid model' });
      }

      const db = fastify.mongo.db;
      await setDefaultCharacterModel(db, style, modelId);

      return reply.send({ 
        success: true, 
        message: `Default ${style} model set to ${MODEL_CONFIGS[modelId].name}` 
      });
    } catch (error) {
      console.error('[ImageDashboard] Error setting default model:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/image/default-models
   * Get default character creation models
   */
  fastify.get('/dashboard/image/default-models', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const defaultModels = await getDefaultCharacterModels(db);

      return reply.send({ defaultModels });
    } catch (error) {
      console.error('[ImageDashboard] Error getting default models:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * DELETE /dashboard/image/stats/reset
   * Reset model statistics (admin only)
   */
  fastify.delete('/dashboard/image/stats/reset', async (request, reply) => {
    try {
      const user = request.user;
      const isAdmin = await checkUserAdmin(fastify, user._id);
      
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied. Admin only.' });
      }

      const db = fastify.mongo.db;
      const { modelId } = request.query;

      if (modelId) {
        await db.collection('imageModelStats').deleteOne({ modelId });
        await db.collection('imageModelTests').deleteMany({ modelId });
      } else {
        await db.collection('imageModelStats').deleteMany({});
        await db.collection('imageModelTests').deleteMany({});
      }

      return reply.send({ 
        success: true, 
        message: modelId ? `Stats reset for ${modelId}` : 'All stats reset' 
      });
    } catch (error) {
      console.error('[ImageDashboard] Error resetting stats:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /dashboard/image/rate-image
   * Save an image rating
   */
  fastify.post('/dashboard/image/rate-image', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const { modelId, modelName, imageUrl, rating, testId } = request.body;

      if (!modelId || !imageUrl || !rating) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      if (rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Rating must be between 1 and 5' });
      }

      await saveImageRating(db, modelId, imageUrl, rating, testId, user._id.toString());

      return reply.send({ success: true });
    } catch (error) {
      console.error('[ImageDashboard] Error saving rating:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /dashboard/image/rating/:testId
   * Get rating for a test
   */
  fastify.get('/dashboard/image/rating/:testId', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = fastify.mongo.db;
      const { testId } = request.params;

      const rating = await getImageRating(db, testId);

      if (rating) {
        return reply.send({ success: true, rating: rating.rating });
      } else {
        return reply.send({ success: false, rating: null });
      }
    } catch (error) {
      console.error('[ImageDashboard] Error getting rating:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}

module.exports = routes;
